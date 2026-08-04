# Ideas de mejora

Versión 1.1 · Backlog revisado a 3 de agosto de 2026

Salvo I13, que ya está implementada, este documento es un catálogo de
posibilidades. El alcance vigente sigue siendo el de
[`01-PRD.md`](01-PRD.md).

Criterio de coste: **bajo** = se apoya en datos y motor que ya tendremos; **medio** = requiere trabajo propio; **alto** = es un subproyecto.

---

## Recomendación

Si hubiera que elegir tres, serían **I1**, **I2** e **I5**. Las tres se apoyan en el motor de reglas y en datos que el catálogo ya contendrá, así que su coste real es bajo y resuelven fricciones concretas del uso real. Las demás son buenas ideas que pueden esperar a ver cómo usas la aplicación.

---

## Alta relación valor / coste

### I1 · «¿Qué me cabe?» — sugerencias con lo que sobra
**Coste: bajo.** El motor ya sabe calcular presupuesto y espacios libres; esto es recorrer el catálogo y filtrar.

Al terminar una lista, casi siempre sobran recursos. El ejemplo del propio manual acaba con 330 minerales y 1 espacio de Apoyo sin usar. En lugar de un aviso pasivo («te sobran 330»), la app propone qué encaja:

> Te quedan **330 minerales**, **15 de gas** y **1 espacio de Apoyo**.
> Cabe: `Medic` ×3 (110) · `Queen` (150) · o subir un `Marauder` de 2 a 4 modelos (+130).

Convierte el aviso en acción. Es la funcionalidad que más veces se usaría por partida construida.

### I2 · Control de colección — «solo tengo 12 Zerglings»
**Coste: bajo-medio.** El §12.12 del reglamento ya lista el contenido exacto de los 6 sets de inicio, así que la carga inicial es un par de clics.

Problema real de todo juego de miniaturas: la lista es legal, pero no tienes las miniaturas. El usuario declara qué posee (o selecciona «Terran Starter» y se rellena solo) y la app avisa:

> ⚠️ La lista incluye 18 `Zerglings` y tienes 12.

Es un aviso, nunca un error: la lista sigue siendo legal, y a veces se construye para comprar después. Encaja con el uso real —construir en casa mirando lo que hay en la vitrina— y no existe en la app de referencia.

### I3 · Estadísticas de la lista
**Coste: bajo.** Los datos están en los perfiles que ya transcribimos.

La app de referencia tiene un icono de gráfico en la cabecera. Merece la pena hacerlo bien: reparto de suministro por tipo de espacio, proporción cuerpo a cuerpo frente a distancia, alcance medio, capacidad contra objetivos `Armoured` y `Light`, y coste medio por punto de suministro.

Útil para detectar de un vistazo que tu lista no tiene respuesta ante blindados, algo que en la mesa se descubre tarde.

### I4 · Listas de ejemplo precargadas
**Coste: bajo.** Datos ya disponibles en §12.12.

Las 6 listas de los sets de inicio, listas para cargar y modificar. Quien empieza no se enfrenta a una pantalla en blanco, y de paso sirven como casos de prueba adicionales del motor.

### I5 · Comparador de listas
**Coste: bajo-medio.**

Dos listas en paralelo con sus diferencias resaltadas: coste, espacios, unidades, mejoras. Útil al iterar variantes de la misma lista, que es como se construye en la práctica —duplicar y cambiar una cosa— y hoy obliga a alternar entre pestañas.

### I6 · Vista de lista abierta para el oponente
**Coste: bajo.** El seed ya lo permite; solo falta la vista.

El reglamento (§9.1.10) establece listas abiertas por defecto. Una vista de solo lectura, sin controles de edición, con letra grande y legible desde el otro lado de la mesa. El oponente escanea un QR del seed y la ve en su móvil, sin instalar nada.

### I7 · QR del seed
**Coste: bajo.** Una librería de generación de QR, todo en cliente.

Compartir una lista en mesa sin dictar un código ni depender de la cobertura del local. Complementa I6.

---

## Valor medio

### I8 · Modo mesa
**Coste: medio.**

Vista optimizada para consultar durante la partida: tipografía grande, contraste alto, sin elementos de edición, acceso inmediato a los perfiles de tus unidades y a sus habilidades. Distinto del modo construcción, que asume tiempo y atención.

### I9 · Historial de la lista
**Coste: medio.**

Deshacer y rehacer, y puntos de guardado con nombre («versión torneo», «versión con Kerrigan»). Construir una lista es iterativo y hoy un cambio erróneo se pierde.

### I10 · Detección de erratas entre versiones de catálogo
**Coste: bajo.** El versionado ya está diseñado; falta presentarlo.

Cuando cambia el catálogo, mostrar un informe legible de qué cambió y qué listas guardadas se ven afectadas, en lugar de un aviso genérico.

### I11 · Notas por unidad
**Coste: bajo.**

Anotar la intención táctica de cada unidad («flanquear por la derecha», «guardar el Stimpack para la ronda 3»). Se imprime con la lista. Convierte la hoja en una herramienta de partida, no solo en un recuento.

### I12 · Filtros y búsqueda avanzada en el catálogo
**Coste: bajo.**

Filtrar por rol de combate, palabra clave (`SPECIALIST`, `INDIRECT FIRE`),
alcance, tipo de espacio o coste. Las tres razas ya están presentes, por lo que
esta mejora ha pasado de previsión a necesidad de uso.

---

## Valor a largo plazo

### I13 · Sincronización con cuenta — implementada

Existe backend propio, cuentas, propiedad por usuario, listas en MariaDB y
control optimista de revisión. Su endurecimiento de seguridad y las pruebas de
integración se gestionan en
[`08-AUDITORIA-2026-08-03.md`](08-AUDITORIA-2026-08-03.md), no como idea futura.

### I14 · Acompañante de partida
**Coste: alto.** Es prácticamente otra aplicación.

Seguimiento de heridas, suministro por ronda, puntos de victoria, fases. Descartado del alcance actual; se menciona porque es la ampliación natural si la app se usa mucho.

### I15 · Soporte de partidas por equipos
**Coste: medio.** §9.1.8.

Presupuesto compartido repartido entre jugadores. Solo tiene sentido si juegas 2v2 con cierta frecuencia.

---

## Descartadas y por qué

| Idea | Motivo |
|---|---|
| Asistente de draft | Descartada expresamente. El draft se resuelve en mesa |
| Constructor automático de listas | Un generador que decide por ti vacía de sentido la parte divertida del juego |
| Compartir listas sin autenticación | El directorio público requiere sesión; así se mantiene el control de acceso y la trazabilidad |
| Simulador de dados / probabilidades | Pertenece al acompañante de partida, no al constructor de listas |
