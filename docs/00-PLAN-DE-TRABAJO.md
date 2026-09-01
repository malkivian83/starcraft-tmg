# Plan de trabajo — Constructor de listas de ejército · StarCraft: The Miniatures Game

Versión 4 · Estado actualizado tras la auditoría funcional del 3 de agosto de 2026.

Este documento conserva el razonamiento y los hallazgos de extracción, pero su
plan de ejecución original ya no representa la arquitectura vigente. El estado
operativo se resume aquí y los riesgos actuales están en
[`08-AUDITORIA-2026-08-03.md`](08-AUDITORIA-2026-08-03.md).

---

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Stack | React + TypeScript + Vite; API Express y MariaDB |
| Alcance actual | Construcción, validación, impresión, cuentas, listas remotas y directorio público |
| Persistencia | MariaDB por cuenta; JSON y seed como formatos portables |
| Contenido | Cartas completas (texto e imágenes); listas privadas o públicas bajo control del propietario |
| Idioma | **Español e inglés; nombres propios siempre en inglés** |
| Razas | Zerg, Terran y Protoss implementadas |
| Impresión | Hoja resumen A4 + cartas de las unidades + exportación a PDF |
| Cartas impresas | **Recorte de la imagen original en inglés** del PDF |
| Versión de reglas | Los PDFs actuales (`May 2026, v.1.0`) son la fuente vigente |
| PWA | Instalable; el acceso autenticado requiere conexión con la API |

### Regla de idioma (Q11 resuelta; ampliada a interfaz bilingüe)

Se traduce **lo que explica**, no **lo que nombra**:

| Elemento | Idioma | Ejemplo |
|---|---|---|
| Nombre de unidad | Inglés | `Hydralisk`, `Swarmling (Zergling)` |
| Nombre de habilidad | Inglés | `Burrow Ambush`, `Adrenal Glands` |
| Nombre de arma | Inglés | `C-14 Rifle`, `Needle Spines` |
| Nombre de carta | Inglés | `Spawning Pool`, `Malignant Creep` |
| Palabra clave de regla | Inglés | `SPECIALIST`, `LONG RANGE (18")` |
| **Texto de efecto** | Idioma activo (`es`/`en`) | «Esta unidad sufre DAÑO NO LETAL (2)…» / “This unit suffers…” |
| **Interfaz de la app** | Idioma activo (`es`/`en`) | Menús, botones, errores, avisos |
| **Términos estructurales** | Idioma activo (`es`/`en`) | Minerales/Minerals, Suministro/Supply, Núcleo/Core |

El español es la base y el selector permite cambiar a inglés. Las rutas se
prefijan con `/es` o `/en`; las rutas antiguas sin prefijo redirigen al idioma
preferido. Cualquier nombre que veas en la app se conserva tal cual en las
cartas físicas y en los PDFs, mientras que los textos explicativos se sirven en
el idioma activo. Elimina el glosario de traducción de nombres, que era el punto
más discutible del plan anterior.

### Supuesto que mantengo

**Acceso autenticado.** La aplicación y el directorio de listas requieren sesión. Una lista puede marcarse como
pública para que otros usuarios autenticados la consulten y la clonen, sin editar el original.

---

## Estado del entorno

Completado:
- Node.js 24.18.1 + npm instalados.
- Poppler 25.07 instalado (`pdftotext`, `pdftoppm`, `pdfimages`).
- Texto de los 4 PDFs extraído y verificado.

---

## Hallazgos de la extracción (condicionan el diseño)

### H1 — Los datos están en dos fuentes que hay que cruzar

| Dato | Fuente |
|---|---|
| Coste en minerales, opciones de composición, valor de suministro | Reglamento §12.10 |
| Coste de mejoras (por opción de composición) | Reglamento §12.10 |
| Coste en gas de cartas tácticas | Reglamento §12.11 |
| Perfil de juego, armas, habilidades | Hojas de cartas por raza |
| Etiquetas de facción, tipo de espacio, rol de combate | Hojas de cartas por raza |
| Espacios que otorga cada carta de facción/táctica, marca UNIQUE | Hojas de cartas por raza |

**Las hojas de cartas no contienen ningún coste en minerales.** El cruce entre ambas fuentes se hace por nombre de unidad y es el punto más frágil del proceso: requiere verificación explícita.

### H2 — Existen variantes de unidad

El apéndice de puntos lista entradas como `RAPTOR (ZERGLING)`, `KERRIGAN SWARM RAPTOR (ZERGLING)`, `SWARMLING (ZERGLING)` y `RAYNOR'S RAIDERS (MARINE)`. Comparten el perfil de la carta base pero difieren en etiquetas, costes y composiciones disponibles.

Consecuencia: el modelo separa **UnitCard** (perfil de juego) de **UnitEntry** (entrada reclutable con sus tags y costes). Es la decisión de modelado más importante del proyecto; hacerlo mal obliga a rehacerlo entero más tarde.

### H3 — El coste de una mejora depende de la composición elegida

`Combat Shield` cuesta 20 en una unidad de 6 Marines y 30 en una de 9. El coste de mejora **no** es un escalar: es una tabla indexada por opción de composición.

### H4 — La regla de etiquetas es de subconjunto, no de intersección

Reglamento §9.1.2: *toda* etiqueta de la unidad o carta táctica debe aparecer también en la Carta de Facción. El propio manual da el contraejemplo: un `Kerrigan Swarm Raptor` (etiquetas `Zerg`, `Kerrigan's Swarm`) **no** es elegible con una carta de facción cuya única etiqueta es `Zerg`, aunque compartan `Zerg`.

Esto corrige el supuesto inicial de «que coincidan las etiquetas». Implementado como intersección, la app daría por legales listas ilegales.

### H5 — Las cartas tácticas pueden repetirse salvo que sean UNIQUE

En el ejemplo del manual conviven `Barracks` y `Barracks (Proxy)` como cartas distintas. Las marcadas `UNIQUE` admiten una sola copia. Algunas cartas (p. ej. los Creep Cards Zerg) otorgan `SUPPLY: -`, es decir, ningún espacio.

### H6 — Volumen de datos a transcribir (Zerg, fase 1)

- 10 cartas de unidad, con perfiles de ataque y habilidades.
- 2 cartas de facción (Zerg Swarm, Kerrigan's Swarm).
- ~11 cartas tácticas + 2 Creep Cards.
- Entradas de puntos con variantes de cepa (strain) por unidad.

### H7 — Existe un tercer tipo de carta: CREEP CARD (solo Zerg)

`Accelerating Creep` (0 gas) y `Malignant Creep` (10 gas) están marcadas como `CREEP CARD`, no como `TACTICAL CARD`. Ambas cartas de facción Zerg incluyen la habilidad `ZERG CREEP`:

> *During Army Building, select exactly one Creep Card and add it to their Army List, paying its listed cost (if any).*

Es **obligatorio y exactamente uno**: ni cero ni dos. No otorgan espacios de ejército. Se paga con gas vespeno como las tácticas.

Consecuencia: `CreepCard` es una entidad propia y aparece la regla **R11**. Que esto surgiera justo en la raza con la que empezamos confirma que el orden Zerg → Terran → Protoss era el correcto: es el caso más complejo de los tres y valida el modelo antes de escalar.

### H8 — Los recursos por ronda se acumulan

Tanto la carta de facción como las tácticas aportan recurso por ronda (`+1 CP`, `+2 CP`, `+1 BM`). El total es la suma de todas las cartas incluidas, y es un dato que el jugador quiere ver al construir. No es una restricción — no hay límite — pero sí un indicador de calidad de la lista.

---

## Estado de las fases

### Fase 1 — Documentación: completada y en mantenimiento

| Documento | Contenido | Estado |
|---|---|---|
| `01-PRD.md` | Requisitos, historias de usuario, criterios de aceptación | ✅ |
| `02-SDD.md` | Arquitectura, motor de reglas, impresión, pruebas | ✅ |
| `03-MODELO-DATOS.md` | Esquema del catálogo y de las listas | ✅ |
| `04-ANALISIS-REFERENCIA.md` | Análisis de la app existente y decisiones de diseño D1–D10 | ✅ |
| `08-AUDITORIA-2026-08-03.md` | Contraste de funcionalidades implementadas y pendientes | ✅ |

Ya no hace falta un glosario de traducción de nombres: al mantenerlos en inglés, solo se traducen los términos estructurales, que son una veintena y están recogidos en la tabla de la regla de idioma.

### Fase 2 — Catálogo Zerg: implementada

El catálogo, sus esquemas y las pruebas de integridad están implementados. La
revisión humana de costes sigue siendo un control editorial obligatorio.

### Fase 3 — Motor de reglas: implementada

Librería pura de TypeScript, sin dependencias de interfaz, con reglas R1–R13,
avisos y caso de regresión de la lista del manual.

### Fase 4 — Interfaz de construcción: implementada con deuda UX

Asistente de cuatro pasos, barra de recursos, escritorio y adaptación móvil.
La prevención de descartes accidentales y la previsualización de cartas desde
las pantallas de selección están implementadas; las imágenes originales se
consultan en un modal accesible y no aparecen en impresión. Quedan pendientes
la semántica accesible de pestañas y una acción visible para cerrar sesión en
móvil.

### Fase 5 — Persistencia y consulta: parcial

Las listas se guardan en MariaDB por usuario y se pueden importar/exportar como
JSON o seed. Las listas públicas tienen página propia con búsqueda, filtros,
ordenación, clonación y likes por usuario. La búsqueda avanzada del catálogo
de cartas sigue pendiente.

### Fase 6 — Impresión y PDF: implementada

La hoja resumen se genera con CSS de impresión y el navegador permite guardarla
como PDF. Las imágenes originales completas para consulta ya están extraídas
desde las hojas A4 y se muestran desde los catálogos de selección; esta mejora
no altera la hoja ni el flujo de impresión.

### Fase 7 — PWA y despliegue: parcial

La PWA es instalable y existe un flujo de despliegue de frontend, backend y
migraciones en Plesk. No hay modo offline soportado porque la restauración de
sesión y las listas dependen de la API.

### Fase 8 — Terran y Protoss: implementada

Ambos catálogos están cargados y cubiertos por pruebas de integridad. Continúa
pendiente una segunda revisión humana de costes y algunos perfiles indicados en
`07-PENDIENTE.md`.

### Fase 9 — Cuentas, API y listas sincronizadas: parcial

Registro, acceso con contraseña o con Google, verificación —por token o
manualmente desde el panel de superadministración—, recuperación, reenvío de
verificación, términos legales, perfiles, listas remotas, visibilidad pública,
clonación, likes, control de propietario, administración y SMTP están
implementados. Antes de producción deben corregirse el modelo de
superadministración, los límites de intentos y la cobertura de integración.

---

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Error de transcripción en un coste o suministro | Listas ilegales dadas por válidas. Fallo silencioso, el peor tipo | Validación por esquema + verificación cruzada + revisión humana + casos de regresión del manual |
| El cruce por nombre entre reglamento y cartas falla | Unidades sin coste o sin perfil | Script que reporta huérfanos en ambos sentidos; ninguna unidad entra al catálogo sin ambas caras |
| Traducción inconsistente | Confusión al contrastar con las cartas físicas en inglés | Glosario canónico + original en inglés visible |
| Erratas y nuevas versiones del juego | Listas guardadas dejan de ser válidas | Catálogo versionado; las listas guardan la versión con la que se crearon y avisan al cambiar |
| Las variantes de cepa complican el modelo | Retrabajo | Resuelto por diseño (H2) antes de escribir código |

---

## Preguntas resueltas

- **Q9 — Vigencia.** Los PDFs actuales son la fuente válida. ✅
- **Q11 — Traducción.** Nombres en inglés, textos explicativos en español. ✅
- **Q12 — Cartas impresas.** Recorte de la imagen original en inglés. ✅ Simplifica notablemente la Fase 6: no hay que regenerar cartas, basta extraerlas con `pdftoppm` y componerlas para impresión.

- **Q13 — Misiones y despliegue.** Entran en la v1. ✅
- **Q14 — Unidades invocadas.** Se pueden añadir a la lista para tener sus stats a mano, pero **sin computar minerales ni ocupar espacios** (§9.1.9). ✅

## Hallazgos sobre escenarios (misiones y despliegue)

### M1 — Las cartas de escenario son comunes a las tres razas

La sección `SCENARIO CARDS - MISSION & DEPLOYMENT` es **idéntica en los tres PDFs de cartas**. No dependen de la raza.

Consecuencia: un único fichero `scenarios.json` compartido, no uno por raza. Y disponible desde la v1 aunque solo tengamos el catálogo Zerg, porque no depende de él.

### M2 — Cada misión existe en dos variantes de escala

`Gather the Resources` tiene versión **Standard** (6 de suministro inicial, +2 por ronda, 5 rondas, victoria instantánea a 10+ PV) y versión **Skirmish** (3 de suministro, +1 por ronda, victoria a 8+ PV). Misma misión, valores distintos.

Consecuencia de modelo: la variante de escala es parte de la identidad de la carta, igual que las variantes de cepa en las unidades (H2). Se repite el mismo patrón, así que se resuelve igual.

Misiones identificadas (5): `Hold Position`, `Frontlines`, `Gather the Resources`, `Divide and Conquer`, `Supply Drop`.

### M3 — Los despliegues están ligados al tamaño de mesa

10 cartas de despliegue en dos tamaños:

| 36×36″ (Skirmish) | 54×36″ (Standard) |
|---|---|
| Abandoned Camp | Gauntlet |
| Agria Valley | Typhoon |
| Dirt Side | Acropolis |
| Frontier | Proving Grounds |
| Char Plains | Breach |

### M4 — Las coordenadas de marcadores son diagramas, no texto

Las posiciones de los marcadores 1–5 están dibujadas sobre una rejilla. La extracción de texto solo devuelve medidas sueltas (`6"`, `12"`, `18"`) sin la geometría que las relaciona.

Decisión: transcribir solo los campos estructurados (nombre, escala, dimensiones, longitud de partida, suministro, condiciones) y **usar la imagen recortada de la carta para el diagrama**. Reconstruir las coordenadas a mano sería trabajo lento y propenso a error para reproducir algo que la imagen ya muestra mejor.

### M5 — El draft es un procedimiento de mesa, no de construcción

§9.2: cada jugador **lleva 2 cartas de misión y 2 de despliegue**, sin duplicados en su propio conjunto. El draft (tirada, descartes, selección) ocurre en la mesa con el oponente delante.

Esto parte la funcionalidad en dos, y conviene no confundirlas:

- **Selección de escenarios** — qué 2+2 cartas llevas. Es parte de tu lista, se guarda y se imprime. **Entra en la v1.**
- **Asistente de draft** — ejecutar el procedimiento con el oponente. Es una herramienta de partida, no de lista. **Lo propongo como añadido opcional** (ver Q15).

- **Q15 — Asistente de draft.** Descartado. La app registra e imprime las 4 cartas que llevas; el draft se resuelve en la mesa. ✅

### M6 — El reglamento incluye el contenido de los sets de inicio

§12.12 detalla los **6 sets** (Starter y Founders Edition de cada raza) con sus unidades, número de modelos, mejoras incluidas, valor de suministro, coste y cartas. Ejemplo del Terran Starter: 9 Marines con Combat Shield, Grenades - Frag y Bayonet (280), 2 Marauders con Laser Targeting Systems (170), etc.

Es contenido ya estructurado y verificado que habilita dos funcionalidades sin trabajo de transcripción adicional: listas de ejemplo precargadas y control de colección (ver [`05-IDEAS-MEJORA.md`](05-IDEAS-MEJORA.md)).
