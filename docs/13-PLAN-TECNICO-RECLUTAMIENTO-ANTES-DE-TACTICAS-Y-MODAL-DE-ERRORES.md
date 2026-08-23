# 13 · Plan técnico: reclutamiento antes de tácticas y modal de errores

**Estado:** implementación en curso; fases de motor, store, catálogo y modal iniciadas.
**Fecha:** 23 de agosto de 2026.
**Alcance de este documento:** describe cómo implementar el cambio solicitado.
Sirve como referencia de alcance y criterios durante la implementación; no
autoriza cambios funcionales adicionales fuera de los descritos aquí.

---

## 1. Objetivo

El constructor debe permitir elegir unidades después de seleccionar una Carta
de Facción, aunque todavía no se hayan añadido las Cartas Tácticas que aportan
los espacios necesarios. Durante ese estado intermedio la lista puede ser
ilegal por falta de espacios, pero la unidad debe permanecer en el borrador y
la legalidad debe recuperarse al añadir después las Cartas Tácticas adecuadas.

Además:

- la Carta de Facción seguirá siendo obligatoria antes de incorporar cualquier
  unidad;
- una vez elegida una facción válida, ninguna unidad de la raza actual
  desaparecerá del catálogo por no poderse añadir;
- las unidades no añadibles, incluidas las `UNIQUE` ya incorporadas como
  Kerrigan, permanecerán visibles, atenuadas y con el motivo;
- al entrar en **Revisión e impresión** con errores se abrirá un modal que los
  resuma;
- el panel completo de validación de Revisión seguirá existiendo debajo del
  modal.

La idea central es separar dos decisiones que hoy están mezcladas:

1. **¿Se puede añadir esta unidad al borrador ahora?**
2. **¿Es legal la lista completa en su estado actual?**

La falta de espacios afectará a la segunda, pero dejará de bloquear la primera.

## 2. Decisiones funcionales adoptadas en esta propuesta

Estas decisiones concretan el cambio y evitan ampliar el alcance durante la
implementación. Si alguna no coincide con el comportamiento deseado, deberá
corregirse en este documento antes de empezar a programar:

1. Se conserva el orden visual de los cuatro pasos de construcción: **Cartas de
   mando → Reclutamiento → Misión y despliegue → Revisión e impresión**. No se
   separa la Carta de Facción de las Cartas Tácticas ni se añade otra pestaña.
   La pestaña condicional **Estadísticas** de las listas guardadas continúa
   existiendo fuera de esos cuatro pasos.
2. El usuario puede seleccionar una Carta de Facción, saltar a Reclutamiento sin
   elegir tácticas y añadir unidades.
3. La Carta de Facción debe existir en el catálogo y corresponder a la raza
   actual. Un identificador no nulo pero desconocido no cuenta como facción
   válida.
4. La Creep Card Zerg no es un requisito para reclutar. Sigue siendo obligatoria
   para que la lista final sea legal mediante `R11`.
5. Solo la **falta de espacios** se vuelve provisional. La falta de minerales
   continúa bloqueando la incorporación, igual que en el comportamiento actual.
6. Una vez elegida una Carta de Facción válida, una unidad con etiquetas
   incompatibles o `UNIQUE` ya incluida sigue sin poder añadirse, pero permanece
   visible en gris.
7. “No desaparecer” aplica a todas las unidades de la raza cargada después de
   elegir facción, no solo a las `UNIQUE`: incluye variantes de otra subfacción
   cuyas etiquetas no estén contenidas en la Carta de Facción seleccionada.
8. Quitar una Carta Táctica nunca elimina unidades. Si deja de haber espacios,
   la lista pasa a tener `R4` hasta que el usuario la corrija.
9. El modal de Revisión se abre cada vez que Revisión pasa de no visible a
   visible y existen errores en ese momento, ya sea desde otra pestaña o al
   volver al constructor conservando ese paso. Pulsar de nuevo la pestaña ya
   activa o generar un error mientras Revisión ya está visible no lo reabre.
10. El modal incluye solo `validation.errors`. Los avisos permanecen en el panel
    de Revisión y no provocan la apertura.
11. El modal informa, pero no impide revisar, guardar ni imprimir una lista
    inválida. Cerrarlo deja al usuario dentro de Revisión.
12. La primera versión del modal no incluye botones “Ir al error”. Varias reglas,
    como `R3`, `R4` y `R7`, pueden resolverse desde más de una pestaña y el modelo
    actual no contiene un destino inequívoco.

## 3. Alcance y exclusiones

### 3.1 Incluido

- Nueva clasificación provisional por falta de espacios.
- Motivos estructurados para que la interfaz no interprete textos traducidos.
- Guardia real de reclutamiento en el store.
- Catálogo sin ocultar unidades no añadibles.
- Estado visual y accesible para disponible, provisional y no disponible.
- Modal de errores al entrar en Revisión.
- Textos en español e inglés.
- Pruebas de motor, store, componente y flujo.
- Actualización posterior de PRD y SDD para retirar las reglas contradictorias.

### 3.2 Fuera de alcance

- Permitir superar provisionalmente el límite de minerales.
- Calcular automáticamente una combinación óptima de Cartas Tácticas.
- Garantizar que todo déficit provisional pueda resolverse dentro del gas
  disponible.
- Cambiar las reglas oficiales `R0`–`R13`.
- Cambiar el borrado actual de unidades y tácticas al sustituir la Carta de
  Facción.
- Reordenar o dividir las pestañas del constructor.
- Navegación automática desde cada error a un control concreto.
- Bloquear el guardado o la impresión de listas inválidas.
- Migraciones de base de datos, del catálogo, del JSON o del seed.

## 4. Diagnóstico del comportamiento actual

| Área | Comportamiento actual | Causa | Comportamiento objetivo |
|---|---|---|---|
| Facción | Reclutamiento muestra un aviso si `factionCardId` es nulo | Salida temprana de `StepMusterUnits` | Mantener la puerta y validarla también en el store |
| Falta de espacios | La composición queda `blocked` y su botón se deshabilita | `getEligibleUnits` trata espacios y minerales como el mismo bloqueo | Convertirla en `provisional`, visible y añadible |
| `UNIQUE` incluida | Desaparece del catálogo | Se clasifica `impossible` y la UI la filtra | Mantenerla visible, gris y deshabilitada |
| Etiquetas incompatibles | Desaparece del catálogo | Mismo filtro de `impossible` | Mantenerla visible, gris y con motivo |
| Alta directa en store | Acepta ids, composiciones o estados no elegibles | `addUnit` no comprueba precondiciones | Rechazar restricciones duras; aceptar déficit de espacios |
| Revisión | Muestra errores y avisos dentro de la página | No existe evento de entrada ni modal | Abrir resumen modal al entrar si hay errores |

El soporte de dominio necesario ya existe:

- [`ArmyList`](../src/engine/types.ts) guarda `tacticalCardIds` y `entries` de
  forma independiente.
- [`computeCosts`](../src/engine/costing.ts) puede calcular un libro mayor con
  `used > total`.
- [`validateList`](../src/engine/validate.ts) ya produce `R0` cuando no hay una
  Carta de Facción válida y `R4` cuando se consumen más espacios de los
  disponibles.
- [`ResourceBar`](../src/ui/common/ResourceBar.tsx) ya muestra en error un tipo
  de espacio consumido por encima de su total.
- [`removeTacticalCard`](../src/store/listStore.ts) ya conserva las unidades al
  quitar una táctica.

Por tanto, el cambio no requiere representar un estado nuevo dentro de
`ArmyList`; solo cambia la política de incorporación y su presentación.

## 5. Modelo funcional de reclutamiento

### 5.1 Estados de una composición

Cada composición de unidad tendrá uno de estos cuatro estados:

| Estado | ¿Visible? | ¿Se puede añadir? | Significado |
|---|---:|---:|---|
| `available` | Sí | Sí | Cumple restricciones duras y dispone de minerales y espacios |
| `provisional` | Sí | Sí | Cumple restricciones duras y minerales, pero al añadirla faltarán espacios |
| `blocked` | Sí, atenuada | No | Podría pertenecer al ejército, pero no quedan minerales suficientes |
| `impossible` | Sí, atenuada | No | Incompatible con la facción o `UNIQUE` ya incluida |

`impossible` deja de significar “oculto”. Describe elegibilidad de dominio; la
política visual del catálogo será mostrar todas las unidades de la raza actual.
Las Cartas Tácticas pueden conservar su política visual existente: este cambio
solo afecta a unidades.

### 5.2 Precedencia de restricciones

La decisión se evaluará en este orden:

1. **Carta de Facción válida.** Sin ella no se incorpora ninguna unidad.
2. **Entrada y composición existentes.** Un id desconocido nunca se añade.
3. **Tipo de incorporación.** La elegibilidad se evalúa para la acción concreta:
   `recruit` admite solo unidades normales y `addReference` solo unidades
   `summoned`. Una invocada compatible continúa disponible como referencia; no
   consume minerales ni espacios y nunca usa el estado provisional.
4. **Raza y etiquetas.** Deben ser compatibles con la Carta de Facción (`R3`).
5. **UNIQUE.** Si ya hay una copia reclutada, no se permite otra (`R7`).
6. **Minerales.** Si la composición supera los minerales restantes, queda
   bloqueada.
7. **Espacios.** Si es la única restricción incumplida, queda provisional y sí
   se puede incorporar.

No debe usarse `validation.legal` como condición de alta. Durante la construcción
pueden faltar Creep Card, misiones, despliegues o espacios, y ninguno de esos
errores globales debe bloquear por sí mismo una incorporación permitida.

### 5.3 Déficit proyectado

El texto no debe usar los espacios libres actuales como si nunca pudieran ser
negativos. Si ya existe déficit y se añade otra unidad, la cifra relevante es
el déficit total que quedará después de la acción:

```text
déficitProyectado = max(
  0,
  espaciosUsados + suministroDeLaComposición - espaciosTotales
)
```

Ejemplo: si se usan 3 espacios de Élite de un total de 1 y la nueva composición
consume 2, después de añadirla faltarán 4; no debe mostrarse “te quedan −2”.

### 5.4 Estado agregado de una unidad

Una unidad puede ofrecer varias composiciones con estados diferentes. Su estado
global se obtiene así:

1. `available` si al menos una composición está `available`;
2. en caso contrario, `provisional` si al menos una está `provisional`;
3. en caso contrario, `blocked` si las composiciones están bloqueadas por
   minerales;
4. `impossible` cuando existe una restricción dura de unidad que afecta a todas
   sus composiciones.

El botón de cada composición usa siempre su propio estado, no solo el agregado
de la tarjeta.

## 6. Contrato del motor de elegibilidad

### 6.1 Tipos

En [`src/engine/types.ts`](../src/engine/types.ts) se especializará el contrato
de elegibilidad de unidades sin modificar ningún tipo persistido ni ensanchar el
contrato actual de tácticas y Creep Cards. El diseño de referencia es:

```ts
type UnitEligibilityStatus = EligibilityStatus | 'provisional';

type UnitEligibilityConstraint =
  | 'RACE_MISMATCH'
  | 'TAG_MISMATCH'
  | 'UNIQUE_ALREADY_INCLUDED'
  | 'INSUFFICIENT_MINERALS'
  | 'INSUFFICIENT_SLOTS';

interface UnitEligibility extends Omit<Eligibility, 'status'> {
  status: UnitEligibilityStatus;
  constraint?: UnitEligibilityConstraint;
}

interface UnitCompositionEligibility extends UnitEligibility {
  projectedSlotDeficit?: number;
}

interface EligibleUnit extends UnitEligibility {
  entry: UnitEntry;
  compositions: Array<
    { composition: Composition } & UnitCompositionEligibility
  >;
}

type RecruitmentRejectionCode =
  | 'MISSING_FACTION'
  | 'UNKNOWN_UNIT'
  | 'UNKNOWN_COMPOSITION'
  | 'WRONG_RECRUITMENT_ACTION'
  | Exclude<UnitEligibilityConstraint, 'INSUFFICIENT_SLOTS'>;

type RecruitmentResult =
  | { ok: true; instanceId: string }
  | { ok: false; constraint: RecruitmentRejectionCode };
```

Las propiedades exactas pueden integrarse en `Eligibility` o especializarse en
`EligibleUnit`, pero deben cumplirse estas condiciones:

- `provisional` se representa de forma explícita y solo en unidades;
- las causas visibles del catálogo se separan de los rechazos del comando;
- cada composición contiene su propia causa y su propio déficit proyectado,
  porque dos composiciones de la misma unidad pueden tener estados distintos;
- el estado agregado de la unidad no publica el déficit arbitrario de una de
  sus composiciones;
- una restricción dura de unidad se propaga a sus composiciones o estas usan de
  forma explícita el motivo de la unidad como fallback;
- el déficit de espacios es numérico y no se extrae de `reason.es` o `reason.en`;
- `reason` y `remedy` siguen siendo textos localizados para presentación;
- Cartas Tácticas y Creep Cards no necesitan emitir `provisional`.

`MISSING_FACTION`, ids desconocidos y usar la acción equivocada no son estados
de una tarjeta válida del catálogo: son rechazos de la mutación. Por eso no se
mezclan con `UnitEligibilityConstraint`.

No se añadirá `provisional` al `EligibilityStatus` compartido salvo que
`Eligibility` se convierta expresamente en un tipo genérico. De otro modo se
alteraría, sin necesidad, el contrato de tácticas y Creep Cards.

Debe existir un helper puro, compartido por UI y store, equivalente a:

```ts
isUnitAddable(status) ===
  status === 'available' || status === 'provisional'
```

Así se evita que cada consumidor mantenga su propia lista de estados.

### 6.2 Clasificador

En [`src/engine/eligibility.ts`](../src/engine/eligibility.ts):

- mantener las comprobaciones actuales de etiquetas y `UNIQUE`;
- exigir que la facción resuelta exista y que `faction.race === list.race`;
- evaluar minerales como bloqueo duro antes del déficit de espacios;
- sustituir el bloqueo por espacios por `provisional`;
- calcular `projectedSlotDeficit` por composición con el estado posterior a la
  incorporación;
- proporcionar motivo y remedio también en estados `impossible`;
- no basar la decisión en `tacticalCardIds.length`: también debe funcionar con
  tácticas insuficientes o después de retirar una;
- extraer una función pura que pueda evaluar una unidad y una composición
  concretas sin que el store tenga que duplicar estas reglas.

Mensaje recomendado para un estado provisional:

> Puedes añadir esta composición ahora. Después faltarán 2 espacios de Élite;
> añade Cartas Tácticas suficientes antes de validar la lista.

La frase debe ser visible en móvil; un atributo `title` puede complementarla,
pero no ser su única representación.

## 7. Validación final: reglas que no cambian

[`src/engine/validate.ts`](../src/engine/validate.ts) continúa siendo la única
fuente de verdad sobre la legalidad de la lista.

| Regla | Comportamiento después del cambio |
|---|---|
| `R0` | La Carta de Facción sigue siendo obligatoria |
| `R1` | El gasto de minerales no puede superar el límite |
| `R3` | Unidades y tácticas deben ser compatibles con las etiquetas de facción |
| `R4` | Una lista con más espacios usados que otorgados es ilegal |
| `R7` | Una `UNIQUE` no admite más de una copia |
| `R11` | Zerg sigue necesitando exactamente una Creep Card |
| `R12` | Siguen siendo necesarias dos misiones y dos despliegues |

El flujo esperado es:

```text
facción elegida
    ↓
unidad provisional añadida sin espacios suficientes
    ↓
la unidad permanece en ArmyList y validateList devuelve R4
    ↓
se añade una Carta Táctica que aporta los espacios
    ↓
se recalculan costes; R4 desaparece sin recrear la unidad
```

`R3`, `R4` y `R7` deben seguir protegiendo listas importadas, seeds antiguos o
payloads manipulados aunque las mutaciones normales del store eviten producir
algunos de esos estados.

## 8. Mutaciones del store

### 8.1 `addUnit`

[`src/store/listStore.ts`](../src/store/listStore.ts) no debe confiar solo en un
botón deshabilitado. Antes de crear la entrada, `addUnit` comprobará mediante la
política pura compartida:

- facción seleccionada y existente;
- unidad y composición existentes;
- unidad no invocada;
- raza y etiquetas compatibles;
- límite `UNIQUE`;
- minerales disponibles;
- estado `available` o `provisional`.

Un estado `provisional` se acepta deliberadamente. `blocked` e `impossible` no
mutan la lista. La acción devolverá el `RecruitmentResult` discriminado de §6.1,
incluido el `instanceId` creado o un código estable de rechazo; no debe lanzar
por una interacción normal ni fallar silenciosamente.

La acción recalculará la decisión con el `list` y el `summary` actuales obtenidos
del store en el momento de cada llamada. No aceptará como autoridad un estado de
elegibilidad calculado previamente por React: varias altas seguidas y las
mejoras ya compradas deben entrar en el cálculo más reciente.

### 8.2 `addReferenceUnit`

La misma precondición de Carta de Facción se aplica a las unidades invocadas de
referencia. La acción comprobará que la entrada:

- existe;
- pertenece a la raza y etiquetas de la facción;
- tiene `summoned: true`;
- dispone de una composición válida para la referencia.

No se aplican minerales ni espacios porque esas entradas ya se excluyen del
cálculo mediante `reference: true`.

`addReferenceUnit` usa el mismo `RecruitmentResult`: una invocada compatible
produce éxito; una unidad normal devuelve `WRONG_RECRUITMENT_ACTION`. A la
inversa, `addUnit` rechaza una invocada con ese mismo código.

### 8.3 Carga e importación

`setList`, importación JSON y decodificación de seed deben seguir aceptando una
lista estructuralmente válida aunque sea ilegal según el motor. La aplicación
necesita cargarla para validarla, mostrar los errores y conservar su contenido.

Las nuevas guardias solo afectan a las mutaciones interactivas; no sustituyen la
validación final.

Se conserva la puerta actual cuando no hay facción: Reclutamiento muestra el
aviso y no el catálogo. Por tanto, la garantía de que ninguna unidad del catálogo
desaparece comienza tras elegir una facción válida. Una importación con entradas
pero sin facción sigue visible en Revisión e impresión; seleccionar después una
facción conserva la semántica actual de confirmación y limpieza de elementos
dependientes, que este plan no modifica.

## 9. Interfaz de Reclutamiento

En [`src/ui/builder/StepMusterUnits.tsx`](../src/ui/builder/StepMusterUnits.tsx):

1. Comprobar la facción resuelta en `index.factionCards`, no solo que el id sea
   distinto de `null`.
2. Mantener el mensaje de precondición si no existe una facción válida.
3. Eliminar el filtro que descarta `status === 'impossible'`.
4. Mantener todas las unidades reclutables de la raza actual en el catálogo.
5. Habilitar una composición si `isUnitAddable` devuelve verdadero.
6. Aplicar estado visual no disponible a `blocked` e `impossible`.
7. Aplicar un estado visual de advertencia, pero no de deshabilitado, a
   `provisional`.
8. Mostrar motivo y remedio visibles tanto para el estado agregado como para
   composiciones individuales.
9. Conservar el roster derecho y su acción de quitar sin cambios funcionales.
10. Mantener las unidades invocadas en su sección separada, pero aplicarles la
    elegibilidad de facción: una referencia incompatible se muestra atenuada y
    su acción de alta está deshabilitada.
11. En cada composición provisional, enlazar el botón habilitado con su mensaje
    mediante `aria-describedby` e ids únicos. En las no disponibles, mantener
    motivo y estado como texto normal fuera del botón `disabled`, para que sigan
    en el orden de lectura.
12. En unidades con composiciones mixtas, mostrar el estado junto a cada
    composición; el estado agregado de la tarjeta no puede ocultar que una
    opción concreta es provisional o está bloqueada.

### 9.1 Representación visual

| Estado | Tratamiento recomendado |
|---|---|
| Disponible | Tarjeta y composición normales; control habilitado |
| Provisional | Borde o indicador de aviso; texto “se puede añadir, faltarán N espacios”; control habilitado |
| Bloqueada | Contenido atenuado, etiqueta “No disponible”, motivo, control deshabilitado |
| Imposible | Igual que bloqueada, con motivo de etiqueta o `UNIQUE`; nunca oculta |

El gris no puede ser la única señal. Debe acompañarse de texto y del estado
`disabled` real en el botón. Una tarjeta contenedora que sea un `div` puede usar
una etiqueta visible; no debe fingir `aria-disabled` si dentro conserva acciones
habilitadas.

No se renombrará ni se cambiará globalmente `.card--blocked`: también la usa el
flujo de Cartas Tácticas y contiene excepciones para que su botón **Quitar** siga
visible. El catálogo de unidades usará clases propias, por ejemplo
`.unit-catalog-card--unavailable`, `.unit-composition--provisional` y
`.unit-composition--unavailable`.

El motivo, el remedio y la etiqueta de estado mantendrán contraste normal; no
heredarán la opacidad de toda la tarjeta. También se evitará multiplicar la
opacidad de una tarjeta atenuada por la de un botón deshabilitado. Si durante la
implementación se toca algún selector compartido, se añadirá una regresión de
Cartas Tácticas además de las pruebas del catálogo de unidades.

### 9.2 Ejemplo Kerrigan

Con `Zerg Swarm` y sin `Overlord`:

1. Kerrigan requiere un espacio `HERO` que la facción no aporta.
2. Su composición aparece provisional y habilitada.
3. Al incorporarla, la lista conserva a Kerrigan y muestra `HERO 1/0` y `R4`.
4. La tarjeta de Kerrigan continúa en el catálogo, ahora gris por
   `UNIQUE_ALREADY_INCLUDED`, y no permite una segunda copia.
5. Al añadir `Overlord`, el total pasa a `HERO 1/1` y desaparece `R4`.

### 9.3 Ejemplo Hydralisk

Con `Zerg Swarm`, que aporta 1 espacio de Élite, y sin tácticas:

1. Hydralisk de 4 modelos consume 3 espacios de Élite.
2. La composición se puede añadir y deja `ELITE 3/1` con `R4`.
3. Añadir `Hydralisk Den`, que aporta 2 de Élite, deja `ELITE 3/3`.
4. La misma instancia de Hydralisk, su orden y sus mejoras se conservan.

## 10. Modal de errores al entrar en Revisión

### 10.1 Política de apertura

[`src/App.tsx`](../src/App.tsx) sustituirá el `setStep` directo de las pestañas
por un manejador que acepte todos los `StepId`, incluida la pestaña condicional
`stats`. Además observará cuándo Revisión pasa de no visible a visible:

```text
reviewVisible = page == builder y step == review

si previousReviewVisible == false
   y reviewVisible == true
   y validation.errors no está vacío:
       abrir modal

actualizar previousReviewVisible
```

Esto cubre tanto el clic desde otra pestaña como el regreso al constructor si
`step` seguía siendo `review`. No abre el modal por una mera actualización de
errores mientras Revisión continúa visible. Navegar a Estadísticas o a cualquier
otro paso conserva su comportamiento y cierra un estado residual del diálogo.

El estado de apertura pertenece a `App`, porque allí se conocen `page`, `step` y
la transición de visibilidad. El componente visual se renderizará dentro de
`StepReview` para conservar los tokens de raza y los estilos del constructor.
`App` mantendrá una referencia explícita al botón de la pestaña Revisión y la
usará para restaurar el foco en todos los caminos de cierre.

Al abandonar Revisión se cerrará cualquier estado residual. Al volver a entrar,
se evaluará la colección actual de errores; no se guardará un indicador
persistente de “ya visto”.

### 10.2 Contenido

El modal mostrará:

- título: **Hay errores en la lista**;
- resumen con plural correcto: **Hay N errores por resolver**;
- cada elemento de `validation.errors`, en el orden entregado por el motor;
- `rule` y `ruleRef`;
- la unidad afectada cuando exista `entryInstanceId`, resuelta con `list` e
  `index`; si hay copias de la misma unidad, se distinguirán por posición del
  roster, `customLabel` o una etiqueta de instancia equivalente;
- mensaje localizado;
- remedio localizado cuando exista;
- botón **Ver la revisión** y cierre accesible con `×`.

No se copiarán los errores a un segundo estado local. El modal recibe siempre
el resultado actual de `validateList` que ya mantiene el store.

Se extraerá un componente presentacional reutilizable, `ValidationIssueList`,
para que el modal y el panel persistente de
[`StepReview`](../src/ui/builder/StepReview.tsx) compartan el mismo marcado. El
modal filtra errores; el panel de la página continúa mostrando errores y
avisos. Este componente recibirá la información necesaria para resolver
`entryInstanceId`; no intentará inferir la unidad analizando el mensaje. Las
incidencias se marcarán como lista semántica (`ul`/`li`) para que el recuento y
la separación entre errores también sean perceptibles sin el diseño visual.

### 10.3 Cierre y navegación

- `×`, **Ver la revisión**, `Escape` y pulsación en el fondo cierran el modal.
- Cerrar no modifica la lista.
- Cerrar no devuelve a la pestaña anterior.
- Guardar e imprimir siguen disponibles una vez cerrado.
- Si la lista es legal o solo contiene avisos, Revisión se abre directamente.
- Una entrada posterior en Revisión vuelve a mostrarlo si todavía existen
  errores.
- Salir del constructor o desmontar el componente ejecuta el mismo cleanup de
  cierre, foco y scroll.

### 10.4 Accesibilidad

El diálogo debe cumplir como mínimo:

- `role="dialog"` y `aria-modal="true"`;
- `aria-labelledby` apunta al título y `aria-describedby` solo al resumen, no a
  toda la lista de errores;
- foco inicial en el botón **Ver la revisión**;
- ciclo de tabulación contenido dentro mientras esté abierto;
- cierre con `Escape`;
- restauración del foco a la pestaña Revisión;
- cuerpo con scroll interno para muchos errores;
- clase `no-print`;
- contraste suficiente y ningún significado comunicado solo por color.

Todos los controles del diálogo tendrán `type="button"`. El carácter visual
`×` estará oculto a tecnologías de asistencia dentro de un botón cuyo nombre
sea `reviewErrorsClose`.

Los estilos base `.modal` y `.modal__box` ya existen en
[`src/ui/app.css`](../src/ui/app.css). Los selectores de
[`builder-design.css`](../src/ui/builder/builder-design.css) que refinan el
modal dependen actualmente de que esté bajo `main.content.no-print`; la
ubicación propuesta respeta esa condición.

La app crea un contexto de apilado aislado y hoy el modal base (`z-index: 50`)
queda por debajo del toast (`60`) y de los avisos PWA globales (`70`). Durante la
apertura, `App` añadirá una clase como `.app--modal-open` que eleve el contexto
completo por encima de esas superficies, y el modal usará dentro de él una capa
superior al toast. Así el backdrop intercepta también los avisos PWA sin perder
los tokens de raza que se perderían con un portal directo a `body`.

La apertura bloqueará el scroll del documento y restaurará exactamente el valor
anterior al cerrar o desmontar. Para evitar doble scroll, el overlay no tendrá
un segundo desplazamiento independiente: la caja será una columna con cabecera
y acciones fijas, y solo `.review-errors-modal__body` usará `overflow: auto`,
`overscroll-behavior: contain`, `min-width: 0` y ajuste de palabras largas.

## 11. Textos e internacionalización

[`src/i18n/locales.ts`](../src/i18n/locales.ts) incorporará claves equivalentes
en español e inglés. Como mínimo:

| Clave orientativa | Español | Inglés |
|---|---|---|
| `reviewErrorsTitle` | Hay errores en la lista | There are errors in the list |
| `reviewErrorsSummary_one` | Hay 1 error por resolver. | There is 1 error to resolve. |
| `reviewErrorsSummary_other` | Hay {{count}} errores por resolver. | There are {{count}} errors to resolve. |
| `reviewErrorsContinue` | Ver la revisión | View review |
| `reviewErrorsClose` | Cerrar resumen de errores | Close error summary |
| `unitUnavailable` | No disponible | Unavailable |
| `unitProvisional` | Se puede añadir; la lista necesitará más espacios. | Can be added; the list will need more slots. |
| `chooseFactionHint` | Primero elige una Carta de Facción. Después podrás reclutar y completar los espacios con tácticas. | Choose a Faction Card first. You can then recruit and complete the slots with Tactical Cards. |

Los motivos específicos del motor continúan usando `Localized`. La interfaz no
tomará decisiones a partir de su contenido.

[`tests/i18n/resources.test.ts`](../tests/i18n/resources.test.ts) debe conservar
la paridad exacta de claves entre `es` y `en`.

## 12. Persistencia y compatibilidad

No se modifica ningún dato persistido:

| Superficie | Cambio |
|---|---|
| `ArmyList` | Ninguno |
| `ListEntry` | Ninguno |
| Catálogo JSON | Ninguno |
| `schemaVersion` | Sin incremento |
| `catalogContentVersion` | Sin incremento por esta función |
| Seed `SCT1` | Compatible sin cambios |
| Exportación/importación JSON | Compatible sin cambios |
| API de listas | Sin cambios |
| Esquema Zod de servidor | Sin cambios |
| MariaDB | Sin migración |

El estado `provisional`, el código de restricción y el modal son datos derivados
o efímeros. Nunca se serializan dentro de la lista.

Las listas antiguas se recalculan con la nueva política de interfaz, pero su
legalidad oficial no cambia porque `validateList` conserva las mismas reglas.

## 13. Archivos afectados en una implementación futura

| Archivo | Cambio previsto |
|---|---|
| `src/engine/types.ts` | Estado provisional y causa estructurada de elegibilidad |
| `src/engine/eligibility.ts` | Separar minerales de espacios y calcular déficit proyectado |
| `src/store/listStore.ts` | Guardias compartidas en `addUnit` y `addReferenceUnit` |
| `src/ui/builder/StepMusterUnits.tsx` | No filtrar, habilitar provisional y mostrar motivos |
| `src/App.tsx` | Detectar entrada en Revisión y controlar apertura |
| `src/ui/builder/StepReview.tsx` | Mantener panel y alojar el nuevo modal |
| `src/ui/builder/ReviewErrorsModal.tsx` | Nuevo componente de diálogo y lista semántica de errores |
| `src/ui/app.css` | Capa modal, bloqueo visual y cuerpo desplazable |
| `src/styles/global.css` | Estado no disponible/provisional y modal compartido |
| `src/ui/builder/builder-design.css` | Acabado responsive de los nuevos estados |
| `src/i18n/locales.ts` | Textos ES/EN |
| `package.json` / `package-lock.json` | Dependencias de pruebas DOM interactivas |
| `tests/engine/rules.test.ts` | Expectativas de espacios provisionales |
| `tests/catalog/hero-eligibility.test.ts` | Héroes sin `HERO` pasan a provisional |
| `tests/catalog/protoss.test.ts` | Ajustar comentarios/expectativas si cambia el tipo compartido |
| `tests/store/unitRecruitment.test.ts` | Nuevas guardias y flujo sin tácticas |
| `tests/ui/recruitment-flow.test.tsx` | Visibilidad, gris y controles habilitados |
| `tests/ui/review-errors-modal.test.tsx` | Apertura, contenido, cierre y reentrada |
| `tests/ui/statistics-step.test.tsx` | Regresión de navegación condicional a Estadísticas |
| `tests/i18n/resources.test.ts` | Paridad de las nuevas claves ES/EN |
| `docs/01-PRD.md` | Sustituir criterios que hoy ordenan ocultar o bloquear por slots |
| `docs/02-SDD.md` | Actualizar contrato de elegibilidad y §6.6 |

No se prevén cambios en `computeCosts`, los códecs de seed, impresión, servicios
de listas ni backend.

## 14. Secuencia de implementación recomendada

### Fase 1 — Contrato y motor

1. Añadir `provisional` y códigos estructurados.
2. Extraer la política pura para una composición concreta.
3. Cambiar el déficit de espacios a provisional.
4. Mantener minerales, etiquetas y `UNIQUE` como restricciones duras.
5. Actualizar pruebas unitarias antes de tocar React.

**Puerta de salida:** el motor distingue el déficit de slots sin cambiar el
resultado de `validateList`.

### Fase 2 — Store

1. Aplicar la política compartida en `addUnit`.
2. Endurecer `addReferenceUnit`.
3. Verificar que un alta provisional crea `R4`.
4. Verificar que añadir la táctica elimina `R4` sin alterar la instancia.

**Puerta de salida:** no se puede saltar una restricción dura llamando al store,
pero sí se puede incorporar una unidad sin slots suficientes.

### Fase 3 — Catálogo de unidades

1. Retirar el filtro de `impossible`.
2. Renderizar los cuatro estados.
3. Hacer visibles los motivos en escritorio y móvil.
4. Comprobar Kerrigan y una variante de subfacción incompatible.

**Puerta de salida:** ninguna unidad de la raza desaparece por elegibilidad y
solo `available`/`provisional` son accionables.

### Fase 4 — Revisión

1. Centralizar la navegación entre pasos.
2. Crear el modal y compartir la lista de incidencias.
3. Mantener intacto el panel permanente y la impresión.
4. Añadir foco, Escape, backdrop, scroll y restauración de foco.

**Puerta de salida:** entrar con errores abre el modal; cerrarlo deja visible la
Revisión; entrar sin errores no lo abre.

### Fase 5 — Regresión y documentación

1. Añadir pruebas de componente con entorno DOM.
2. Recorrer los flujos Zerg, Terran y Protoss.
3. Actualizar PRD y SDD.
4. Ejecutar suite, typecheck y build.

## 15. Matriz mínima de pruebas

### 15.1 Motor y store

| ID | Caso | Resultado esperado |
|---|---|---|
| ENG-01 | Facción válida, cero tácticas, unidad que cabe en espacios iniciales | `available`; se añade sin errores de slots |
| ENG-02 | Hydralisk de 4 con Zerg Swarm y cero tácticas | `provisional`; se añade; aparece `R4` |
| ENG-03 | Añadir `Hydralisk Den` al caso anterior | La misma unidad permanece; desaparece `R4` |
| ENG-04 | Kerrigan sin espacio `HERO` | `provisional`; se puede añadir |
| ENG-05 | Kerrigan ya añadida | `impossible`; segunda alta rechazada |
| ENG-06 | Kerrigan Swarm Raptor bajo Zerg Swarm | `impossible`; alta rechazada por etiquetas |
| ENG-07 | Composición sin minerales | `blocked`; alta rechazada |
| ENG-08 | Sin facción válida | Alta normal y de referencia rechazadas |
| ENG-09 | Id o composición desconocidos | No hay mutación ni excepción |
| ENG-10 | Quitar una táctica que cubría espacios | Unidades intactas; aparece `R4` |
| ENG-11 | Dos `UNIQUE` en lista importada | `validateList` conserva `R7` |
| ENG-12 | Unidad incompatible en lista importada | `validateList` conserva `R3` |
| ENG-13 | Varias altas provisionales seguidas | Cada llamada usa el estado actual y comprueba el déficit acumulado exacto |
| ENG-14 | `addUnit` con una `summoned` | Alta normal rechazada |
| ENG-15 | `addReferenceUnit` con una unidad normal | Alta de referencia rechazada |
| ENG-16 | `addReferenceUnit` con `Roachling` u otra invocada compatible | Referencia creada con `reference: true`, sin minerales ni slots |
| ENG-17 | Algunas tácticas seleccionadas, pero todavía insuficientes | La composición continúa `provisional`; no depende de que el array esté vacío |
| ENG-18 | Faltan a la vez minerales y espacios | Prevalece `blocked` por minerales y no se añade |
| ENG-19 | Una composición cabe y otra queda provisional | Unidad agregada `available`; cada botón conserva su estado propio |
| ENG-20 | Facción nula, desconocida o de otra raza | `MISSING_FACTION` o rechazo equivalente; no hay mutación |

### 15.2 Interfaz

| ID | Caso | Resultado esperado |
|---|---|---|
| UI-01 | Abrir Reclutamiento sin facción | Mensaje de precondición; ninguna alta posible |
| UI-02 | Catálogo con disponible, provisional, bloqueada e imposible | Todas visibles; semántica y controles correctos |
| UI-03 | Composición provisional en móvil | Motivo visible sin depender de hover o `title` |
| UI-04 | `UNIQUE` ya incorporada | Sigue gris en catálogo y se puede quitar desde roster |
| UI-05 | Añadir provisional | Barra, contador de errores de Reclutamiento y validación reflejan `R4` inmediatamente |
| UI-06 | Resolver con táctica | Barra y validación se actualizan sin perder orden/mejoras |
| UI-07 | Invocada compatible e incompatible | La compatible admite referencia; la incompatible sigue visible, explicada y deshabilitada |
| UI-08 | Composiciones mixtas | Cada opción muestra estado y descripción accesible propios |
| UI-09 | CSS de unidad no disponible | Motivo legible, sin opacidad acumulada ni regresión en Cartas Tácticas |

### 15.3 Modal de Revisión

| ID | Caso | Resultado esperado |
|---|---|---|
| MOD-01 | Entrar con un `R4` | Revisión se activa y modal muestra regla, referencia, mensaje y remedio |
| MOD-02 | Entrar con varios errores | Se muestran todas las instancias actuales y el recuento correcto |
| MOD-03 | Lista legal con avisos | No se abre modal; avisos siguen en el panel |
| MOD-04 | Cerrar por botón, `×`, Escape o backdrop | Lista intacta y usuario dentro de Revisión |
| MOD-05 | Salir y volver con errores | El modal se abre de nuevo |
| MOD-06 | Corregir todos y volver | No se abre |
| MOD-07 | Teclado | Foco contenido y restaurado a la pestaña Revisión |
| MOD-08 | Muchos errores y 360 px | Diálogo desplazable, sin scroll horizontal ni contenido inaccesible |
| MOD-09 | Pulsar Revisión cuando ya está activa | No se reabre el modal |
| MOD-10 | Navegar Revisión ↔ Estadísticas | Estadísticas conserva su acceso; reentrar en Revisión reevalúa errores |
| MOD-11 | Español e inglés | Contenido localizado y paridad exacta de claves |
| MOD-12 | Impresión con modal abierto | El diálogo no aparece en la salida impresa |
| MOD-13 | Error con `entryInstanceId` entre copias iguales | Se identifica la instancia afectada sin analizar el mensaje |
| MOD-14 | Toast o aviso PWA presente | Backdrop y foco quedan por encima; el fondo no es interactivo |

Las pruebas no deben decidir la causa inspeccionando el texto en español. Deben
usar `status`, `constraint`, reglas de validación y atributos accesibles.

El proyecto usa actualmente Vitest con entorno `node` y las pruebas React son
principalmente renderizados estáticos. La implementación añadirá como
dependencias de desarrollo `jsdom`, `@testing-library/react` y
`@testing-library/user-event`, y marcará los ficheros interactivos con el
entorno `jsdom` de Vitest. Esto modifica `package.json` y `package-lock.json`,
pero no requiere cambiar el entorno global de `vite.config.ts`. Un test SSR por
sí solo no cubre foco, Escape, click en backdrop ni reentrada.

## 16. Criterios de aceptación

La implementación se considerará completa cuando se cumplan todos:

1. No se puede incorporar ninguna unidad sin una Carta de Facción válida.
2. No es necesario haber elegido una Carta Táctica ni una Creep Card para
   incorporar una unidad normal.
3. Una composición cuyo único problema sean los espacios puede añadirse.
4. La unidad provisional permanece en `ArmyList` y genera `R4` hasta resolver
   el déficit.
5. Añadir o quitar tácticas recalcula `R4` sin borrar, recrear o reordenar
   unidades.
6. La falta de minerales continúa impidiendo la incorporación.
7. Ninguna unidad de la raza actual se oculta por `blocked` o `impossible`.
8. Las unidades no añadibles están grises, deshabilitadas y explicadas con
   texto; el color no es la única señal.
9. Una `UNIQUE` ya incluida, como Kerrigan, permanece visible y no admite una
   segunda copia.
10. `R3`, `R4` y `R7` siguen detectando listas importadas ilegales.
11. Entrar en Revisión con uno o más errores abre el modal con todos los errores
    actuales.
12. Entrar con cero errores no abre el modal, aunque haya avisos.
13. Cerrar el modal conserva la pestaña Revisión y su panel completo de
    validación.
14. El modal es operable por teclado, responsive y no aparece en impresión.
15. No cambia el JSON, el seed, la API ni la base de datos.

## 17. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| UI y store discrepan sobre qué puede añadirse | Compartir una única política pura e `isUnitAddable` |
| El texto traducido se usa como lógica | Añadir códigos de restricción y déficit numérico |
| Se debilita `R4` al permitir el alta | Mantener `validateList` intacto y probar el ciclo inválido → válido |
| Se permite una segunda `UNIQUE` por llamada directa | Guardia del store más regresión de `R7` |
| Una tarjeta gris parece simplemente decorativa | Motivo visible, etiqueta de estado y botones realmente deshabilitados |
| El estado provisional parece bloqueado | Clase visual distinta y acción habilitada |
| Déficits acumulados muestran cifras negativas confusas | Calcular déficit proyectado posterior a la acción |
| El modal sustituye información de Revisión | Compartir marcado y conservar el panel persistente |
| El modal reaparece continuamente dentro de Revisión | Abrir solo cuando Revisión pasa de no visible a visible |
| Errores largos no caben en móvil | Altura máxima, scroll interno y prueba a 360 px |
| Se rompen tácticas al ampliar un tipo compartido | Tratar `provisional` solo en elegibilidad de unidades y cubrir tácticas existentes |
| Una lista provisional no tiene solución dentro del gas | Mostrar `R4`; no prometer ni calcular solución automática |

Existe una inconsistencia previa: cambiar una composición o comprar una mejora
puede provocar excesos que otras acciones intentan prevenir. Este plan no la
resuelve ni amplía el permiso provisional a minerales; debe registrarse aparte
si se desea una política uniforme para todas las mutaciones.

## 18. Documentación vigente que deberá actualizarse

La implementación no debe darse por terminada mientras sigan vigentes criterios
contradictorios:

- [`docs/01-PRD.md`](01-PRD.md), `CA-04.1`: hoy ordena ocultar incompatibles y
  `UNIQUE` ya incluida.
- `CA-04.1b`: hoy agrupa minerales y espacios como estados deshabilitados.
- `CA-04.4`: debe explicar que la falta de espacios permite un alta provisional
  y genera `R4`.
- [`docs/02-SDD.md`](02-SDD.md), §4.1: debe incorporar `provisional` y retirar la
  equivalencia `impossible = oculto`.
- §6.4: debe reflejar que el usuario puede crear temporalmente el error de slots
  para planificar la lista.
- §6.6: debe sustituir el filtrado en dos niveles por la matriz de cuatro estados
  de este documento.
- §6.1/§6.4: debe añadir el modal de errores como aviso de entrada, sin sustituir
  la validación permanente.

Hasta que esas ediciones se realicen, este documento actúa como especificación
posterior y prevalece exclusivamente para este cambio.

## 19. Verificación final de una implementación futura

Antes de entregar el cambio funcional se ejecutará:

```bash
npm test
npm run typecheck
npm run build
```

También se realizará un recorrido manual en escritorio y móvil con, como mínimo:

1. `Zerg Swarm` → Kerrigan sin `Overlord` → Revisión con `R4` → `Overlord` →
   Revisión sin `R4`.
2. `Zerg Swarm` → Hydralisk de 4 sin tácticas → `Hydralisk Den`.
3. Una unidad `UNIQUE` ya incluida y una variante incompatible visibles en gris.
4. Lista con varios errores, modal desplazable, cierre por teclado y retorno del
   foco.
5. Impresión de lista inválida después de cerrar el modal.

La revisión del diff deberá confirmar que solo han cambiado elegibilidad de
unidades, guardias de incorporación, presentación del catálogo, modal de
Revisión, pruebas y documentación; cualquier modificación de reglas,
persistencia o backend quedará fuera de este plan.
