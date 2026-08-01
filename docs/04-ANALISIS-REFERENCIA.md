# Análisis de la aplicación de referencia

Versión 1.0 · Basado en las capturas aportadas por el usuario

Objetivo: identificar qué resuelve bien la aplicación existente (y conviene conservar) y dónde están sus carencias (donde está nuestra oportunidad de hacerlo mejor).

---

## 1. Verificación cruzada de datos

Antes de criticar nada, lo importante: **los datos de la app de referencia coinciden con el reglamento**.

| Unidad | App de referencia | Reglamento §12.10 | |
|---|---|---|---|
| Zergling | 12 → 180 (S1) · 18 → 220 (S2) | 12 → 180 (S1) · 18 → 220 (S2) | ✅ |
| Raptor (Zergling) | 12 → 240 (S1) · 18 → 300 (S2) | 12 → 240 (S1) · 18 → 300 (S2) | ✅ |
| Swarmling (Zergling) | 18 → 260 (S1) | 18 → 260 (S1) | ✅ |
| Kerrigan Swarm Raptor | 6 → 250 (S1) | 6 → 250 (S1) | ✅ |
| Roach | 3 → 170 (S1) | 3 → 170 (S1) | ✅ |
| Vile (Roach) | 3 → 200 (S1) | 3 → 200 (S1) | ✅ |
| Corpser (Roach) | 3 → 240 (S1) | 3 → 240 (S1) | ✅ |
| Hydralisk | 2 → 140 (S2) | 2 → 140 (S2) · 4 → 260 (S3) | ✅ |
| Marine | 6 → 160 (S1) · 9 → 210 (S2) | 6 → 160 (S1) · 9 → 210 (S2) | ✅ |
| Marauder | 2 → 150 (S1) · 4 → 280 (S2) | 2 → 150 (S1) · 4 → 280 (S2) | ✅ |
| Combat Shield (6 Marines) | +20 | 20 | ✅ |

Esto confirma dos cosas: nuestra extracción de los PDFs es correcta, y el modelo de variantes de cepa (H2) es el que usa también quien ya ha resuelto este problema.

## 2. Lo que hace bien (conservar)

| Acierto | Por qué funciona |
|---|---|
| Barra de recursos persistente en la cabecera | Minerales, gas, recurso por ronda, suministro y espacios siempre visibles. Es la información que se consulta constantemente |
| Tres pasos numerados | Refleja el orden real del reglamento: cartas → unidades → misión |
| Límite de minerales editable | Más flexible que preseleccionar escalas. El gas se calcula solo (500 → 50, 2000 → 200) |
| Gas derivado automáticamente | El usuario nunca introduce el 10 % a mano |
| Chips de espacios en cada carta | `3x Core`, `1x Support` de un vistazo, sin abrir la carta |
| Recurso por carta visible | `(+1 CP)`, `(+2 CP)` ayuda a valorar la carta antes de comprarla |
| Maestro-detalle en reclutamiento | Catálogo a la izquierda, lista a la derecha |
| Opciones de composición como botones con su coste | `Models: 6 Supply: 1 → 160` junto a `Models: 9 Supply: 2 → 210`. Comparación inmediata |
| Perfil resumido en cada fila del roster | SHIELD/SPEED/EVADE/ARMOR/HP sin abrir nada |
| Mejoras como chips con su coste | `+ Kinetic Foam (+20)` |
| Bloqueo por dependencias | «Selecciona una carta de facción para desbloquear las tácticas» |
| Guardado por SEED ID | Compartir una lista con una cadena corta |
| Marca de UNIQUE | Etiqueta amarilla en cartas y unidades |

## 3. Carencias detectadas (nuestra oportunidad)

### 3.1 Reglas incompletas

**No se ve el espacio AIR.** Las cartas de facción Terran otorgan `1 × AIR` según el PDF (`Raynor's Raiders: 3 × CORE, 1 × HERO, 1 × SUPPORT, 1 × AIR`), pero los chips de la app muestran solo `1x Hero, 3x Core, 1x Support` y el contador nunca incluye AIR. El ejemplo del propio manual sí lo contabiliza (`0/1 AIR SLOT`).

Explicación probable y razonable: en la versión actual del juego no existe ninguna unidad aérea, así que ocultan una columna que siempre estaría a cero. Es una decisión defendible, pero pierde información real de la lista y se romperá en cuanto salga la primera unidad aérea. Nosotros mantenemos AIR en el modelo y lo mostramos cuando la facción lo otorga.

**Las mejoras SPECIALIST no parecen nominar modelo.** En las capturas, un Marine de 6 modelos ofrece `AGG-12 (+10)` y `Rocket Launcher (+40)` — ambas SPECIALIST — como chips idénticos al resto. El reglamento (§9.1.7) exige nominar qué modelo concreto la porta, y que dos especialistas distintas vayan en modelos distintos. Sin esa nominación no se puede representar correctamente la unidad ni imprimirla con precisión.

**Las unidades invocadas se pueden añadir al roster.** `Point Defense Drone`, `Roachling` y `Omega Worm` aparecen como reclutables con coste 0 y se ven añadidas a la lista en las capturas. El §9.1.9 dice explícitamente que no se incluyen en la lista de ejército ni ocupan espacios. Pendiente de tu decisión (Q14): cumplir la regla, o permitirlo por comodidad de impresión.

**No se aprecia validación de etiquetas.** No hay indicio de que se compruebe la regla de subconjunto de §9.1.2, que es la restricción de elegibilidad más importante del juego.

### 3.2 Experiencia de uso

| Problema | Impacto |
|---|---|
| Panel derecho vacío en el paso 1 | Más de la mitad de la pantalla desaprovechada justo al empezar |
| Sin mensajes de validación | Si algo no se puede añadir, no se explica por qué ni cómo resolverlo |
| Sin trazabilidad de espacios | Se ve `4/8 Core` pero no qué carta aportó cada espacio, ni cuál sobra |
| Densidad visual uniforme | Todo compite por la atención; poca jerarquía entre lo crítico y lo secundario |
| Cabecera saturada | Ocho métricas en una fila, todas con el mismo peso visual |
| Sin adaptación a móvil visible | Las capturas son de escritorio; el maestro-detalle a dos columnas no sobrevive a 360 px sin rediseño |
| Todo en inglés | Barrera para quien no domina la terminología |

## 4. Decisiones de diseño derivadas

Lo que haremos distinto, y por qué:

| # | Decisión | Motivo |
|---|---|---|
| D1 | Mostrar AIR cuando la facción lo otorgue | Es información real de la lista y a prueba de futuro |
| D2 | Nominación explícita de modelo en mejoras SPECIALIST | Lo exige §9.1.7 y es imprescindible para imprimir la lista con precisión |
| D3 | Validación con remedio accionable | Un error sin solución obliga a volver al PDF, que es justo lo que la app debe evitar |
| D4 | Libro mayor de espacios | Tabla de qué carta aporta cada espacio y qué unidad lo consume. Responde «¿por qué no me caben más Hydralisks?» sin hacer cuentas |
| D5 | Aprovechar el panel derecho desde el paso 1 | Vista previa de la lista y resumen en curso en lugar de un placeholder |
| D6 | Jerarquía visual en tres niveles | Crítico (excesos y errores), primario (recursos y espacios), secundario (recurso por ronda, suministro) |
| D7 | Móvil como diseño de primera clase | Pestañas inferiores, hojas deslizantes, sin pérdida de funcionalidad |
| D8 | Nombres en inglés, explicaciones en español | Localizable en las cartas físicas y comprensible a la vez |
| D9 | Creep Card como paso propio para Zerg | Es obligatorio exactamente uno; enterrarlo entre las tácticas provoca listas ilegales |
| D10 | Cumplir §9.1.9 con las invocadas | Consultables e imprimibles, pero fuera del cómputo (sujeto a Q14) |

## 5. Referencia de disposición

**Escritorio** — cabecera fija con recursos, pasos, maestro-detalle:

```
┌────────────────────────────────────────────────────────┐
│ Raza · Escala · Minerales      [Guardar] [PDF] [Imprimir]│
│ ┌────────────────────────────────────────────────────┐ │
│ │ MINERALES 1190/2000 · GAS 190/200 · BM 7 · SUM. 7  │ │
│ │ Núcleo 2/6 · Élite 3/5 · Apoyo 1/2 · Héroe 1/2     │ │
│ └────────────────────────────────────────────────────┘ │
│ ① Cartas   ② Unidades   ③ Revisión e impresión         │
├──────────────────────┬─────────────────────────────────┤
│  Catálogo            │  Lista en construcción          │
│  filtros + elegibles │  + libro mayor de espacios      │
│  no elegibles en     │  + errores y avisos con remedio │
│  gris con el motivo  │                                 │
└──────────────────────┴─────────────────────────────────┘
```

**Móvil** — pestañas inferiores, barra de recursos contraíble, catálogo en hoja deslizante sobre la lista.

## 6. Qué no copiamos

- La tercera pestaña «Mission & Deploy»: fuera del encargo original (pendiente de Q13).
- El guardado en nube: la decisión fue almacenamiento en el dispositivo, sin cuentas.
- La estética íntegramente en inglés.
