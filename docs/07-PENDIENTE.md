# Pendiente y sin terminar

Estado a 2 de agosto de 2026. Inventario honesto de lo que falta, lo que está
a medias y lo que se dio por bueno sin verificar.

Prioridad: **A** = afecta a la corrección de las listas · **B** = afecta al uso
diario · **C** = mejora deseable.

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

### B3 · Faltan las imágenes de carta
Solo se han recortado los **retratos de miniatura** (18 de 19 unidades; falta
`Point Defense Drone`, que no tiene página propia). No están recortadas:

- Anverso y reverso de las cartas de unidad (`imageRefFront` / `imageRefBack`).
- Cartas de facción, tácticas y Creep.
- **Diagramas de despliegue** — `imageRef` es obligatorio en el modelo y apunta
  a ficheros que no existen, así que el paso 3 muestra las cartas sin su mapa
  de marcadores. Es la ausencia más visible.

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
Hay 110 pruebas del motor, el catálogo y el códec de seed, pero **ninguna de
componentes ni de extremo a extremo**. El SDD las contempla (Testing Library y
Playwright) y no se han escrito. Los tres fallos que aparecieron usando la app
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

### D5 · `Point Defense Drone` sin retrato
No tiene página de carta propia en la hoja P2P Terran.

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
| Retratos de miniatura | 12/12 | 6/7 | 7/7 |
| Armas y habilidades | Parcial | Parcial | Parcial |

Escenarios: 5 misiones × 2 escalas y 10 despliegues, comunes a las tres razas.

---

## Qué haría a continuación

1. **Completar armas y habilidades** de las cartas de B1. Es lo que más se nota
   y lo que motivó el aviso del `Swarmling`.
2. **Recortar los diagramas de despliegue** (B4). Sin ellos el paso 3 está a
   medias, y son datos que no se pueden transcribir a texto.
3. **Revisión humana de los costes** (A1). El riesgo mayor, y el único que no
   se puede cerrar sin ti.
4. **Pruebas de extremo a extremo** (D1). Los fallos que has encontrado usando
   la aplicación eran todos de interfaz.
