# Pendiente y sin terminar

Estado a 3 de agosto de 2026. Inventario honesto de lo que falta, lo que está
a medias y lo que se dio por bueno sin verificar.

Los riesgos técnicos y de producto se identifican de forma estable como
`AUD-01`…`AUD-14` en
[`08-AUDITORIA-2026-08-03.md`](08-AUDITORIA-2026-08-03.md).

Prioridad: **A** = afecta a la corrección de las listas · **B** = afecta al uso
diario · **C** = mejora deseable.

---

## Funcionalidades cerradas en esta revisión

Estos puntos ya no deben tratarse como pendientes:

- Listas públicas privadas por defecto, consulta en solo lectura y clonación.
- Directorio de listas públicas con búsqueda, filtros por raza/escala/validez y
  ordenación por likes.
- Likes únicos por usuario y lista, con contador y retirada del like.
- Página de inicio con listas recientes propias, accesos por raza y publicaciones
  públicas recientes.
- Página de términos y condiciones enlazada desde los footers y casilla
  obligatoria en el registro. El titular es `starcraft-builder.com`.
- Previsualización de cartas tácticas en modal y ajuste responsive para móvil.
- Confirmación de cambios sin guardar al cambiar de sección del constructor y
  botón de impresión en la sección de revisión.

---

## A · Datos que pueden dar listas incorrectas

### A1 · Costes Zerg verificados; Terran y Protoss pendientes
Los costes Zerg de unidades, composiciones, mejoras, tácticas y Creep se han
contrastado con el reglamento §12.10 y §12.11 (mayo de 2026). La comprobación
queda protegida por una prueba de regresión de catálogo.

**Sigue pendiente** la misma revisión directa para Terran y Protoss. Un coste
mal transcrito produce una lista que la aplicación declara legal y no lo es.

### A2 · Bandas de suministro inventadas en dos cartas
`supplyProfile` es informativo —el motor usa el `supplyValue` de cada
composición—, pero en estas dos no salió de la carta:

| Carta | Qué se puso | Por qué |
|---|---|---|
| `protoss.card.zealot` | 1-1 → 1, 2-3 → 2 | Copiado del Praetor Guard, que comparte chasis |
| `protoss.card.zealot` (tamaño) | Size 2 | Inferido del Praetor Guard |

### A3 · Etiquetas de facción Protoss verificadas solo por página
`Praetor Guard (Zealot)` es la única unidad Protoss con la etiqueta `KHALAI`.
Se determinó buscando la palabra en el texto de cada página. En la página del
`Pylon` aparece «KHALAI» pero pertenece a la habilidad `Khalai Ingenuity`, no a
una etiqueta — comprobado. Conviene confirmarlo mirando las cartas físicas.

### A4 · Rol de combate del Zealot sin confirmar
Se puso «Damage Dealer» por ser el más frecuente. No se extrajo de la carta.

---

## B · Contenido incompleto que se nota al usar la app

### B1 · Auditoría de fases, tácticas y perfiles realizada

Se han contrastado las hojas P2P de Zerg, Terran y Protoss. La aplicación y la
hoja PDF muestran la fase de cada habilidad y mejora: **Movimiento**,
**Asalto**, **Combate** o **Cualquier fase**. Las 10 tácticas Terran y las 10
Protoss ya incluyen sus habilidades, tipo, coste de recurso y fase; además se
completaron perfiles como `Raynor's Raider`, `Goliath`, `Adept`, `Sentry` y
`Stalker`.

| Raza | Sin armas **y** sin habilidades | Solo sin armas | Solo sin habilidades |
|---|---|---|---|
| Zerg | — | `Omega Worm` (intencional) | — |
| Terran | `Point Defense Drone` (intencional) | — | `Medic`, `Jim Raynor` |
| Protoss | — | `Pylon` (estructura intencional) | — |

Se puede regenerar esta tabla con:

```bash
node -e "for(const r of ['zerg','terran','protoss']){const d=require('./src/catalog/data/'+r+'.json');console.log(r,d.unitCards.filter(c=>!c.weapons.length||!c.abilities.length).map(c=>c.name).join(', '))}"
```

Salen en el resumen del PDF como una ficha con el retrato y los atributos pero
sin nada debajo. Esta es la causa de los perfiles visualmente vacíos: la entrada
puede ser reclutable y tener costes correctos, pero su carta de referencia no
tiene contenido de reglas que mostrar.

### B2 · Características de perfil sin transcribir
Además de B1, estas cartas tienen valores literales `—` en el bloque de
características. No son ceros: son datos no transcritos y deben contrastarse
con las cartas antes de mostrarse como información fiable.

| Carta | Campos pendientes |
|---|---|
| `Goliath` | Tamaño, heridas, evasión, armadura y velocidad (todo el perfil) |
| `Jim Raynor` | Tamaño |
| `Point Defense Drone` | Tamaño y velocidad |

### B3 · Faltan las imágenes completas de carta

Están disponibles los retratos de las 26 unidades y los 10 diagramas de
despliegue. No están recortadas:

- Anverso y reverso de las cartas de unidad (`imageRefFront` / `imageRefBack`).
- Cartas de facción, tácticas y Creep.

La interfaz oculta las imágenes que faltan, así que nada se rompe.

---

## C · Funcionalidad no implementada

### C1 · Decidido y descartado
- **Asistente de draft** — el draft se resuelve en la mesa (§9.2).
- **Constructor automático de listas** — vaciaría de sentido el juego.

### C2 · Fuera del alcance de la v1, contemplado en el diseño
- Partidas por equipos (§9.1.8).
- Listas cerradas (§9.1.10).
- Acompañante de partida (heridas, recursos por ronda, puntos de victoria).

### C3 · Ideas priorizadas
Recogidas en [`05-IDEAS-MEJORA.md`](05-IDEAS-MEJORA.md). Las tres recomendadas
siguen sin hacer: «¿Qué me cabe?», control de colección y comparador de listas.

---

## Deuda técnica

### D0 · Criterios obligatorios para el contenido consultable

Las correcciones encontradas durante la revisión de cartas se consideran
requisitos de aceptación, no detalles cosméticos:

- Toda habilidad activa o reacción debe conservar su fase y su coste literal,
  incluida la unidad de recurso y los costes variables como `X CP`.
- Toda mejora debe enseñar el coste en minerales de la composición actual,
  también si es `0`.
- Las armas añadidas o reemplazadas por mejoras deben usar la tabla completa de
  armas, idéntica a la del perfil normal.
- Los perfiles con reglas en varias fases deben agruparse visualmente por fase.
- Cada miniatura debe verificarse con la carta fuente, especialmente cuando dos
  páginas comparten nombres como Marine o referencias cruzadas.

Estas comprobaciones deben incorporarse a pruebas de interfaz antes de dar una
auditoría de cartas por cerrada.

### D1 · Sin pruebas de interfaz
Hay 141 pruebas en 11 ficheros del motor, catálogo, códec de seed, store y
diagnóstico SMTP, pero **ninguna de componentes ni de extremo a extremo**.
Tampoco hay integración de API/MariaDB para autenticación, autorización o
administración. Los tres fallos que aparecieron usando la app
—cartas UNIQUE que no se podían quitar, copias que no se añadían y el coste
solapado— eran todos de interfaz y ninguno lo habría detectado el motor.

### D2 · Rutas de retrato por convención
`miniRef` se deriva del identificador de la carta en el cargador. Si el fichero
no existe se pide y da 404, y la interfaz lo oculta. Funciona, pero ensucia la
consola y no hay prueba que avise de un retrato ausente.

### D3 · Verificación cruzada reglamento ↔ cartas no automatizada
El modelo de datos (§8) la exige y no existe como script. Hoy se comprueba la
coherencia interna del catálogo, no que coincida con los PDF.

### D4 · La extracción no es reproducible de principio a fin
`makeLogo.mjs`, `makeMinis.mjs` y `samplePalette.mjs` sí lo son. La
transcripción de perfiles, habilidades y costes se hizo a mano leyendo el texto
extraído: no hay forma de regenerarla ni de detectar si un PDF nuevo cambia
algo.

### D5 · `Point Defense Drone` sin carta completa propia
El retrato existe en `public/cards/terran/mini-point_defense_drone.jpg`, pero no
tiene página de carta completa propia en la hoja P2P Terran.

### D6 · Seguridad de superadministración (`AUD-01`)

El backend concede privilegios comparando un correo fijo y no exige correo
verificado. En una instalación nueva existe riesgo de apropiación de la cuenta
administrativa. Bloquea el despliegue multiusuario hasta introducir roles
persistidos y provisión inicial fuera del registro público.

### D7 · Flujos de cuenta incompletos (`AUD-02`, `AUD-03`)

La recuperación y el reenvío de verificación ya están disponibles en la
interfaz. Siguen pendientes los límites de intentos, la auditoría del flujo y
el bootstrap seguro de SMTP para una base de datos vacía.

Un fallo SMTP ya no deja la cuenta inutilizable de forma definitiva: el panel de
superadministración permite verificarla a mano (`PUT /api/admin/users/:id/verified`)
y avisa al usuario con un correo `ACCOUNT_VERIFIED`.
Sigue siendo un rescate manual, no una solución del flujo, y **no resuelve el
arranque desde una base vacía**: si el correo del propio superadministrador
nunca llegó, `AuthGate` lo retiene en la pantalla de verificación pendiente y no
llega al panel para configurar SMTP. Sólo puede salir llamando a `/api/admin`
directamente, porque esas rutas aceptan sesiones sin verificar (ver D6).

El acceso con Google evita el problema de raíz cuando el usuario lo elige: no
necesita verificación propia ni correo saliente. No lo sustituye, porque el
registro con contraseña sigue dependiendo de SMTP.

Falta además registro de auditoría de quién verifica cada cuenta y cuándo, y
comprobación de `nonce` en el token de Google.

### D8 · Defensa y cobertura del backend (`AUD-06`, `AUD-09`)

Faltan límites de intentos, pruebas de aislamiento entre propietarios y
validación semántica de identificadores, raza y catálogo en las listas enviadas
directamente a la API.

### D9 · Migraciones y despliegue (`AUD-07`, `AUD-13`)

El ejecutor no comprueba el resultado de `GET_LOCK` y las operaciones DDL pueden
quedar aplicadas parcialmente. Plesk está acoplado a Node 22; se ha corregido la
guía para evitar instalaciones duplicadas, pero el código debe parametrizar la
ruta y disponer de rollback operativo.

### D10 · Experiencia web y accesibilidad (`AUD-04`, `AUD-05`, `AUD-08`, `AUD-10`)

- En móvil se oculta la única acción visible para cerrar sesión.
- “Nueva lista”, cambiar de raza, cargar otra lista, importar y cerrar sesión ya
  piden confirmación cuando hay cambios sin guardar, pero sólo mientras se está
  en el constructor: fuera de él la lista en edición se descarta en silencio.
- La PWA depende de la API y no soporta el modo offline que se prometía.
- Las pestañas y selecciones no comunican todo su estado a tecnologías de
  asistencia.

### D11 · Dependencias y carga inicial (`AUD-11`, `AUD-12`)

`react-router-dom` no se usa y mantiene dos avisos altos de `npm audit`. Los
tres catálogos se incluyen en un único chunk de unos 732 kB; quedan pendientes
la eliminación de la dependencia, la división por raza y la revisión de caché
de recursos PWA.

---

## Estado del contenido por raza

| | Zerg | Terran | Protoss |
|---|---|---|---|
| Unidades con coste | 10 | 6 | 6 |
| Unidades invocadas | 2 | 1 | 1 |
| Cartas de facción | 2 | 2 | 2 |
| Cartas tácticas | 9 | 10 | 10 |
| Creep Cards | 2 | — | — |
| Mejoras con texto | ✅ | ✅ | ✅ |
| Retratos de miniatura | 12/12 | 7/7 | 7/7 |
| Armas y habilidades | Parcial | Parcial | Parcial |

Escenarios: 5 misiones × 2 escalas y 10 despliegues, comunes a las tres razas.

---

## Qué haría a continuación

1. **Cerrar la autorización administrativa** (`AUD-01`); bloquea producción.
2. **Completar límites, auditoría y bootstrap SMTP** (`AUD-02`, `AUD-03`).
3. **Añadir límites y pruebas API/E2E** (`AUD-06`, D1).
4. **Endurecer migraciones y despliegue** (`AUD-07`).
5. **Corregir salida móvil y pérdida silenciosa de cambios** (`AUD-04`,
   `AUD-08`).
6. **Revisión humana de costes Terran y Protoss** (A1).
7. **Completar perfiles e imágenes completas de carta** (B1–B3).
