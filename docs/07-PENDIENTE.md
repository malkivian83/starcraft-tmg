# Pendiente y sin terminar

Estado a 2 de agosto de 2026. Inventario honesto de lo que falta, lo que está
a medias y lo que se dio por bueno sin verificar.

Prioridad: **A** = afecta a la corrección de las listas · **B** = afecta al uso
diario · **C** = mejora deseable.

---

## A · Datos que pueden dar listas incorrectas

### A1 · Los costes no han tenido segunda revisión humana
Todos los costes salen del reglamento §12.10 y §12.11, y coinciden con la app
de referencia en las 11 unidades que pude contrastar. **El resto no lo ha
verificado nadie.** Un coste mal transcrito produce una lista que la aplicación
declara legal y no lo es, y ninguna prueba automática puede detectarlo: el único
testigo es el PDF.

Es el riesgo número uno del proyecto y sigue abierto.

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

### B1 · Fichas de unidad sin armas ni habilidades

Inventario exacto (17 de 26 cartas están incompletas):

| Raza | Sin armas **y** sin habilidades | Solo sin armas | Solo sin habilidades |
|---|---|---|---|
| Zerg | `Kerrigan Swarm Raptor`, `Roachling`, `Omega Worm` | `Queen`, `Kerrigan` | — |
| Terran | `Raynor's Raider`, `Goliath`, `Point Defense Drone` | — | `Medic`, `Jim Raynor` |
| Protoss | — | `Praetor Guard`, `Stalker`, `Artanis`, `Pylon` | `Zealot`, `Adept`, `Sentry` |

Se puede regenerar esta tabla con:

```bash
node -e "for(const r of ['zerg','terran','protoss']){const d=require('./src/catalog/data/'+r+'.json');console.log(r,d.unitCards.filter(c=>!c.weapons.length||!c.abilities.length).map(c=>c.name).join(', '))}"
```

Salen en el resumen del PDF como una ficha con el retrato y los atributos pero
sin nada debajo. Es exactamente el fallo que se reportó con el `Swarmling`.

### B2 · Textos truncados por la extracción
Estos quedaron a medias porque el texto rotado del PDF los corta:

- `Debilitating Saliva` (Vile) — marcado en el propio catálogo como pendiente.
- `Regeneration` (Roach, Vile, Corpser) — omitida en lugar de escribir media frase.
- `Devastating Charge` de la familia Roach — cada unidad tiene un valor de
  `IMPACT` distinto, así que no se puede compartir ni deducir.

### B3 · Características sin transcribir
`Goliath` (Terran) tiene `—` en las seis características. `Jim Raynor`,
`Point Defense Drone` y `Omega Worm` tienen el tamaño sin transcribir; el
`Omega Worm` las tiene todas a `—`.

### B4 · Faltan las imágenes de carta
Solo se han recortado los **retratos de miniatura** (18 de 19 unidades; falta
`Point Defense Drone`, que no tiene página propia). No están recortadas:

- Anverso y reverso de las cartas de unidad (`imageRefFront` / `imageRefBack`).
- Cartas de facción, tácticas y Creep.
- **Diagramas de despliegue** — `imageRef` es obligatorio en el modelo y apunta
  a ficheros que no existen, así que el paso 3 muestra las cartas sin su mapa
  de marcadores. Es la ausencia más visible.

La interfaz oculta las imágenes que faltan, así que nada se rompe.

### B5 · Misiones sin condiciones de puntuación
`Hold Position`, `Frontlines` y `Supply Drop` tienen los campos de texto vacíos
(parámetros, puntuación y condiciones adicionales). Solo `Gather the Resources`
y `Divide and Conquer` están transcritas.

Los valores numéricos (suministro inicial, escalado, duración, victoria
instantánea) sí están en las cinco.

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
