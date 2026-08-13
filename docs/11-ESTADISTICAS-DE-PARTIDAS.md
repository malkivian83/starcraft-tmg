# 11 · Estadísticas de partidas por lista

Especificación técnica de implementación. **Estado: aprobada, sin implementar.**
Fecha: 10 de agosto de 2026.

Este documento es autosuficiente: contiene todas las decisiones, contratos y
pasos necesarios para desarrollar la funcionalidad sin consultar nada más que
el código del repositorio.

---

## 1. Objetivo

Permitir que el propietario de una lista **ya guardada en su cuenta** registre
las partidas que ha jugado con ella: resultado (victoria, derrota o empate),
facción del rival y contra quién jugó, y consulte el balance acumulado.

### 1.1 Decisiones cerradas con el propietario del producto

| # | Decisión | Valor acordado |
|---|---|---|
| D1 | Granularidad | **Una fila por partida**, no contadores agregados. Los totales se derivan sumando. |
| D2 | Significado de «la facción» | La **facción del rival**. La raza y la carta de facción propias ya las define la lista. |
| D3 | Ubicación | **Pestaña «Estadísticas» en el constructor**, visible solo cuando la lista ya está guardada en la cuenta. |
| D4 | Visibilidad | **Privadas**: solo las ve el propietario. No se exponen en listas públicas ni en clonaciones. |

### 1.2 Consecuencias directas de las decisiones

- D1 obliga a una tabla propia con clave primaria por partida (§3).
- D2 hace que `opponent_race` y `opponent_faction_card_id` sean campos del
  registro de partida, nunca de la lista.
- D3 implica que la pestaña depende de `remoteRevision !== null` en el store
  (§9.1), no del modo de acceso.
- D4 implica que **ningún endpoint público** (`/api/lists/public/*`) devuelve
  estadísticas y que clonar una lista pública **no copia** su historial (§11).

Las decisiones sobre la representación gráfica (D5–D8) están en §9-bis, junto a
la especificación del gráfico.

---

## 2. Alcance

### 2.1 Entra

- Alta, edición y borrado de registros de partida asociados a una lista guardada.
- Consulta del historial y del balance acumulado (jugadas, victorias, derrotas,
  empates).
- Gráficas circulares del reparto de resultados por facción rival (§9-bis).
- Campos por partida: resultado (obligatorio), fecha (opcional), raza del rival
  (opcional), carta de facción del rival (opcional), nombre del rival (opcional).
- Traducciones es/en.
- Pruebas de servidor, de agregación y de interfaz.

### 2.2 No entra

- Estadísticas en listas públicas, en la página «Mis listas», en la hoja de
  impresión, en el export JSON o en el seed. Ver §11 y §15.
- Estadísticas globales por usuario, rankings o comparativas entre listas.
- Registro de la composición concreta jugada, puntuación, escenario o duración.

---

## 3. Modelo de datos

### 3.1 Por qué una tabla propia y no un campo del `payload`

`saved_lists.payload` es el JSON validado por `armyListPayloadSchema`
(`server/src/modules/lists/list.schema.ts`) y por `armyListSchema`
(`src/catalog/schema.ts`). Guardar las partidas dentro del payload sería un
error por tres motivos:

1. **Rompería el bloqueo optimista.** `PUT /api/lists/:id` exige la cabecera
   `If-Match` con la revisión y hace `revision = revision + 1`. Añadir una
   partida incrementaría la revisión y provocaría un `409 LIST_CONFLICT` en
   cualquier otra pestaña o dispositivo con la lista abierta.
2. **Contaminaría el formato portable.** El payload se exporta a JSON, se
   importa y se clona. Las partidas son datos personales del propietario y D4
   exige que no viajen en esas operaciones.
3. **Contradice la regla del proyecto** (`DEVELOPMENT.md`): la lista describe el
   ejército; lo que no es ejército no se persiste dentro de ella.

Precedente en el propio repositorio: los «me gusta» son una tabla aparte
(`saved_list_likes`, migración `008`) precisamente por las mismas razones.

### 3.2 Migración `server/src/db/migrations/012_list_match_records.sql`

El ejecutor de migraciones (`server/src/db/migrate.ts`) divide el fichero por
`;` seguido de salto de línea y **no** envuelve el DDL en una transacción, por
lo que cada sentencia debe ser idempotente (`IF NOT EXISTS`).

```sql
CREATE TABLE IF NOT EXISTS list_match_records (
  id CHAR(36) PRIMARY KEY,
  list_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  result ENUM('WIN', 'LOSS', 'DRAW') NOT NULL,
  played_on DATE NULL,
  opponent_race ENUM('ZERG', 'TERRAN', 'PROTOSS') NULL,
  opponent_faction_card_id VARCHAR(64) NULL,
  opponent_name VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX list_match_records_list_idx (list_id, played_on, created_at),
  INDEX list_match_records_owner_idx (owner_id),
  CONSTRAINT list_match_records_list_fk FOREIGN KEY (list_id) REFERENCES saved_lists(id) ON DELETE CASCADE,
  CONSTRAINT list_match_records_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Notas de diseño:

- **`ON DELETE CASCADE` sobre `saved_lists`**: borrar una lista borra su
  historial. Es el comportamiento esperado y evita filas huérfanas. Mismo
  criterio que `saved_list_likes`.
- **`owner_id` denormalizado**: permite que toda consulta filtre por propietario
  sin `JOIN`, tal y como exige `DEVELOPMENT.md` («la API deriva el propietario
  de la sesión y filtra todas las consultas por `owner_id`»). Se escribe una
  sola vez, en el `INSERT`, tomándolo de la sesión.
- **`opponent_faction_card_id VARCHAR(64)`**: los identificadores del catálogo
  son cadenas del estilo `zerg.faction.swarm`. No hay clave foránea porque el
  catálogo es un JSON del cliente, no una tabla.
- **`played_on DATE NULL`**: el pool usa `dateStrings: true`
  (`server/src/db/pool.ts`), así que MariaDB devuelve la columna como cadena
  `'YYYY-MM-DD'` y no hace falta convertir nada. Es opcional porque una partida
  puede registrarse sin recordar la fecha; la interfaz propone la de hoy.
- **`opponent_name VARCHAR(80)`**: dato personal de un tercero. D4 lo mantiene
  privado; no debe aparecer nunca en una respuesta pública.

### 3.3 Tipos del servidor

Nuevo fichero `server/src/modules/lists/match.schema.ts`:

```ts
import { z } from 'zod';

export const matchResultSchema = z.enum(['WIN', 'LOSS', 'DRAW']);
export const matchRaceSchema = z.enum(['ZERG', 'TERRAN', 'PROTOSS']);

/** Cuerpo aceptado en POST y PUT. Todo es opcional salvo el resultado. */
export const matchRecordInputSchema = z.object({
  result: matchResultSchema,
  playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  opponentRace: matchRaceSchema.nullable().default(null),
  opponentFactionCardId: z.string().trim().min(1).max(64).nullable().default(null),
  opponentName: z.string().trim().max(80).nullable().default(null),
}).transform((value) => ({
  ...value,
  // Una cadena vacía enviada por un formulario equivale a «sin dato».
  opponentName: value.opponentName === '' ? null : value.opponentName,
}));

export type MatchRecordInput = z.infer<typeof matchRecordInputSchema>;
```

El servidor **no** valida `opponentFactionCardId` contra el catálogo: el
catálogo vive en `src/catalog/data/*.json`, en el cliente. Es el mismo criterio
que ya sigue `armyListPayloadSchema` con `factionCardId`. La comprobación de que
la carta existe y pertenece a la raza indicada se hace en la interfaz (§9.3).

### 3.4 Tipos del cliente

En `src/auth/listService.ts` (junto a `RemoteList`):

```ts
export type MatchResult = 'WIN' | 'LOSS' | 'DRAW';

export interface MatchRecord {
  id: string;
  listId: string;
  result: MatchResult;
  playedOn: string | null;            // 'YYYY-MM-DD'
  opponentRace: Race | null;
  opponentFactionCardId: string | null;
  opponentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchSummary {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface MatchRecordInput {
  result: MatchResult;
  playedOn: string | null;
  opponentRace: Race | null;
  opponentFactionCardId: string | null;
  opponentName: string | null;
}
```

`MatchSummary` **solo devuelve enteros**. El porcentaje de victorias se calcula
y se formatea en la interfaz, para no fijar redondeo ni idioma en la API.

---

## 4. Reglas de negocio

| ID | Regla | Dónde se aplica |
|---|---|---|
| E1 | Solo el propietario de la lista puede leer, crear, editar o borrar sus partidas. | Repositorio: todas las consultas filtran por `owner_id`. |
| E2 | Registrar una partida **no modifica** `saved_lists`: ni el `payload`, ni `updated_at`, ni `revision`. | Rutas de partidas: no tocan `saved_lists`. |
| E3 | Las estadísticas exigen una lista ya guardada. Un borrador sin guardar no tiene dónde colgarlas. | Interfaz: pestaña oculta si `remoteRevision === null`. API: 404 si la lista no existe para ese propietario. |
| E4 | Una lista admite como máximo **500 partidas**. | Ruta `POST`: 409 `MATCH_LIMIT_REACHED`. |
| E5 | `playedOn` no puede ser una fecha futura. | Esquema Zod + comprobación en la ruta. |
| E6 | Si `opponentFactionCardId` viene informado, `opponentRace` es obligatorio. | Ruta: 400 `INVALID_MATCH`. La interfaz ya lo impide deshabilitando el selector. |
| E7 | Borrar la lista borra su historial. | `ON DELETE CASCADE`. |
| E8 | Clonar una lista pública no copia el historial del original. | No se toca `POST /lists/public/:id/clone`. |

---

## 5. API HTTP

Todas las rutas cuelgan del router de listas ya existente, así que heredan
`requireUser` (montado en `server/src/app.ts`) y `requireVerifiedUser` (montado
en `createListRouter`). Un usuario sin sesión recibe `401 UNAUTHENTICATED`
antes de tocar la base de datos; uno sin verificar, `403 EMAIL_NOT_VERIFIED`.

### 5.1 Contratos

#### `GET /api/lists/:id/matches`

Respuesta `200`:

```json
{
  "matches": [
    {
      "id": "6f1c…",
      "listId": "0a3d…",
      "result": "WIN",
      "playedOn": "2026-08-09",
      "opponentRace": "TERRAN",
      "opponentFactionCardId": "terran.faction.dominion",
      "opponentName": "Marta",
      "createdAt": "2026-08-09 20:14:03",
      "updatedAt": "2026-08-09 20:14:03"
    }
  ],
  "summary": { "played": 1, "wins": 1, "losses": 0, "draws": 0 }
}
```

Orden: `played_on DESC` con nulos al final, y `created_at DESC` como
desempate. En SQL: `ORDER BY played_on IS NULL, played_on DESC, created_at DESC`.

#### `POST /api/lists/:id/matches`

Cuerpo: `MatchRecordInput`. Respuesta `201` con `{ match, summary }`.

#### `PUT /api/lists/:id/matches/:matchId`

Cuerpo: `MatchRecordInput` completo (reemplazo, no parcheo). Respuesta `200`
con `{ match, summary }`.

**Sin `If-Match`.** Los registros de partida no participan en el bloqueo
optimista de la lista (regla E2). El último que escribe gana; el conflicto real
—dos personas editando la misma partida— no existe porque solo el propietario
tiene acceso.

#### `DELETE /api/lists/:id/matches/:matchId`

Respuesta `200` con `{ summary }`. Se devuelve `200` y no `204` a propósito: la
interfaz necesita el balance recalculado y así se evita una segunda petición.
Es una desviación consciente respecto de `DELETE /api/lists/:id`, que sí
responde `204`.

### 5.2 Errores

| Código HTTP | `error.code` | Cuándo |
|---|---|---|
| 400 | `INVALID_MATCH` | El cuerpo no valida, la fecha es futura o hay carta de facción sin raza. |
| 401 | `UNAUTHENTICATED` | Sin cookie de sesión o sesión inválida. |
| 403 | `EMAIL_NOT_VERIFIED` | Cuenta sin verificar. |
| 404 | `LIST_NOT_FOUND` | La lista no existe o no pertenece al usuario. |
| 404 | `MATCH_NOT_FOUND` | La partida no existe o no pertenece a esa lista y usuario. |
| 409 | `MATCH_LIMIT_REACHED` | Se ha alcanzado el máximo de 500 partidas (E4). |

**Importante:** cuando la lista pertenece a otro usuario se responde `404
LIST_NOT_FOUND`, nunca `403`. Es el comportamiento actual de `findForOwner` y
evita confirmar la existencia de listas ajenas.

Añadir las cuatro claves nuevas al mapa `API_ERROR_MESSAGES` de
`src/auth/authService.ts` para que se traduzcan en el cliente:

```ts
INVALID_MATCH: { es: 'Revisa los datos de la partida.', en: 'Check the match details.' },
MATCH_NOT_FOUND: { es: 'Esa partida ya no existe.', en: 'That match no longer exists.' },
MATCH_LIMIT_REACHED: { es: 'Esta lista ya tiene el máximo de partidas registradas.', en: 'This list already has the maximum number of recorded matches.' },
LIST_NOT_FOUND: { es: 'No existe esa lista.', en: 'That list does not exist.' },
```

---

## 6. Servidor — implementación

### 6.1 `server/src/modules/lists/match.repository.ts` (nuevo)

Sigue el patrón de `list.repository.ts`: interfaz de fila `RowDataPacket`,
función `map` privada y clase con el pool inyectado.

```ts
import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { MatchRecordInput } from './match.schema.js';

export interface MatchRecord {
  id: string;
  listId: string;
  result: 'WIN' | 'LOSS' | 'DRAW';
  playedOn: string | null;
  opponentRace: 'ZERG' | 'TERRAN' | 'PROTOSS' | null;
  opponentFactionCardId: string | null;
  opponentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchSummary {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export class MatchRepository {
  constructor(private readonly pool: Pool) {}

  listForList(listId: string, ownerId: string): Promise<MatchRecord[]>;
  countForList(listId: string, ownerId: string): Promise<number>;
  summaryForList(listId: string, ownerId: string): Promise<MatchSummary>;
  create(listId: string, ownerId: string, input: MatchRecordInput): Promise<MatchRecord>;
  update(id: string, listId: string, ownerId: string, input: MatchRecordInput): Promise<MatchRecord | null>;
  delete(id: string, listId: string, ownerId: string): Promise<boolean>;
  findOne(id: string, listId: string, ownerId: string): Promise<MatchRecord | null>;
}
```

Consultas clave:

```sql
-- summaryForList
SELECT COUNT(*) AS played,
       SUM(result = 'WIN')  AS wins,
       SUM(result = 'LOSS') AS losses,
       SUM(result = 'DRAW') AS draws
  FROM list_match_records
 WHERE list_id = ? AND owner_id = ?;
```

`SUM(...)` devuelve `NULL` cuando no hay filas y `mysql2` puede entregar los
agregados como cadena: normalizar siempre con `Number(row.wins ?? 0)`, igual
que hace `withLikeMetadata` en `list.repository.ts`.

```sql
-- create
INSERT INTO list_match_records
  (id, list_id, owner_id, result, played_on, opponent_race, opponent_faction_card_id, opponent_name)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);

-- update (el filtro por owner_id es la autorización, no un adorno)
UPDATE list_match_records
   SET result = ?, played_on = ?, opponent_race = ?,
       opponent_faction_card_id = ?, opponent_name = ?
 WHERE id = ? AND list_id = ? AND owner_id = ?;

-- delete
DELETE FROM list_match_records WHERE id = ? AND list_id = ? AND owner_id = ?;
```

`update` y `delete` devuelven `null` / `false` cuando `affectedRows === 0`, y la
ruta lo traduce a `404 MATCH_NOT_FOUND`. Mismo patrón que `ListRepository.update`.

### 6.2 `server/src/modules/lists/match.routes.ts` (nuevo)

Sub-router con `mergeParams: true` para poder leer `:id` del padre:

```ts
export function createMatchRouter(lists: ListRepository, matches: MatchRepository): Router {
  const router = Router({ mergeParams: true });

  // La lista se resuelve una sola vez por petición: si no es del usuario,
  // 404 antes de tocar la tabla de partidas.
  router.use(async (request, _response, next) => {
    const list = await lists.findForOwner(request.params.id!, request.authenticatedUser!.id);
    if (!list) return next(new HttpError(404, 'LIST_NOT_FOUND', 'No existe esa lista.'));
    next();
  });

  router.get('/', /* … */);
  router.post('/', /* … */);
  router.put('/:matchId', /* … */);
  router.delete('/:matchId', /* … */);

  return router;
}
```

Montaje en `list.routes.ts`, **después** de las rutas `/public/…` y antes o
después de `/:id` (no hay ambigüedad: `/:id` es de un solo segmento):

```ts
export function createListRouter(repository: ListRepository, matches: MatchRepository): Router {
  // …
  router.use('/:id/matches', createMatchRouter(repository, matches));
  // …
}
```

Y en `server/src/app.ts`:

```ts
const matchRepository = new MatchRepository(pool);
// …
app.use('/api/lists', requireUser(authRepository, env), createListRouter(listRepository, matchRepository));
```

Validación de fecha futura (E5), dentro de la ruta:

```ts
const today = new Date().toISOString().slice(0, 10);
if (input.playedOn && input.playedOn > today) {
  throw new HttpError(400, 'INVALID_MATCH', 'La fecha de la partida no puede ser futura.');
}
```

Comparar cadenas `YYYY-MM-DD` es correcto y evita zonas horarias. Se compara
contra la fecha UTC del servidor; se acepta el desfase de hasta un día para un
usuario en UTC+2 que registre una partida de madrugada, porque la alternativa
—confiar en la zona horaria enviada por el cliente— no aporta precisión real.

No se añade `rateLimit`: las rutas ya exigen sesión verificada y el tope de 500
filas por lista (E4) acota el crecimiento.

---

## 7. Cliente — servicio HTTP

Las funciones se añaden a `src/auth/listService.ts`, no a un fichero nuevo,
para reutilizar el helper `request` privado que ya gestiona `credentials`,
traducción de errores y respuestas `204`.

```ts
export async function loadListMatches(listId: string): Promise<{ matches: MatchRecord[]; summary: MatchSummary }> {
  return request(`/lists/${encodeURIComponent(listId)}/matches`);
}

export async function createListMatch(listId: string, input: MatchRecordInput): Promise<{ match: MatchRecord; summary: MatchSummary }> {
  return request(`/lists/${encodeURIComponent(listId)}/matches`, {
    method: 'POST', body: JSON.stringify(input),
  });
}

export async function updateListMatch(listId: string, matchId: string, input: MatchRecordInput): Promise<{ match: MatchRecord; summary: MatchSummary }> {
  return request(`/lists/${encodeURIComponent(listId)}/matches/${encodeURIComponent(matchId)}`, {
    method: 'PUT', body: JSON.stringify(input),
  });
}

export async function deleteListMatch(listId: string, matchId: string): Promise<{ summary: MatchSummary }> {
  return request(`/lists/${encodeURIComponent(listId)}/matches/${encodeURIComponent(matchId)}`, {
    method: 'DELETE',
  });
}
```

---

## 8. Cliente — estado

**Las partidas no entran en `useListStore`.** El store describe la lista en
edición y su bandera `isDirty`; registrar una partida no ensucia la lista ni
debe disparar el aviso de cambios sin guardar ni el guardado del borrador en
`localStorage` (`src/store/draftPersistence.ts`).

Se implementa un hook propio, `src/ui/builder/useMatchRecords.ts`:

```ts
export interface MatchRecordsState {
  matches: MatchRecord[];
  summary: MatchSummary;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  create: (input: MatchRecordInput) => Promise<boolean>;
  update: (id: string, input: MatchRecordInput) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  reload: () => Promise<void>;
}

export function useMatchRecords(listId: string | null): MatchRecordsState;
```

Comportamiento exigido:

- `listId === null` (lista sin guardar): estado `idle`, sin petición.
- Al cambiar `listId` se recarga y **se descarta la respuesta obsoleta** con la
  bandera `active` del `useEffect`, igual que hace `App.tsx` al cargar una lista
  pública.
- Las mutaciones aplican la respuesta del servidor (`match` y `summary`); no se
  hace actualización optimista, para que el balance mostrado sea siempre el
  persistido.
- Los errores se guardan en `error` como mensaje ya traducido por `ApiError` y
  las funciones devuelven `false`; nunca lanzan hacia el componente.

---

## 9. Interfaz

### 9.1 La pestaña en `src/App.tsx`

`STEPS` es hoy una constante de módulo. Se añade el paso condicionalmente:

```tsx
type StepId = 'cards' | 'units' | 'scenario' | 'review' | 'stats';

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'cards', label: 'commandCards' }, { id: 'units', label: 'recruitment' },
  { id: 'scenario', label: 'mission' }, { id: 'review', label: 'review' },
];
const STATS_STEP = { id: 'stats' as const, label: 'statistics' };
```

Dentro de `ArmyBuilderApp`:

```tsx
const statsAvailable = capabilities.saveRemoteLists && remoteRevision !== null;
const steps = statsAvailable ? [...STEPS, STATS_STEP] : STEPS;
```

- `errorsByStep` necesita la entrada `stats: 0` (el paso nunca muestra insignia).
- El `.map` de la barra de pestañas pasa a recorrer `steps`.
- **Caso límite obligatorio:** si el usuario está en `stats` y la lista deja de
  estar guardada (crear lista nueva, importar JSON o seed, cambiar de raza,
  clonar), hay que volver al primer paso. Añadir:

  ```tsx
  useEffect(() => {
    if (!statsAvailable && step === 'stats') setStep('cards');
  }, [statsAvailable, step]);
  ```

- Renderizado del contenido, junto a los demás pasos:

  ```tsx
  {step === 'stats' && <StepStatistics listId={list.id} />}
  ```

`statsAvailable` es falso en modo invitado por partida doble: `capabilities
.saveRemoteLists` es `false` y `remoteRevision` es siempre `null`.

### 9.2 `src/ui/builder/StepStatistics.tsx` (nuevo)

Estructura, reutilizando las clases del sistema de diseño ya existentes
(`panel`, `panel__title`, `field`, `chip`, `muted`, `small`, `stack`, `row`):

```
<div className="stats-layout">
  <section className="panel">      ← resumen (balance)
  <section className="panel">      ← formulario de alta/edición
  <section className="panel">      ← historial
</div>
```

Todas las secciones llevan `no-print` (§11.4).

### 9.3 Formulario

| Campo | Control | Obligatorio | Notas |
|---|---|---|---|
| Resultado | Tres botones tipo segmento (`Victoria` / `Derrota` / `Empate`) | Sí | Sin valor por defecto: obliga a una elección consciente. |
| Fecha | `<input type="date" max={hoy}>` | No | Valor inicial: la fecha local de hoy. |
| Raza del rival | `<select>` con `ZERG` / `TERRAN` / `PROTOSS` y opción vacía | No | |
| Facción del rival | `<select>` con las cartas de facción de esa raza | No | **Deshabilitado mientras no haya raza.** Al cambiar de raza se limpia el valor. |
| Nombre del rival | `<input maxLength={80}>` | No | Etiqueta: «Contra quién». |

Las cartas de facción se obtienen del catálogo, sin duplicar datos:

```ts
const opponentFactions = useMemo(
  () => opponentRace ? buildCatalogIndex(loadCatalog(opponentRace).catalog).catalog.factionCards : [],
  [opponentRace],
);
```

Botón primario «Añadir partida», deshabilitado mientras no hay resultado
elegido o hay una petición en curso. Tras un alta correcta el formulario se
reinicia salvo la fecha, que conserva la última usada (registrar varias
partidas del mismo torneo es el caso frecuente).

En modo edición el mismo formulario se rellena con la partida seleccionada y
los botones pasan a «Guardar cambios» y «Cancelar».

### 9.4 Historial

Tabla con una fila por partida y columnas: resultado, fecha, rival (raza +
carta de facción), nombre y acciones (`Editar`, `Borrar`).

- El resultado se muestra como `chip` con modificador de color:
  `stats-result--win`, `stats-result--loss`, `stats-result--draw`.
- Los campos vacíos se muestran como `—` (clave `print.noValue` ya existe; para
  esta pantalla se añade `builderUi.noValue`).
- Fecha: formatear **sin** `new Date(cadena)`. `new Date('2026-08-10')` se
  interpreta como medianoche UTC y en zonas negativas muestra el día anterior.
  Usar un helper local:

  ```ts
  function formatPlayedOn(value: string | null, locale: SupportedLocale): string {
    if (!value) return '—';
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year!, month! - 1, day!).toLocaleDateString(locale);
  }
  ```

- `Borrar` pide confirmación con `window.confirm`, igual que
  `SavedListsPage.remove`.
- Sin partidas: mensaje en `panel empty`, misma convención que
  `SavedListsPage`.

### 9.5 Resumen

Cuatro cifras —jugadas, victorias, derrotas, empates— y el porcentaje de
victorias calculado en cliente:

```ts
const winRate = summary.played === 0 ? null : Math.round((summary.wins / summary.played) * 100);
```

Con `played === 0` se muestra `—`, no `0 %`: no es lo mismo no haber jugado que
no haber ganado nunca.

### 9.6 Carga y error

- `status === 'loading'`: `panel empty` con `common.loading`.
- `status === 'error'`: `panel empty` con el mensaje de `error` y un botón
  «Reintentar» que llama a `reload()`.
- Un fallo de mutación se muestra sobre el formulario sin vaciarlo, para que el
  usuario no pierda lo escrito.

### 9.7 Estilos

Añadir un bloque nuevo al final de `src/ui/builder/builder-design.css` con el
prefijo `stats-`. No modificar clases existentes. Respetar
`docs/09-DIRECTRICES-DE-DISENO.md`: colores mediante variables
(`var(--ok)`, `var(--error)`, `var(--text-dim)`), nunca literales.

---

## 9-bis. Gráficas circulares por facción rival

### Decisiones cerradas con el propietario del producto

| # | Decisión | Valor acordado |
|---|---|---|
| D5 | Forma | **Un donut por facción rival**, no un donut único de dos anillos. Un círculo solo codifica una dimensión; la facción la identifica el encabezado y el color queda libre para el resultado. |
| D6 | Empates | **Tercer sector**. El círculo reparte el 100 % de las partidas jugadas y el porcentaje de victorias se calcula sobre el total. |
| D7 | Partidas sin facción anotada | **Cuarto grupo «Sin registrar»**, con su propio donut. Los donuts suman siempre el total de partidas. |
| D8 | Qué codifica el color | **El resultado** (victoria / derrota / empate). Nunca la raza. |

### 9-bis.1 Sin cambios en la API

El agregado se hace en el cliente: `GET /api/lists/:id/matches` ya devuelve
todas las partidas y el tope de 500 (E4) acota el coste. **No añadir endpoints
ni columnas agregadas para esto.**

### 9-bis.2 Agrupación — funciones puras

Fichero nuevo `src/ui/builder/matchStats.ts`, sin React ni DOM, para poder
probarlo aislado:

```ts
export type MatchGroupId = Race | 'UNKNOWN';

export interface MatchGroup {
  id: MatchGroupId;
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Orden fijo: ZERG, TERRAN, PROTOSS, UNKNOWN. Nunca por tamaño. */
export function groupByOpponentRace(matches: MatchRecord[]): MatchGroup[];

/** `null` con 0 partidas: no es lo mismo no haber jugado que no haber ganado. */
export function winRatePercent(group: { played: number; wins: number }): number | null;
```

Reglas:

- **El orden de los grupos es fijo**, definido en código, no derivado de los
  datos. Si los donuts se reordenaran al registrar partidas, el usuario
  perdería la referencia visual entre una visita y la siguiente.
- Los grupos con `played === 0` **no se renderizan**: nada de donuts vacíos.
- `opponentRace === null` cae en `UNKNOWN`, se etiqueta «Sin registrar» y va
  siempre el último.
- Sin partidas registradas, la sección de gráficas no se renderiza en absoluto;
  ya lo cubre el mensaje vacío de §9.4.

### 9-bis.3 Paleta — validada, no estimada

El color codifica el **resultado**, así que es constante en las tres razas: los
bloques `[data-race]` de `design-system.css` solo redefinen `--accent*` y
`--race-glow`, nunca `--ok` ni `--error`. Un mismo verde significa lo mismo en
una lista Zerg y en una Protoss.

Añadir a `:root` en `src/styles/design-system.css`:

```css
--stat-win: var(--ok);                    /* oklch(0.8 0.11 165)  → #73d4ac */
--stat-loss: var(--error);                /* oklch(0.7 0.15 22)   → #ed7473 */
--stat-draw: oklch(0.55 0.05 260);        /*                      → #61728f */
```

`--stat-draw` es nuevo. **No usar `--text-dim` como color de empate**: es un
color con alfa pensado para texto y sobre el panel queda a ΔE 5,8 del rojo bajo
protanopia, es decir, indistinguible para el daltonismo más frecuente. El
pizarra elegido lo sube a ΔE 23,5.

Verificación ejecutada sobre la superficie real del panel (`--bg-panel`,
`#191d2c`):

```bash
node scripts/validate_palette.js "#73d4ac,#ed7473,#61728f" --mode dark --surface "#191d2c" --pairs all
```

| Comprobación | Resultado |
|---|---|
| Separación CVD (protan/deutan, todos los pares) | **PASS** — peor par `#ed7473`↔`#73d4ac`, ΔE 10,0 |
| Suelo de visión normal | **PASS** — peor par ΔE 23,5 |
| Contraste contra la superficie | **PASS** — los tres ≥ 3:1 |
| Banda de luminosidad | FAIL asumido — `--ok` (L 0,799) y `--error` (L 0,70) quedan por encima de la banda de referencia [0,48–0,67]. **Son los colores semánticos que la aplicación ya usa** para listas válidas e inválidas; cambiarlos solo aquí rompería la coherencia del producto. |
| Suelo de croma | FAIL asumido — `--stat-draw` tiene croma 0,05 y «lee como gris». Es exactamente lo que se busca para un empate: un estado neutro. Las comprobaciones que sí afectan a la legibilidad (CVD y contraste) pasan. |

Si alguien cambia cualquiera de los tres colores, **debe volver a ejecutar el
validador** antes de integrar.

### 9-bis.4 Construcción del SVG

Sin librerías. Un donut es un `<circle>` con `stroke-dasharray`, y cada sector
es otro círculo superpuesto con su propio `stroke-dashoffset`:

```ts
export const DONUT_RADIUS = 40;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;  // 251.327
export const DONUT_GAP = 2;   // hueco de superficie entre sectores

export interface DonutSegment {
  key: 'wins' | 'losses' | 'draws';
  length: number;    // longitud del trazo, ya descontado el hueco
  offset: number;    // stroke-dashoffset (negativo, acumulado)
}

export function donutSegments(group: MatchGroup): DonutSegment[];
```

Reglas de geometría:

1. **Orden de sectores fijo**: victorias → derrotas → empates. Nunca por tamaño.
2. Un sector con valor 0 **no se emite**. Emitirlo dejaría un hueco de 2 px sin
   trazo, que se ve como una muesca sin causa.
3. **Caso límite obligatorio:** si el grupo tiene un único tipo de resultado
   (por ejemplo `3-0-0`), el sector cubre la circunferencia completa y el hueco
   de 2 px produciría una muesca en un anillo que debería ser continuo. Con un
   solo sector, `length = DONUT_CIRCUMFERENCE` sin descontar hueco.
4. El grupo se dibuja con `transform="rotate(-90 55 55)"` para que arranque a
   las 12 en punto.
5. `fill="none"`, `stroke-width={13}`, sin `stroke-linecap="round"`: los
   extremos redondeados se comen el hueco y falsean las proporciones.

Centro del donut: el porcentaje de victorias (`Math.round`, sin decimales) y
debajo el marcador `3-2-0`. Bajo el SVG, el nombre del grupo y el total de
partidas.

### 9-bis.5 Muestras pequeñas

Con pocas partidas un porcentaje engaña: `50 %` sobre 2 partidas es una
victoria y una derrota, no una tendencia. Por eso **el recuento absoluto es
obligatorio**, no decorativo:

- Marcador `V-D-E` siempre visible en el centro, bajo el porcentaje.
- Total de partidas del grupo siempre visible en el pie del donut.
- Con `played === 0` el grupo no se dibuja, así que no existe el caso `—`.

### 9-bis.6 Accesibilidad

- Cada `<svg>` lleva `role="img"` y un `aria-label` con la frase completa,
  construida con la clave `statsDonutAria`. Sin eso el gráfico no existe para
  un lector de pantalla.
- **Nunca solo color**: el porcentaje y el marcador van escritos dentro del
  donut, y la leyenda combina cuadrado de color + texto.
- **Una sola leyenda** para todo el conjunto, colocada encima de la rejilla de
  donuts, no una por donut.
- Sin animación de entrada de los arcos: no aporta información y obligaría a
  gestionar `prefers-reduced-motion`.
- Los textos usan `var(--text)` y `var(--text-dim)`, nunca el color del sector.

### 9-bis.7 Maquetación

Va dentro del panel de resumen (§9.5), debajo de las cuatro cifras:

```css
.stats-donuts { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
```

`auto-fit` reparte cuatro donuts en una fila en escritorio y en dos columnas en
móvil sin consultas de medios. El SVG usa `viewBox="0 0 110 110"` y
`width="100%"` con `max-width: 110px`: escala sin recalcular nada.

---

## 10. Traducciones

`tests/i18n/resources.test.ts` exige **paridad exacta de claves entre `es` y
`en`** y prohíbe cadenas vacías. Cualquier clave añadida en un idioma debe
existir en el otro.

- Namespace `builder`: `statistics` → `Estadísticas` / `Statistics` (etiqueta de
  la pestaña; `STEPS` usa `tBuilder(item.label)`).
- Namespace `builderUi`: el resto de cadenas de la sección.

Claves mínimas en `builderUi` (es / en):

| Clave | es | en |
|---|---|---|
| `statsTitle` | Estadísticas de esta lista | Statistics for this list |
| `statsHint` | Registra las partidas que juegues con esta lista. Solo las ves tú. | Record the games you play with this list. Only you can see them. |
| `statsBalance` | Balance | Record |
| `statsPlayed` | Jugadas | Played |
| `statsWins` | Victorias | Wins |
| `statsLosses` | Derrotas | Losses |
| `statsDraws` | Empates | Draws |
| `statsWinRate` | % de victorias | Win rate |
| `statsAdd` | Añadir partida | Add match |
| `statsResult` | Resultado | Result |
| `statsWin` | Victoria | Win |
| `statsLoss` | Derrota | Loss |
| `statsDraw` | Empate | Draw |
| `statsDate` | Fecha | Date |
| `statsOpponentRace` | Raza del rival | Opponent race |
| `statsOpponentFaction` | Facción del rival | Opponent faction |
| `statsOpponentName` | Contra quién | Opponent |
| `statsOpponentNameHint` | Opcional | Optional |
| `statsChooseRaceFirst` | Elige primero la raza del rival | Choose the opponent race first |
| `statsHistory` | Historial | History |
| `statsEmpty` | Todavía no has registrado ninguna partida con esta lista. | You have not recorded any games with this list yet. |
| `statsEdit` | Editar | Edit |
| `statsDelete` | Borrar | Delete |
| `statsDeleteConfirm` | ¿Borrar esta partida del historial? | Delete this match from the history? |
| `statsSaveChanges` | Guardar cambios | Save changes |
| `statsCancel` | Cancelar | Cancel |
| `statsRetry` | Reintentar | Retry |
| `statsByFaction` | Por facción rival | By opponent faction |
| `statsVs` | vs {{faction}} | vs {{faction}} |
| `statsUnknownFaction` | Sin registrar | Not recorded |
| `statsDonutAria` | {{faction}}: {{wins}} victorias, {{losses}} derrotas y {{draws}} empates de {{played}} partidas. | {{faction}}: {{wins}} wins, {{losses}} losses and {{draws}} draws out of {{played}} games. |
| `statsLoadError` | No se pudieron cargar las estadísticas. | Statistics could not be loaded. |
| `statsSaveError` | No se pudo guardar la partida. | The match could not be saved. |
| `statsUnsavedHint` | Guarda la lista para poder registrar partidas. | Save the list to start recording games. |
| `noValue` | — | — |

`statsUnsavedHint` no se usa en la pestaña (que está oculta) sino como texto
opcional de ayuda; si no se coloca en ninguna vista, **no añadir la clave**: la
prueba de i18n no detecta claves muertas, pero ensucian el fichero.

---

## 11. Interacción con lo que ya existe

### 11.1 Listas públicas

Ningún cambio en `/api/lists/public/*` ni en `PublicListPage`. La función
`payload()` de `list.routes.ts` no debe incluir nada de estadísticas.

### 11.2 Clonar

`POST /lists/public/:id/clone` crea una lista nueva con otro `id` y otro
propietario. No se copia el historial (E8). No hay cambios en esa ruta.

### 11.3 Export / import JSON y seed

`downloadJson`, `importListFromJson` (`src/store/persistence.ts`) y el códec de
seed (`src/engine/seed/codec.ts`) operan sobre `ArmyList`. Como las partidas no
forman parte de `ArmyList`, no hay nada que tocar. **No ampliar `armyListSchema`
ni `armyListPayloadSchema`.**

Consecuencia visible: importar un JSON produce una lista sin guardar
(`remoteRevision === null`) y por tanto sin pestaña de estadísticas hasta que se
guarde. Es coherente con D3.

### 11.4 Impresión

`PrintSheet` no cambia. Toda la sección lleva `no-print`.

### 11.5 Borrado de cuenta

El borrado de cuenta es lógico (`users.deleted_at`), no físico, así que la
cascada sobre `users` no se dispara y las filas permanecen inaccesibles junto
con sus listas. Sin cambios.

### 11.6 Panel de administración

`SuperAdminPanel` muestra el número de listas por usuario. No se añade
información de partidas: D4 las declara privadas y no hay motivo operativo para
que un administrador las vea.

---

## 12. Pruebas

Obligatorias antes de dar la funcionalidad por terminada
(`DEVELOPMENT.md`: «todo cambio de comportamiento debe incluir una prueba de
regresión»).

### 12.1 `tests/server/match-authorization.test.ts` (nuevo)

Calcado de `tests/server/list-authorization.test.ts`: pool simulado que **lanza
si alguien consulta la base de datos**, y comprobación de que las cuatro rutas
responden `401 UNAUTHENTICATED` sin sesión y sin tocar la BD.

```ts
it.each([
  ['GET', '/api/lists/<uuid>/matches'],
  ['POST', '/api/lists/<uuid>/matches'],
  ['PUT', '/api/lists/<uuid>/matches/<uuid>'],
  ['DELETE', '/api/lists/<uuid>/matches/<uuid>'],
])(…);
```

### 12.2 `tests/server/match-validation.test.ts` (nuevo)

Sobre `matchRecordInputSchema`, sin base de datos:

- Acepta el mínimo `{ result: 'WIN' }` y rellena los opcionales a `null`.
- Rechaza `result` ausente o desconocido.
- Rechaza `playedOn` con formato incorrecto (`'09/08/2026'`, `'2026-8-9'`).
- Convierte `opponentName: ''` en `null` y recorta espacios.
- Rechaza `opponentName` de más de 80 caracteres.

### 12.3 `tests/store/matchStats.test.ts` (nuevo)

Sobre las funciones puras de `src/ui/builder/matchStats.ts`. Es la prueba más
valiosa del lote: aquí es donde una gráfica puede mentir.

`winRatePercent`:

- `played === 0` → `null`.
- 1 de 3 → `33`; 3 de 3 → `100`; 0 de 4 → `0`.

`groupByOpponentRace`:

- Mantiene el orden fijo ZERG, TERRAN, PROTOSS, UNKNOWN **aunque el grupo más
  numeroso sea otro**. Es la regresión que protege contra reordenar por tamaño.
- Omite los grupos sin partidas.
- Las partidas con `opponentRace === null` caen en `UNKNOWN`.
- La suma de `played` de todos los grupos es igual al número de partidas
  recibidas: ninguna se pierde ni se cuenta dos veces.

`donutSegments`:

- Con tres resultados: se emiten tres sectores y
  `Σ(length) + 3 × DONUT_GAP === DONUT_CIRCUMFERENCE` (con tolerancia de
  coma flotante).
- Con un único tipo de resultado: **un solo sector**, `length` igual a la
  circunferencia completa y sin descontar hueco (§9-bis.4, regla 3).
- Un resultado con valor 0 no genera sector.
- Los `offset` son acumulativos y negativos.

### 12.4 `tests/ui/statistics-step.test.tsx` (nuevo)

Con `renderToStaticMarkup` y `MemoryRouter`, como
`tests/ui/guest-access.test.tsx`:

- Modo invitado (`/crear-lista`): el HTML **no** contiene «Estadísticas».
- `useListStore.setState({ remoteRevision: null })`: la pestaña no aparece.
- `useListStore.getState().setRemoteRevision(3)` con sesión autenticada: la
  pestaña aparece.

### 12.5 Regresión

`tests/i18n/resources.test.ts` debe seguir pasando tras añadir las claves.

### 12.6 Comprobaciones finales

```bash
npm run typecheck
npm test
npm run build
```

---

## 13. Plan de implementación

Orden recomendado; cada paso deja el repositorio compilando.

| # | Paso | Ficheros |
|---|---|---|
| 1 | Migración | `server/src/db/migrations/012_list_match_records.sql` |
| 2 | Esquema Zod del servidor | `server/src/modules/lists/match.schema.ts` |
| 3 | Repositorio | `server/src/modules/lists/match.repository.ts` |
| 4 | Rutas + montaje | `server/src/modules/lists/match.routes.ts`, `list.routes.ts`, `server/src/app.ts` |
| 5 | Pruebas de servidor | `tests/server/match-authorization.test.ts`, `tests/server/match-validation.test.ts` |
| 6 | Tipos y servicio HTTP del cliente | `src/auth/listService.ts` |
| 7 | Mensajes de error traducidos | `src/auth/authService.ts` |
| 8 | Traducciones | `src/i18n/locales.ts` |
| 9 | Hook de estado | `src/ui/builder/useMatchRecords.ts` |
| 10 | Agregación y geometría (funciones puras) | `src/ui/builder/matchStats.ts` |
| 11 | Pruebas de agregación | `tests/store/matchStats.test.ts` |
| 12 | Variable de color del empate | `src/styles/design-system.css` |
| 13 | Componente de donut | `src/ui/builder/MatchDonut.tsx` |
| 14 | Componente del paso | `src/ui/builder/StepStatistics.tsx` |
| 15 | Pestaña y enrutado del paso | `src/App.tsx` |
| 16 | Estilos | `src/ui/builder/builder-design.css` |
| 17 | Pruebas de interfaz | `tests/ui/statistics-step.test.tsx` |
| 18 | Documentación | `docs/07-PENDIENTE.md` (cerrar el punto), versión en `package.json` |

Los pasos 10 y 11 van antes que el componente a propósito: la agregación se
prueba aislada y el componente se limita a pintar lo que devuelven esas
funciones.

Aplicar la migración en desarrollo con:

```bash
npm run db:migrate
```

---

## 14. Criterios de aceptación

1. Con una lista **recién creada y sin guardar**, la pestaña «Estadísticas» no
   existe.
2. Al pulsar «Guardar» sobre esa lista, la pestaña aparece sin recargar la
   página.
3. Al abrir una lista desde «Mis listas», la pestaña aparece y muestra el
   historial ya registrado.
4. Registrar una partida con solo el resultado funciona y suma en el balance.
5. Registrar una partida con fecha, raza, facción y nombre del rival conserva
   los cinco datos tras recargar la página.
6. El selector de facción del rival está deshabilitado mientras no se elige raza
   y solo ofrece cartas de la raza elegida.
7. Editar y borrar una partida actualizan el balance sin recargar.
8. Registrar, editar o borrar una partida **no** activa el aviso de cambios sin
   guardar ni modifica la fecha «Actualizada» de la lista en «Mis listas».
9. La lista pública de otro usuario no muestra estadísticas por ninguna vía, y
   `GET /api/lists/<lista-ajena>/matches` responde `404`.
10. Clonar una lista pública produce una lista con el historial vacío.
11. La hoja de impresión no incluye la sección.
12. La interfaz funciona completa en español e inglés.
13. Con partidas contra dos facciones se dibujan **dos** donuts, no cuatro: las
    facciones sin partidas no aparecen.
14. Registrar una partida sin anotar la facción del rival la hace aparecer en el
    donut «Sin registrar», y la suma de partidas de todos los donuts coincide
    con el total del balance.
15. Un grupo con un único tipo de resultado (por ejemplo `3-0-0`) dibuja un
    anillo continuo, sin muesca.
16. Cada donut muestra el porcentaje **y** el marcador `V-D-E`, y su
    `aria-label` describe el reparto completo.
17. Los colores de los sectores son los mismos en una lista Zerg, Terran y
    Protoss.
18. `npm run typecheck`, `npm test` y `npm run build` pasan.

---

## 15. Extensiones preparadas (fuera de este alcance)

El modelo admite estas ampliaciones sin migrar de nuevo la estructura básica;
**no implementarlas ahora**, están anotadas para que el diseño no las cierre:

- **Notas por partida**: `notes VARCHAR(500) NULL` en `list_match_records`.
- **Columna de balance en «Mis listas»**: `GET /api/lists` devolvería un
  `matchSummary` por lista con un `LEFT JOIN` agregado; hoy no se hace para no
  encarecer la consulta del listado.
- **Escenario jugado**: `mission_card_id` / `deployment_card_id`.
- **Evolución temporal**: una serie de victorias acumuladas por fecha. Ya hay
  `played_on`; sería un gráfico de líneas, no circular.

---

## 16. Riesgos y avisos

| Riesgo | Mitigación |
|---|---|
| Meter las partidas en `payload` «porque es más rápido» | §3.1. Rompería el bloqueo optimista y filtraría datos privados al exportar y clonar. |
| Bump accidental de `revision` al registrar una partida | Regla E2 y criterio de aceptación 8. Las rutas de partidas no escriben en `saved_lists`. |
| Responder `403` en listas ajenas | Debe ser `404 LIST_NOT_FOUND`: no confirmar la existencia de listas de otros. |
| Nombre del rival como dato personal | D4 lo mantiene privado. Si algún día se publica el balance, el nombre debe quedar excluido explícitamente. |
| Fechas desplazadas un día | No usar `new Date('YYYY-MM-DD')` para mostrar; §9.4. |
| Agregados `SUM()` como cadena o `NULL` | Normalizar con `Number(x ?? 0)` en el repositorio. |
| Claves de traducción desparejadas | `tests/i18n/resources.test.ts` falla; añadir siempre es + en. |
| Usar `--text-dim` como color de empate | Queda a ΔE 5,8 del rojo bajo protanopia: indistinguible. Usar `--stat-draw` (§9-bis.3). |
| Cambiar un color del gráfico «a ojo» | Volver a ejecutar el validador de paleta con la superficie `#191d2c` antes de integrar. |
| Ordenar los donuts por número de partidas | El orden es fijo por código. Reordenarlos al registrar partidas hace perder la referencia visual entre visitas. |
| Porcentaje sin recuento absoluto | Con 2 partidas, un 50 % no es una tendencia. El marcador `V-D-E` es obligatorio (§9-bis.5). |
| `stroke-linecap="round"` en los sectores | Los extremos redondeados se comen el hueco de 2 px y falsean las proporciones. |
| Añadir una librería de gráficos | No hace falta: el donut son dos atributos SVG. Es una PWA y el bundle importa. |
