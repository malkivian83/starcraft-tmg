# SDD — Documento de diseño de software

Constructor de listas de ejército · StarCraft: The Miniatures Game
Versión 2.1 · Arquitectura objetivo acordada a 4 de agosto de 2026

Documento hermano: [`03-MODELO-DATOS.md`](03-MODELO-DATOS.md), que define el esquema de datos referenciado aquí.
Riesgos y desviaciones actuales:
[`08-AUDITORIA-2026-08-03.md`](08-AUDITORIA-2026-08-03.md).

---

## 1. Visión general

Aplicación web de una sola página con API propia. El catálogo y el motor se
empaquetan con el cliente, por lo que `/crear-lista` puede ofrecer públicamente
construcción, validación, formatos portables e impresión. La sesión, el perfil y
las listas guardadas dependen del backend Express y de MariaDB. JSON y seed
permiten transportar una lista, pero no sustituyen el almacenamiento remoto de
la cuenta.

**Principio rector del diseño:** el motor de reglas es una librería pura, independiente de React, del navegador y de la interfaz. Es lo único que decide si una lista es legal, y es lo único que se prueba exhaustivamente. Si esa separación se rompe, la corrección del producto deja de ser verificable.

## 2. Stack

| Capa | Tecnología | Motivo |
|---|---|---|
| Lenguaje | TypeScript (modo estricto) | El dominio tiene muchas restricciones expresables en tipos; se detectan en compilación en lugar de en la mesa de juego |
| Interfaz | React 19 | Ecosistema, componentes, conocido |
| Construcción | Vite | Arranque rápido, PWA y bundle del frontend |
| Estado | Zustand | El estado es un único documento (la lista) más el catálogo de solo lectura; no hace falta más |
| Navegación | URL pública de entrada + estado React | `/crear-lista` es pública; constructor, listas y cuenta conservan navegación interna |
| Estilos | CSS global + variables CSS | Sin framework; control de temas y hojas de impresión |
| API | Express 5 | Autenticación, perfil, administración y listas |
| Persistencia | MariaDB mediante `mysql2` | Propiedad por usuario, revisiones y migraciones |
| Sesión | JWT en cookie `HttpOnly` | Sesión corta y revocable por `session_version` |
| Correo | Nodemailer + SMTP configurable | Verificación, recuperación y diagnóstico |
| PDF | Impresión nativa | Ver §8 |
| Pruebas | Vitest | Motor, catálogo, store y diagnóstico SMTP; integración y E2E pendientes |
| Validación de datos | Zod | Un esquema, dos usos: validación en construcción del catálogo y validación de listas importadas |

Node.js 24.18.1 ya está instalado en el equipo.

## 3. Arquitectura

```
┌──────────────────────────────────────────────────────┐
│ React + Zustand                                      │
│ sesión · lista en edición · listas · cuenta · impresión│
└──────────────┬───────────────────┬───────────────────┘
               │                   │ HTTPS / JSON
┌──────────────▼─────────────┐  ┌──▼───────────────────┐
│ Motor puro + catálogo JSON │  │ API Express          │
│ validar · calcular · seed  │  │ auth · listas · admin│
└────────────────────────────┘  └──┬───────────────────┘
                                   │
                         ┌─────────▼─────────┐
                         │ MariaDB + SMTP    │
                         └───────────────────┘
```

Las dependencias apuntan siempre hacia abajo. El motor no sabe que existe React; la interfaz no reimplementa ninguna regla.

El acceso público y el autenticado comparten el mismo motor y el mismo estado de
edición, pero no las mismas capacidades:

```text
/crear-lista (público)
        |
        v
Zustand en RAM -> motor + catálogo -> validar / JSON / seed / imprimir
        |
        | iniciar sesión o registrarse sin recargar
        v
sesión verificada -> API protegida -> guardar / Mis listas / perfil
```

No existe un usuario invitado en la base de datos ni un endpoint de listas
público. La autorización de la API continúa siendo la frontera de seguridad; la
interfaz oculta capacidades para guiar al usuario, no para sustituirla.

### Estructura de carpetas

```
src/
  engine/            ← motor de reglas: TS puro, sin imports de UI
    rules/           ← R1…R10, una regla por fichero
    eligibility.ts   ← qué se puede añadir dado el estado actual
    costing.ts       ← cálculo de minerales, gas y espacios
    validate.ts      ← orquestador; devuelve ValidationResult
    types.ts
  catalog/
    schema.ts        ← esquemas Zod
    loader.ts        ← carga y valida el catálogo
    data/            ← JSON del catálogo
  store/
  auth/              ← clientes HTTP de autenticación y listas
  ui/
    builder/         ← asistente de construcción
    lists/           ← listas guardadas, públicas, likes y clonación
    account/         ← perfil, seguridad y administración
    auth/            ← acceso, registro, términos y verificación
    print/           ← vistas de impresión y PDF
    common/
server/src/
  modules/           ← auth, lists, admin y email
  middleware/        ← sesión y autorización
  db/                ← pool, migraciones y ejecutor
tools/
  extract/           ← scripts de extracción desde los PDF
  deploy-plesk.mjs   ← compilación, migración y despliegue
tests/
  engine/ · catalog/ · store/ · server/
```

## 4. Motor de reglas

### 4.1 Interfaz pública

```ts
function validateList(list: ArmyList, catalog: Catalog): ValidationResult;

function getEligibleUnits(list: ArmyList, catalog: Catalog): EligibleUnit[];
function getEligibleTacticalCards(list: ArmyList, catalog: Catalog): EligibleCard[];
function getEligibleUpgrades(entry: ListEntry, catalog: Catalog): UpgradeOption[];

function computeCosts(list: ArmyList, catalog: Catalog): CostSummary;
```

Funciones puras, sin efectos, sin estado. La misma lista y el mismo catálogo dan siempre el mismo resultado — condición para que las pruebas signifiquen algo.

`getEligible*` no solo filtra: clasifica. Devuelve cada elemento con su estado y el motivo. En unidades, el motor separa la falta de minerales (bloqueo) de la falta de espacios (estado provisional):

```ts
interface EligibleUnit {
  entry: UnitEntry;
  status: 'available' | 'provisional' | 'blocked' | 'impossible';
  constraint?: 'RACE_MISMATCH' | 'TAG_MISMATCH' | 'UNIQUE_ALREADY_INCLUDED' | 'INSUFFICIENT_MINERALS' | 'INSUFFICIENT_SLOTS';
  reason?: Localized;
  remedy?: Localized;
  compositions: Array<{ composition: Composition; status: EligibleUnit['status']; projectedSlotDeficit?: number }>;
}
```

- `available` — se puede añadir.
- `provisional` — cumple las restricciones duras y los minerales, pero al añadirla la lista tendrá un déficit de espacios. **Se puede añadir y genera R4.**
- `blocked` — no hay minerales suficientes. **Se muestra atenuada; el detalle queda en tooltip y texto accesible.**
- `impossible` — una etiqueta, raza o `UNIQUE` ya incluida impide incorporarla. **Se muestra atenuada; el detalle queda en tooltip y texto accesible, sin ocultarse.**

La UI usa `available` y `provisional` como estados accionables. Sin una Carta de Facción válida no muestra el catálogo de reclutamiento, aunque la validación final conserva R0 para listas importadas o manipuladas.

### 4.2 Reglas

Cada regla es un módulo independiente con su referencia al reglamento y sus pruebas.

| ID | Regla | Ref. | Severidad |
|---|---|---|---|
| **R1** | Σ minerales (unidades + mejoras) ≤ límite de escala | §9.1.3 | Error |
| **R2** | Σ gas (cartas tácticas) ≤ 10 % del límite de minerales | §9.1.4 | Error |
| **R3** | Toda etiqueta de una unidad o carta táctica debe aparecer en la carta de facción | §9.1.2 | Error |
| **R4** | Espacios ocupados por tipo ≤ espacios de facción + tácticas | §9.1.5 | Error |
| **R5** | Cada unidad ocupa espacios de su tipo iguales a su valor de suministro | §9.1.6 | Cálculo |
| **R6** | La composición elegida debe existir entre las opciones de la unidad | §9.1.6 | Error |
| **R7** | Cartas UNIQUE: una sola copia | §9.1.5 | Error |
| **R8** | Mejora ESPECIALISTA: un solo modelo por mejora; no repetible; especialistas distintos en modelos distintos | §9.1.7 | Error |
| **R9** | Una mejora no puede comprarse dos veces para la misma unidad | §9.1.7 | Error |
| **R10** | Las unidades invocadas no cuestan minerales ni ocupan espacios | §9.1.9 | Cálculo |
| **R11** | Zerg: exactamente una Creep Card, ni cero ni dos | `ZERG CREEP` | Error |
| **R12** | Exactamente 2 cartas de misión y 2 de despliegue, sin duplicados en el propio conjunto | §9.2 | Error |
| **R13** | Las cartas de escenario deben corresponder a la escala de la partida | §5.5, §5.6 | Aviso |

Avisos (lista legal, pero conviene saberlo):

| ID | Aviso | Ref. |
|---|---|---|
| **A1** | Minerales sin gastar (se pierden) | §9.1.3 |
| **A2** | Gas sin gastar (se pierde) | §9.1.4 |
| **A3** | Espacios de ejército sin usar (se pierden) | §9.1.5 |
| **A4** | Carta táctica comprada que no aporta espacios utilizados | — |
| **A5** | La lista no alcanza el mínimo de su escala (p. ej. 1 200 en Gran Ofensiva) | §9.1.1 |

Sobre **R3**: es de subconjunto. `tags(unidad) ⊆ tags(cartaFacción)`. El reglamento es explícito y da el contraejemplo del Kerrigan Swarm Raptor. Implementarla como intersección no vacía —el error intuitivo— haría que la app aprobara listas ilegales, que es el peor fallo posible en esta aplicación.

Sobre **R8**: el reglamento permite comprar varias mejoras SPECIALIST *distintas* en una unidad, cada una en un modelo distinto, pero prohíbe repetir la misma. Se valida como asignación inyectiva de mejoras a índices de modelo, con el índice dentro del número de modelos de la composición. La app de referencia no parece implementar esta nominación (ver [`04-ANALISIS-REFERENCIA.md`](04-ANALISIS-REFERENCIA.md) §3.1); sin ella no se puede representar ni imprimir la unidad con precisión.

Sobre **R10**: pasa de error a cálculo. Las unidades invocadas **sí** pueden añadirse a la lista —para tener sus stats a mano, decisión del usuario— pero quedan fuera del cómputo de minerales y espacios, que es lo que el §9.1.9 exige de verdad. Se marcan con `reference: true` y la hoja impresa las separa en un bloque propio.

Sobre **R12**: la restricción de no duplicar aplica **dentro del conjunto propio**; el reglamento permite expresamente que ambos jugadores lleven las mismas cartas.

Sobre **R13**: es aviso y no error porque el reglamento no lo prohíbe explícitamente, pero llevar una misión de Skirmish a una partida Standard descuadra el suministro inicial y la duración. Se avisa; decide el jugador.

Sobre **R11**: aplica solo a Zerg, y es la única regla del juego que exige un elemento en lugar de limitarlo. Cero Creep Cards es tan ilegal como dos. Por eso la interfaz le dedica un paso propio en lugar de mezclarla entre las tácticas, donde pasaría desapercibida.

### 4.3 Recálculo al cambiar la composición

Cambiar de 6 a 9 modelos altera el coste de todas las mejoras (H3 del plan) y puede invalidar alguna. El motor expone:

```ts
function recomposeEntry(entry: ListEntry, newCompositionId: string, catalog: Catalog): {
  entry: ListEntry;
  droppedUpgrades: UpgradeOption[];   // no disponibles en la nueva composición
  costDelta: number;
};
```

La interfaz muestra las consecuencias **antes** de confirmar. Cambiar la composición y perder mejoras en silencio sería una pérdida de datos del usuario.

## 5. Catálogo

### 5.1 Proceso de construcción

```
PDFs → pdftotext -layout → texto
                          ↓
              tools/extract/ (parseo asistido)
                          ↓
                  JSON borrador
                          ↓
              REVISIÓN HUMANA  ← paso obligatorio, no automatizable
                          ↓
              tools/verify/ (esquema + cruces)
                          ↓
              src/catalog/data/zerg.json
```

La revisión humana no es opcional. Un `210` transcrito como `120` produce una lista que la app declara legal y que no lo es; no hay ninguna prueba automática que lo detecte, porque el único testigo es el PDF.

Las imágenes originales de las cartas se extraen con `pdftoppm` a una página
rasterizada, se recortan por carta y se publican como WebP para las vistas de
consulta. El pipeline reproducible está en `tools/extract/makeCards.mjs` y
usa las coordenadas versionadas de `tools/extract/card-assets.manifest.json`.
La impresión existente no consume estos recortes nuevos: mantiene su flujo
HTML/CSS y sus reglas de salida.

### 5.2 Carga en la aplicación

El cargador actual importa estáticamente los catálogos Zerg, Terran y Protoss,
además del núcleo y los escenarios comunes. Todos se incluyen en el chunk
principal y se validan con Zod al cargarlos. La compilación auditada genera un
chunk de unos 732 kB (188 kB gzip); la carga dinámica por raza queda como mejora
de rendimiento, no como comportamiento implementado.

### 5.3 Cambios de versión

Al arrancar, si la `contentVersion` del catálogo empaquetado difiere de la de una lista guardada, la lista se revalida y, si cambia su legalidad o su coste, se informa al usuario con el detalle de lo que cambió. Nunca se modifica una lista sin decirlo.

## 6. Interfaz

El diseño parte del análisis de la aplicación de referencia ([`04-ANALISIS-REFERENCIA.md`](04-ANALISIS-REFERENCIA.md)): se conservan sus aciertos y se corrigen sus diez carencias (D1–D10).

### 6.1 Asistente de construcción

Cuatro pasos, alineados con las tres pestañas de la app de referencia más la revisión final.

**Paso 1 · Cartas de mando**
- Escala y límite de minerales (editable; el gas se deriva al 10 %)
- Carta de facción → espacios iniciales, etiquetas, recurso por ronda
- Cartas tácticas → gasto de gas, desbloqueo de espacios
- **Creep Card (solo Zerg)** → bloque propio y obligatorio, con aviso persistente mientras no se elija (R11)

**Paso 2 · Reclutamiento y mejoras**

Requisitos de legibilidad que se validan manualmente en interfaz:

- Las habilidades se agrupan por fase y muestran su coste junto a la unidad de
  recurso correspondiente (`CP`, `PE` o `BM`).
- Cada mejora muestra su coste de minerales para la composición activa, incluso
  cuando es `0`.
- Una mejora que concede un arma la representa en la misma tabla de armas que
  el perfil base; no se admite una versión abreviada en texto corrido.
- Las miniaturas se verifican contra la página fuente: una asignación errónea
  es un defecto de contenido, aunque la ruta del archivo exista.
- Maestro-detalle: catálogo filtrado a la izquierda, lista a la derecha
- Filtrado en dos niveles (ver §6.6)
- Mejoras por unidad, con nominación de modelo en las SPECIALIST (D2)

**Paso 3 · Misión y despliegue**
- Selección de 2 cartas de misión y 2 de despliegue (R12)
- Filtradas por la escala de la partida, con las de otra escala visibles y avisadas (R13)
- Cada carta muestra suministro inicial, escalado, duración y condiciones de victoria
- El despliegue muestra su diagrama de marcadores (imagen de la carta)

**Paso 4 · Revisión e impresión**
- Validación completa con errores y avisos
- Libro mayor de espacios (D4)
- Hoja A4, cartas y PDF

Navegación **no lineal**: se vuelve a cualquier paso conservando lo hecho. Un asistente que obliga a rehacer la lista para cambiar una carta táctica es inutilizable, porque construir una lista es iterativo por naturaleza.

Navegación **no lineal**: se puede volver a cualquier paso conservando lo hecho. Un asistente que obliga a rehacer la lista para cambiar una carta táctica es inutilizable en la práctica, porque construir una lista es iterativo por naturaleza.

### 6.2 Barra de recursos

Fija en todos los pasos. Frente a la app de referencia, que presenta ocho métricas con el mismo peso visual, aquí hay **tres niveles de jerarquía** (D6):

```
┌──────────────────────────────────────────────────────┐
│ MINERALES  1 670 / 2 000      GAS  185 / 200         │  ← primario
│ Núcleo 8/8 · Élite 2/2 · Apoyo 2/3 · Aéreo 0/1 · Héroe 1/1 │  ← primario
│ BM 7  ·  Suministro 9                                 │  ← secundario
└──────────────────────────────────────────────────────┘
```

- **Crítico** — excesos de presupuesto o espacios, y errores de regla. Color de alerta, imposible de pasar por alto.
- **Primario** — minerales, gas y espacios. Es lo que se consulta constantemente.
- **Secundario** — recurso por ronda y suministro total. Informativo, no restrictivo.

Los espacios se muestran solo para los tipos que la facción o las tácticas otorgan, **incluido AIR** (D1). Un tipo con cero espacios totales no ocupa sitio en la barra.

En escritorio, cabecera fija. En móvil, barra inferior contraíble.

### 6.3 Adaptación a móvil

| Aspecto | Escritorio | Móvil |
|---|---|---|
| Navegación | Pasos laterales | Pestañas inferiores |
| Selección de unidad | Rejilla con panel de detalle | Lista con hoja deslizante |
| Recursos | Panel lateral fijo | Barra inferior contraíble |
| Mejoras | Dos columnas | Acordeón por unidad |

Ancho mínimo objetivo: 360 px. Sin pérdida de funcionalidad respecto a escritorio (CA-14.3).

### 6.4 Errores y avisos

Los errores se presentan siempre con: qué regla se incumple, su referencia al reglamento, a qué unidad afecta y qué hacer (D3). La interfaz nunca muestra un error sin remedio accionable.

> ⛔ **No caben más unidades de Élite.** El Hydralisk de 4 modelos ocupa 3 espacios de Élite y solo tienes 2 libres.
> *Solución:* compra `Hydralisk Den` (35 gas, +2 Élite) o elige la composición de 2 modelos, que ocupa 2.

Comparado con la app de referencia, que simplemente no deja añadir la unidad sin explicar nada, esto evita tener que volver al PDF — que es el propósito de la aplicación.

### 6.5 Libro mayor de espacios (D4)

En el paso de revisión, tabla por tipo de espacio:

| Núcleo | |
|---|---|
| Zerg Swarm (facción) | +3 |
| Spawning Pool | +1 |
| Evolution Chamber | +1 |
| **Total** | **5** |
| Zergling ×12 | −1 |
| Roach ×3 | −1 |
| **Libres** | **3** |

Responde de un vistazo qué carta aporta cada espacio y qué unidad lo consume, sin obligar al usuario a hacer aritmética.

### 6.6 Estados del catálogo de unidades

Tras elegir una Carta de Facción válida se muestran todas las unidades de la raza. El estado se evalúa por composición y sigue esta precedencia: raza y etiquetas, `UNIQUE`, minerales y, por último, espacios. La falta de espacios no bloquea la planificación: se calcula el déficit proyectado después de la incorporación y se marca la composición como `provisional`.

Ejemplo del comportamiento resultante en una lista `Zerg Swarm`:

| Unidad | Estado | Motivo |
|---|---|---|
| `Zergling` | Disponible | — |
| `Hydralisk` (4 modelos) | Provisional, accionable | Después faltarán 2 espacios de Élite |
| `Kerrigan Swarm Raptor` | Visible, deshabilitada | Etiqueta `Kerrigan's Swarm` ausente en la carta de facción |
| `Kerrigan` | Visible, deshabilitada | Ya incluida y es UNIQUE |

El store vuelve a evaluar la misma política al ejecutar `addUnit` y `addReferenceUnit`; la interfaz no es una frontera de seguridad. El modal de Revisión se abre solo cuando el paso pasa de no visible a visible y `validation.errors` no está vacío. El panel persistente continúa mostrando errores y avisos.

### 6.7 Barra de recursos siempre visible

Requisito explícito. La barra de la cabecera **nunca se oculta ni se desplaza fuera de vista** en ningún paso ni en ninguna anchura de pantalla:

- Escritorio: cabecera fija (`position: sticky`), siempre en pantalla al desplazar.
- Móvil: barra inferior fija. Se puede contraer al detalle secundario, pero **minerales, gas y espacios permanecen visibles siempre**; nunca se colapsa por completo.
- Los contadores de espacios se muestran para todos los tipos que la lista otorga, incluido AIR.

### 6.8 Regla de idioma en la interfaz

La interfaz admite español e inglés. El idioma se resuelve, por este orden,
desde la ruta (`/es` o `/en`), la preferencia guardada del perfil, el selector
local del navegador y español como último respaldo. Las rutas antiguas sin
prefijo se redirigen a la variante española equivalente.

Los nombres propios (`ProperName` en el modelo) se muestran **siempre en
inglés**; se traducen la interfaz, los textos explicativos, errores, soporte,
administración y términos estructurales. Un chip de mejora se lee `+ Adrenal
Glands (+20)` en ambos idiomas, mientras que su descripción usa el campo
`Localized` activo. Palabras clave como `SPECIALIST` o `LONG RANGE (18")` se
mantienen en inglés porque son términos de regla impresos en las cartas.

### 6.9 Modo invitado y capacidades

La URL pública `/crear-lista` abre únicamente el constructor. El modo no se
modela como una cuenta ficticia: es una política de capacidades sobre el mismo
editor que usa un usuario autenticado.

| Capacidad | Invitado | Usuario autenticado y verificado |
|---|---:|---:|
| Crear, editar y validar | Sí | Sí |
| Importar/exportar JSON | Sí | Sí |
| Generar/importar seed | Sí | Sí |
| Imprimir o guardar como PDF | Sí | Sí |
| Guardar remotamente | No | Sí |
| Abrir «Mis listas» | No | Sí |
| Abrir el perfil | No | Sí |

Las acciones no autorizadas no se renderizan para el invitado y sus manejadores
deben comprobar también la capacidad antes de llamar al cliente HTTP. Esta doble
comprobación evita llamadas accidentales, mientras que el middleware del
servidor mantiene la garantía real frente a peticiones manipuladas.

Al pasar del constructor al acceso o registro se mantiene la misma instancia de
la lista en Zustand. Una autenticación completada habilita el guardado de ese
borrador, pero no lo envía automáticamente. Recargar, cerrar la pestaña o salir
del flujo antes de guardarlo destruye el estado; la interfaz debe advertirlo.

## 7. Persistencia

| Almacén | Contenido |
|---|---|
| MariaDB `saved_lists` | Payload de listas, propietario y revisión |
| MariaDB `users`/`profiles` | Identidad, proveedor de acceso (`password_hash`, `google_sub`), estado, versión de sesión y preferencias |
| MariaDB `account_tokens` | Tokens de verificación y recuperación, almacenados como hash |
| MariaDB `app_settings` | Configuración SMTP cifrada |
| MariaDB `email_delivery_logs` | Resultado de los intentos de correo |
| Estado Zustand | Sesión y lista que se está editando; no es persistencia durable |

La API obtiene siempre el propietario desde la sesión y usa `revision`/`If-Match`
para evitar una sobrescritura silenciosa. El servidor valida hoy la estructura
del payload, pero aún debe validar referencias de catálogo y coherencia de raza.

Exportación: JSON con la lista más su `catalogContentVersion`. La importación
valida el esquema y vuelve a calcular costes y legalidad en el cliente.

El borrador invitado reside exclusivamente en el estado Zustand de la ejecución
actual. No se escribe automáticamente en `localStorage`, `sessionStorage`,
IndexedDB ni MariaDB. Exportar JSON, copiar un seed o guardar la impresión como
PDF son acciones explícitas del usuario y no cambian este ciclo de vida.

El estado debe sobrevivir al cambio interno de invitado a las pantallas de
autenticación para que pueda guardarse después, siempre que la SPA no se
recargue. La primera escritura remota ocurre únicamente al pulsar «Guardar» con
una sesión válida.

### 7.1 Sesión y autorización

- Contraseñas con Argon2id. Una cuenta creada con Google no tiene contraseña
  hasta que su titular decide añadirla.
- El ID token de Google se valida con `google-auth-library` y se exige
  `email_verified`; la sesión que se emite después es la propia de la
  aplicación, igual que en el acceso con contraseña.
- JWT de 15 minutos en cookie `HttpOnly`, `SameSite=Lax`, `Secure` en
  producción y ruta `/api`.
- `session_version` revoca sesiones al cambiar contraseña, desactivar o borrar
  una cuenta.
- Tokens de cuenta aleatorios de 32 bytes, almacenados como SHA-256, de un solo
  uso y con caducidad de 30 minutos.
- Consultas parametrizadas y propiedad de listas filtrada en el servidor.
- El superadministrador puede verificar o desverificar un correo a mano
  (`PUT /api/admin/users/:id/verified`), sin token y sin poder aplicarlo a su
  propia cuenta. Es la vía de rescate cuando el correo de verificación no llega.
  Verificar una cuenta que no lo estaba envía el aviso `ACCOUNT_VERIFIED` al
  usuario; el fallo de ese envío se devuelve como advertencia y no revierte la
  verificación.

Deuda abierta: roles administrativos persistidos, verificación obligatoria para
administrar, límites de intentos, recuperación completa en el frontend,
reenvío de verificación, auditoría de las verificaciones manuales y pruebas de
integración de estas garantías.

### 7.2 Códec de seed (compartir por código)

Además del fichero JSON, una lista se puede exportar como **seed**: una cadena corta que la codifica por completo y que se comparte pegándola en un chat.

```
SCT1-K7M2P-Q4XR9-B3NF6-W8HD2
```

**El seed contiene la lista, no la referencia.** Aunque existe un servidor, el
formato se mantiene autocontenido para compartir y conservar una lista sin
depender de permisos, del identificador remoto o de la vida del servicio.

**Formato:**

| Campo | Contenido |
|---|---|
| Prefijo | `SCT1` — versión del formato de seed |
| Cabecera | Versión de catálogo, raza, límite de minerales |
| Cuerpo | Índices numéricos de carta de facción, tácticas, creep, unidades con composición y mejoras, misiones y despliegues |
| Cola | Suma de verificación |

Codificación: enteros de longitud variable → deflate (`fflate`, síncrono) → Base32 de Crockford, que evita los caracteres ambiguos (`I`, `L`, `O`, `U`) y así se puede dictar en voz alta sin errores.

La compresión solo se aplica **si reduce el tamaño**: en listas pequeñas la cabecera de deflate pesa más que lo que ahorra. El modo elegido va en el primer byte.

Tamaños medidos (`tests/engine/seed-size.test.ts`, se comprueban en cada ejecución):

| Lista | Caracteres |
|---|---|
| Zerg pequeña (2 unidades) | 80 |
| Ejemplo del manual (9 unidades, 6 tácticas) | 144 |
| Terran grande (5 unidades, 8 mejoras) | 168 |

Cómodo para copiar y pegar; una lista completa es demasiado larga para dictarla entera, aunque el alfabeto lo permita para códigos cortos.

**El detalle crítico: índices estables.**

El seed guarda **números**, no identificadores de texto, porque es lo que lo hace corto. Eso significa que cada elemento del catálogo necesita un número que **no cambie nunca**:

```ts
interface UnitEntry {
  id: string;        // "zerg.entry.swarmling"
  seedId: number;    // 47 — asignado una vez, jamás reutilizado ni reordenado
  // …
}
```

Si `seedId` se derivase del orden del fichero JSON, añadir una unidad nueva en medio desplazaría todos los índices posteriores y **cada seed compartido hasta ese momento pasaría a decodificar unidades equivocadas, en silencio y sin error**. Es el fallo más grave que puede tener esta funcionalidad: no revienta, miente. Por eso `seedId` se asigna explícitamente en el catálogo, la validación comprueba que sea único y que ningún elemento eliminado libere su número para otro.

**Cambios de catálogo.** El seed lleva la versión de catálogo con la que se creó. Al importar:

- Misma versión → decodificación directa.
- Versión distinta pero todos los `seedId` existen → se importa y se avisa de los costes que hayan cambiado.
- Algún `seedId` ya no existe → se importa lo decodificable y se detalla qué falta, en lugar de rechazar la lista entera.

**Suma de verificación.** Un seed pegado a medias o con un carácter cambiado se detecta al importar y se rechaza con un mensaje claro. Sin ella, un seed corrupto produciría una lista plausible pero incorrecta — de nuevo, el fallo silencioso.

```ts
function encodeSeed(list: ArmyList, catalog: Catalog): string;
function decodeSeed(seed: string, catalog: Catalog): SeedDecodeResult;

interface SeedDecodeResult {
  list: ArmyList | null;
  status: 'ok' | 'version_mismatch' | 'partial' | 'corrupt';
  missing: string[];              // seedIds no encontrados
  changed: { id: string; field: string; from: number; to: number }[];
}
```

Propiedad que debe cumplirse y se prueba con generación aleatoria: `decodeSeed(encodeSeed(l)) === l` para cualquier lista válida.

La sincronización con cuenta ya está implementada. El `id` estable identifica la
lista y la revisión remota detecta conflictos entre sesiones.

## 8. Impresión y PDF

Tres salidas, según lo decidido:

**Hoja resumen A4** — hoja de lista para la mesa: encabezado con nombre y escala, carta de facción con sus espacios, cartas tácticas con su gas, tabla de unidades (composición, suministro, tipo de espacio, minerales, mejoras por modelo) y pie con el desglose de recursos. Legible en blanco y negro.

**Cartas de las unidades** — las cartas de las unidades incluidas en la lista, anverso y reverso, en disposición apta para recortar.

**Exportación a PDF** — descarga del mismo contenido.

La impresión no se bloquea cuando la lista es inválida. Tanto invitados como
usuarios autenticados pueden continuar, pero la hoja muestra un aviso visible
de «LISTA NO VÁLIDA» para que el documento no pueda confundirse con una lista
legal.

### Implementación (Q12 resuelta: recortes en inglés)

Las cartas se imprimen como **imagen original recortada del PDF**, sin regenerarlas. Esto simplifica sustancialmente la fase:

```
PDF de cartas → pdftoppm -r 216 -png → página completa
              → recorte por carta (coordenadas fijas, rejilla A4)
              → WebP por carta, anverso y reverso
              → public/cards/
```

Las hojas de cartas son A4 con disposición regular y marcas `fold here`, así que el recorte se parametriza una vez por PDF y se aplica a todas las páginas. Un contacto visual de todas las cartas recortadas permite verificar el resultado de un vistazo.

Consecuencia técnica: **no hace falta `@react-pdf/renderer`**. Basta `@media print` sobre HTML y `window.print()`, que en cualquier navegador moderno permite «Guardar como PDF». Menos dependencias, menos peso y salida idéntica a lo que se ve en pantalla.

La hoja resumen A4 se genera en el idioma activo; las imágenes de las cartas y
los PDF fuente quedan en su inglés original.

Las imágenes de cartas se cargan de forma diferida y se cachean bajo demanda.
El logo y los emblemas de facción no están incluidos expresamente en esa regla
de caché y deben revisarse si se decide soportar un modo offline real.

## 9. Listas públicas, likes y términos

Las listas públicas siguen protegidas por `requireVerifiedUser`: el acceso no
es anónimo, aunque la lista se pueda consultar en modo solo lectura. El
propietario cambia `isPublic` desde el editor; otros usuarios solo pueden
abrirla, darle o quitarle un like y clonarla como una lista propia.

El API devuelve el contador y el estado del usuario (`likeCount` y
`likedByCurrentUser`). La tabla `saved_list_likes` usa una clave primaria
compuesta `(list_id, user_id)` para impedir duplicados. La página pública aplica
los filtros en cliente y ofrece el orden «Más valoradas» por ese contador.

Las rutas localizadas `/es/terminos-y-condiciones` y
`/en/terms-and-conditions` se sirven desde `AuthGate` antes de exigir sesión.
El footer y el registro enlazan con ellas; la casilla de aceptación es
obligatoria y se registra junto con la versión, idioma y origen de aceptación.

## 10. PWA y despliegue

`vite-plugin-pwa` genera manifest, service worker y caché de la interfaz. La PWA
es instalable y el constructor público no depende de endpoints de listas, pero
no se garantiza funcionamiento íntegro sin conexión. La restauración de sesión,
el perfil y el acceso a listas remotas requieren la API, y el borrador invitado
en RAM no sobrevive a una recarga.

El alojamiento debe aplicar fallback de SPA para las rutas localizadas de la
SPA (incluido `/es/crear-lista` y `/en/create-list`), excluyendo `/api` y los
recursos estáticos reales. Las rutas antiguas se mantienen como redirecciones
de compatibilidad.

El despliegue vigente usa Plesk: Vite produce `dist/`, TypeScript produce
`server/dist/`, `app.js` carga la API y MariaDB conserva los datos. Consulta
[`../PLESK_DEPLOYMENT.md`](../PLESK_DEPLOYMENT.md).

## 11. Plan de pruebas

| Nivel | Alcance | Herramienta |
|---|---|---|
| Unitario | Cada regla R1–R13 y aviso A1–A5, con casos límite | Vitest |
| Datos | Esquema del catálogo, integridad referencial, cruce reglamento ↔ cartas | Vitest + Zod |
| Regresión | Lista del manual §9.1: 1 670 minerales, 185 gas, 8/8 Núcleo, 2/2 Élite, 2/3 Apoyo, 1/1 Héroe, 0/1 Aéreo | Vitest |
| Componentes | Interacciones del asistente | **Pendiente** |
| Propiedades | `decodeSeed(encodeSeed(l)) === l` con listas generadas aleatoriamente; corrupción detectada siempre | Vitest + fast-check |
| API/BD | Autenticación, autorización, conflictos y administración | **Pendiente** |
| Extremo a extremo | Invitado, transición a cuenta, registro, verificación, listas, cuenta e impresión | **Pendiente** |
| Impresión | Salida A4 sin elementos de interfaz y legible en gris | Revisión manual |

El caso de regresión del manual es la prueba más valiosa del proyecto: es el único punto donde una fuente externa e independiente confirma que datos y reglas son correctos a la vez.

## 12. Decisiones de diseño y sus motivos

| Decisión | Motivo | Alternativa descartada |
|---|---|---|
| Motor puro separado de React | Permite probar la corrección sin renderizar; es lo que hace verificable el producto | Validar dentro de los componentes |
| Backend propio | Cuentas, propiedad de listas y sincronización entre dispositivos | Persistencia solo local |
| Invitado como política de capacidades | Comparte editor y motor sin crear identidad ni endpoints públicos | Usuario invitado ficticio en la base de datos |
| Borrador invitado sólo en RAM | Evita persistencia implícita y mantiene explícitos JSON, seed y PDF | Guardado automático local |
| Catálogo JSON versionado y empaquetado | Motor reproducible y seed estable sin una API de catálogo | Catálogo servido desde una API |
| `UnitCard` separado de `UnitEntry` | Las variantes de cepa lo exigen; el patrón se repite en Terran | Entidad única con costes opcionales |
| Coste de mejora por composición | Es como está definido en el reglamento | Coste escalar por mejora |
| Nada derivado se persiste | Un fichero editado a mano no puede mentir sobre su legalidad | Guardar totales en la lista |
| Español con original en inglés visible | Las cartas físicas están en inglés; sin el original, contrastar es incómodo | Traducción pura |

## 13. Fuera de alcance en esta versión

Partidas por equipos (§9.1.8), listas cerradas (§9.1.10), seguimiento de partida,
colaboración en tiempo real, perfiles públicos y funcionamiento offline con
sincronización diferida.
