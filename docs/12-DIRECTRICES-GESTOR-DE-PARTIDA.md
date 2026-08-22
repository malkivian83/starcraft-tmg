# 12 · Directrices del gestor de partida

**Estado:** directrices funcionales cerradas; implementación aún no autorizada.
**Fecha:** 22 de agosto de 2026.
**Alcance de este documento:** especificación únicamente. No autoriza todavía
la implementación ni modifica el comportamiento actual de la aplicación.

---

## 1. Objetivo

Añadir a la aplicación un acompañante para gestionar una partida 1 contra 1.
Debe permitir configurar la misión, los nombres y razas de los dos jugadores y
un mismo límite de puntos para ambos, y
mantener durante la partida:

- la ronda actual;
- el suministro inicial, el incremento por ronda y el suministro de la ronda
  actual;
- los puntos de victoria de cada participante;
- quién va ganando y por qué margen;
- el avance a la ronda siguiente;
- la posibilidad de deshacer un avance de ronda erróneo;
- la recuperación de todas las partidas si se recarga la página, se cierra la
  PWA o se gira el dispositivo;
- una experiencia cómoda tanto en móvil vertical como apaisado;
- persistencia en base de datos tanto para invitados como para usuarios
  registrados.

El gestor debe asistir y calcular, no sustituir las decisiones de los jugadores
ni intentar simular toda la partida.

## 2. Encaje con lo que ya existe

Esta función debe ser una página propia, separada del constructor de listas y de
la pestaña de estadísticas. Los usuarios registrados dispondrán además de una
sección propia para consultar, continuar y guardar sus partidas.

La pantalla de acceso ofrecerá dos acciones de invitado al mismo nivel:

- **Crear una lista como invitado**.
- **Empezar una partida como invitado**.

Las partidas de invitado también se guardarán en la base de datos. Permanecerán
privadas y asociadas a una identidad invitada segura del navegador, no a un
perfil de usuario.

La aplicación ya permite registrar partidas terminadas asociadas a una lista.
Ese historial solo conserva resultado, fecha y rival. No representa una partida
viva y no debe convertirse en el almacén de rondas, suministros o puntuaciones.
Se conservarán dos conceptos distintos:

- **GameSession / Sesión de partida:** configuración, estado operativo y
  resultado recuperable de una partida, ya esté en preparación, en curso,
  finalizada o abandonada.
- **MatchRecord / Registro histórico:** resumen posterior asociado a una lista
  guardada.

Guardar una sesión del gestor no equivale a crear un registro estadístico. Al
finalizar, un usuario registrado podrá asociarla opcionalmente al historial de
una de sus listas mediante una confirmación explícita. Nunca sucederá de forma
silenciosa ni será requisito para conservar la sesión.

El catálogo actual ya contiene para cada misión:

- escala;
- suministro inicial;
- escalado de suministro;
- número de rondas;
- reglas de puntuación;
- condiciones adicionales;
- margen de victoria instantánea.

Hay cinco misiones en versión Skirmish y Standard. No existen versiones de
misión Grand Offensive. Por ello, cualquier límite de puntos seguirá usando una
de las variantes existentes elegida expresamente; la aplicación no inventará
valores de misión.

## 3. Fuentes de verdad

Se aplicará este orden:

1. El [reglamento incluido en el repositorio](./StarCraft-TMG_EN.pdf), en
   especial las secciones 5.5, 6, 8.3, 8.9 y 9.1.
2. Los datos validados de
   [src/catalog/data/scenarios.json](../src/catalog/data/scenarios.json).
3. Las reglas puras que se creen para el gestor.
4. La interfaz, que solo mostrará y solicitará cambios; no duplicará cálculos.

Una partida comenzada conservará el identificador y la versión de contenido de
la misión. También guardará una instantánea mínima de sus parámetros de juego
para que una actualización futura del catálogo no cambie una partida a medias.
Esa instantánea no será una segunda fuente editable del catálogo.

## 4. Alcance inicial acordado

### 4.1 Incluido

- Partida 1 contra 1.
- Nombre y raza de ambos jugadores.
- Un mismo límite de puntos para los dos jugadores.
- Selección explícita de una variante de misión Skirmish o Standard.
- Resumen de las reglas relevantes de la misión seleccionada.
- Gestión de ronda.
- Reserva de suministro de misión de la ronda actual y del siguiente avance.
- Puntuación de ambos lados y margen de victoria.
- Botones **-1/+1** para PV en cualquier momento, con mínimo cero.
- Aviso de victoria instantánea según la misión.
- Avanzar, deshacer, finalizar y abandonar una partida.
- Deshacer ronda sin modificar los PV.
- Autoguardado en base de datos y recuperación para invitados y usuarios
  registrados.
- Biblioteca de todas las partidas invitadas accesibles desde ese navegador.
- Sección **Mis partidas** para usuarios registrados.
- Preparación de partidas finalizadas para estadísticas agregadas futuras.
- Asociación opcional y explícita de una partida finalizada al historial de una
  lista guardada del usuario.
- Acceso «Empezar una partida como invitado» en la pantalla de login.
- Español e inglés.
- Móvil vertical y apaisado.

### 4.2 Fuera del primer alcance salvo confirmación

- Heridas y modelos individuales de cada unidad.
- Gestión completa de fases y activaciones.
- Tiradas de dados.
- Automatización del control de marcadores.
- Asistente de draft de misión o despliegue.
- Recursos de facción CP, BM o PE y su gasto.
- Suministro desplegado, disponible o destruido.
- Bajas, modelos vivos o reservas de cada ejército.
- Partidas 2v2, todos contra todos o con más de dos jugadores.
- Cartas de facción y uso de una lista guardada para configurar a un
  participante o dirigir la partida.
- Modificación automática del historial estadístico.

Estas capacidades quedan excluidas y no se diseñarán preventivamente en la
primera versión.

## 5. Flujo de configuración

La preparación tendrá una pantalla corta y validada antes de poder empezar.

### 5.1 Datos de la partida

- Un único límite de puntos compartido por ambos jugadores.
- Una carta de misión concreta, incluida su variante Skirmish o Standard.

En el modelo se llamará **pointLimit** y en la interfaz «Puntos de la partida».
Representa el límite común con el que ambos jugadores construyen sus ejércitos;
no se guardarán dos presupuestos independientes.

**pointLimit** admitirá cualquier entero positivo. Los valores 1.000 y 2.000
podrán aparecer como accesos rápidos, pero nunca serán los únicos posibles.

Los puntos no determinarán automáticamente la variante de misión. El selector
agrupará las variantes Skirmish y Standard bajo el nombre de cada misión y
mostrará sus diferencias. La variante elegida proporcionará literalmente el
suministro inicial, escalado, duración y margen de victoria instantánea.

La relación 1.000/Skirmish y 2.000/Standard se mostrará como recomendación, no
como bloqueo. Para límites distintos, incluidos los superiores a 2.000, se
seguirá usando la variante elegida; no se inventarán reglas Grand Offensive
mientras el catálogo no las contenga.

Los parámetros oficiales de la misión se mostrarán como solo lectura.

### 5.2 Participantes

Cada participante tendrá:

- nombre editable, con «Jugador 1» o «Jugador 2» como valor inicial;
- raza: Zerg, Terran o Protoss.

Durante la configuración no se seleccionará una carta de facción concreta ni se
vincularán listas guardadas. La raza solo identifica visualmente a cada jugador.
La asociación opcional con el historial de una lista se ofrecerá únicamente al
finalizar o al consultar después una partida finalizada.

### 5.3 Resumen antes de empezar

Antes de confirmar se mostrará:

- misión y variante seleccionada;
- límite común de puntos;
- nombre y raza de ambos jugadores;
- suministro de ronda 1;
- incremento de suministro;
- número máximo de rondas;
- umbral de victoria instantánea;

El botón **Empezar partida** solo estará activo cuando la configuración sea
coherente.

### 5.4 Accesos y guardado

- La pantalla de acceso tendrá un bloque neutral **Usar sin cuenta** con dos
  acciones: **Crear una lista** y **Empezar una partida**.
- Un invitado podrá abrir el configurador sin registrarse.
- Si ya existen partidas invitadas, el bloque mostrará también la activa más
  reciente con **Continuar** y un enlace **Ver todas (N)**. Crear una nueva
  nunca sobrescribirá otra.
- Las partidas de invitado se autoguardarán en la base de datos y podrán
  reabrirse desde el mismo navegador.
- Un usuario registrado podrá crear una partida desde la navegación y guardarla
  en la sección **Mis partidas**.
- Una partida guardada podrá reabrirse y continuar desde su última ronda y
  puntuación.
- El invitado podrá conservar todas las partidas que juegue, no solo una sesión
  activa.
- Iniciar sesión no borrará las partidas de invitado. Se ofrecerá la acción
  explícita **Guardar en mi cuenta** para reclamar la que el usuario elija.

## 6. Pantalla de partida

La pantalla debe priorizar cifras y acciones usadas en mesa. Las reglas largas
de la misión permanecerán disponibles en un panel desplegable, sin competir con
los controles principales.

### 6.1 Cabecera de estado

Siempre visibles:

- nombre de la misión;
- ronda «N de M»;
- suministro de la ronda actual;
- siguiente incremento, por ejemplo «Siguiente ronda: +2»;
- indicación «Sin límite» en la ronda final;
- estado de guardado.

### 6.2 Panel de cada participante

Cada lado mostrará:

- nombre y raza;
- total actual de puntos de victoria;
- botones grandes **-1** y **+1** para modificar PV en cualquier momento.

Los acentos de raza se limitarán al panel del participante. El fondo y el bloque
central serán neutrales para que una raza no defina visualmente toda la partida.

### 6.3 Bloque central

Debe expresar el estado en lenguaje, además de con cifras:

- «Empate» si ambos tienen los mismos PV;
- «Lidera Marta por 3 PV» cuando haya líder;
- progreso hacia el umbral de victoria instantánea;
- aviso destacado si se alcanza o supera ese umbral.

Alcanzar el umbral debe generar un aviso y ofrecer **Finalizar partida**. No debe
cerrarse automáticamente, porque los jugadores pueden necesitar comprobar la
condición o corregir un dato.

### 6.4 Acciones de ronda

Mientras no sea la ronda final se mostrarán:

- **Avanzar a ronda N + 1**, como acción principal;
- **Deshacer a ronda N - 1**, como acción secundaria visible;
- **Finalizar partida**, separada para evitar pulsaciones accidentales.

En la última ronda, **Avanzar ronda** desaparece o queda deshabilitado y se
mantiene un único botón **Finalizar partida**. Los controles se bloquearán
mientras se persiste una transición para impedir que un doble toque avance dos
rondas.

Junto a **Deshacer ronda** se mostrará el texto «Solo cambia ronda y
suministro; los PV se conservan». Así no se sugiere que el botón vaya a
deshacer correcciones de puntuación.

## 7. Reglas de suministro

La primera versión solo gestionará la reserva de suministro concedida por la
misión. Es una cifra común para ambos jugadores y se mostrará una sola vez en el
bloque central.

La interfaz y el modelo distinguirán:

- **Suministro inicial:** capacidad indicada por la misión para la ronda 1.
- **Escalado:** incremento aplicado al comienzo de cada ronda posterior.
- **Reserva de suministro de la ronda:** máximo que puede estar sobre el campo.

No se introducirán ni calcularán el suministro desplegado, el disponible, las
bajas, los modelos vivos o el suministro destruido. Si la misión concede PV por
suministro enemigo destruido, los jugadores sumarán esos PV mediante los
controles generales de puntuación.

### 7.1 Cálculo oficial

Para una ronda anterior a la final:

**reserva(ronda) = suministroInicial + escalado × (ronda - 1)**

En la primera ronda no se aplica incremento. En la ronda final, definida por la
misión, la reserva es **sin límite**, tal como indica el reglamento. Internamente
no se persistirá el valor numérico infinito; se representará con un estado
explícito de suministro limitado o ilimitado.

La reserva de la ronda se deriva de la misión y del número de ronda. No se
incrementará una cifra almacenada, ya que eso puede acumular errores tras
deshacer o recuperar una sesión.

### 7.2 Validaciones

- Todos los valores serán enteros.
- No se admitirá una ronda menor que 1 ni mayor que la duración.
- Los valores oficiales no serán negativos.

## 8. Puntos de victoria y margen

Cada jugador tendrá un total de PV editable durante cualquier ronda. Los
botones **+1** y **-1** afectarán únicamente al jugador seleccionado, guardarán
el nuevo total inmediatamente y no estarán vinculados al avance de ronda. El
total siempre será un entero mayor o igual que cero: **-1** estará deshabilitado
en cero y la regla de estado impedirá igualmente producir un valor negativo.

El alcance inicial no exigirá clasificar los PV por ronda o motivo. Las reglas
de puntuación de la misión seguirán visibles para que los jugadores sepan qué
cantidad añadir.

El margen también será derivado:

- **diferencia = PV del participante 1 - PV del participante 2**;
- **margen = valor absoluto de la diferencia**;
- el signo identifica al líder;
- una diferencia de cero significa empate.

La condición de victoria instantánea se cumple cuando el margen alcanza el
valor de **instantWinLead** de la misión. Una condición especial distinta seguirá
requiriendo confirmación humana.

Al llegar a la puntuación final se mostrará un recordatorio de que las unidades
que sigan en Reservas se consideran destruidas para el cálculo final. Las
condiciones que dependan de saber si quedan unidades o modelos serán
confirmaciones manuales mientras el gestor no realice seguimiento por unidad.

### 8.1 Finalización y resultado canónico

**Finalizar partida** abrirá una confirmación con el marcador, el margen y un
resultado propuesto. No cerrará la sesión con un solo toque.

- Si se ha alcanzado el margen de victoria instantánea, se propondrá como
  ganador al líder y el motivo **Victoria especial**.
- En los demás casos se propondrá victoria al jugador con más PV o empate si
  ambos tienen los mismos.
- Como el gestor no sigue unidades ni todas las condiciones especiales, los
  jugadores deberán confirmar el ganador o el empate y el motivo antes de
  guardar el resultado. Podrán corregir la propuesta cuando la mesa haya
  resuelto una concesión u otra condición no automatizada.

La confirmación convertirá la sesión en una instantánea final: estado
**finalizada**, fecha de finalización, PV de ambos jugadores, ganador —slot 1,
slot 2 o ninguno en empate— y motivo de finalización. La puntuación y la ronda
dejarán de ser editables. Reabrir una partida finalizada para modificarla queda
fuera del primer alcance.

### 8.2 Asociación opcional al historial de una lista

Una vez guardado el resultado, un usuario registrado podrá pulsar **Añadir al
historial de una lista**. El flujo será opcional y también estará disponible más
tarde desde el detalle de la sesión finalizada:

1. Elegir cuál de los dos jugadores representa al usuario.
2. Elegir una de sus listas guardadas cuya raza coincida con la de ese jugador.
3. Revisar el resultado proyectado desde su perspectiva y confirmar.

La proyección creará un único **MatchRecord**:

- victoria si el slot elegido es el ganador;
- derrota si ganó el otro slot;
- empate si la sesión no tiene ganador;
- fecha tomada de la finalización;
- nombre y raza tomados del rival;
- carta de facción rival sin informar, porque la sesión no registra ese dato.

La operación no modificará la composición ni la revisión de la lista. Será
atómica e idempotente: reintentar nunca creará dos registros históricos para la
misma sesión. La relación conservará los identificadores de sesión, lista y
registro. Si ese **MatchRecord** se borra después, la sesión finalizada seguirá
intacta y podrá volver a asociarse expresamente.

Una partida invitada podrá finalizarse y conservarse sin cuenta. Para asociarla
al historial de una lista, primero deberá guardarse expresamente en la cuenta;
no se reclamará ni se vinculará de forma automática.

## 9. Avanzar y deshacer ronda

Estas dos operaciones forman parte del motor de reglas y nunca se implementarán
como varios cambios sueltos desde React.

### 9.1 Avanzar ronda

Será una transición atómica:

1. Validar que la partida está activa y no se encuentra en la última ronda.
2. Incrementar la ronda una sola vez.
3. Recalcular la reserva de suministro a partir de misión y ronda.
4. Mantener intactos los PV de ambos jugadores.
5. Persistir el resultado completo.

Si el guardado falla, la interfaz debe mantener el estado anterior o indicar de
forma inequívoca que la copia no está protegida.

### 9.2 Deshacer ronda

**Deshacer ronda solo corrige la ronda y, por derivación, su reserva de
suministro. No modifica los PV.**

Comportamiento acordado:

- deshabilitado en ronda 1;
- etiqueta concreta, por ejemplo «Deshacer a ronda 2»;
- decremento de la ronda exactamente una vez;
- recálculo automático de la reserva de suministro de la ronda anterior;
- conservación exacta de los PV actuales;
- autoguardado inmediato.

Como la reserva se deriva y no existe otro estado por ronda, no hace falta una
pila de instantáneas. Si se pulsa por error, **Avanzar ronda** vuelve a la ronda
posterior sin alterar la puntuación.

## 10. Modelo de estado

La sesión debe tener un esquema versionado y validado. Como mínimo:

### 10.1 Identidad y ciclo de vida

- identificador estable;
- versión del esquema;
- versión de contenido;
- tipo de propietario: cuenta o identidad invitada;
- propietario de cuenta o ámbito invitado, nunca ambos simultáneamente;
- origen de creación: invitado o cuenta, conservado aunque después se reclame;
- estado: configuración, activa, finalizada o abandonada;
- fecha de creación y última modificación;
- fecha de finalización, cuando corresponda;
- ganador confirmado —slot 1, slot 2 o ninguno— y motivo de finalización;
- slot que el propietario identifica como suyo, opcional y solo necesario para
  proyectar el resultado a una lista.

### 10.2 Configuración inmutable tras empezar

- un único límite entero positivo de puntos compartido;
- identificador y parámetros efectivos de misión;
- exactamente dos jugadores, cada uno con nombre y raza;

Cambiar estos datos después de empezar exigirá reiniciar o crear otra partida.
No se permitirá que una corrección de PV cambie accidentalmente la misión.

### 10.3 Estado mutable

- ronda actual;
- total entero y no negativo de PV de cada jugador;
- revisión local o remota para evitar escrituras concurrentes.

Estos campos solo serán mutables mientras la sesión esté activa. Al finalizar,
su último valor quedará bloqueado como parte del resultado canónico.

### 10.4 Valores derivados

No se persistirán como fuente independiente:

- reserva de suministro de la ronda;
- próximo incremento;
- líder;
- margen;
- condición de victoria instantánea;

## 11. Persistencia y recuperación

La base de datos será el almacén definitivo de todas las partidas. Cada sesión
pertenecerá privadamente a uno de estos principales:

- **Cuenta:** asociada al identificador del usuario autenticado.
- **Invitado:** asociada a una identidad invitada generada por el servidor para
  ese navegador.

El servidor nunca aceptará un propietario elegido por el cliente. Para el modo
invitado emitirá una credencial opaca, aleatoria y de alta entropía en una
cookie segura, HttpOnly y SameSite. La base de datos conservará únicamente la
referencia o hash necesario para resolver ese ámbito. Conocer el UUID de una
partida no será suficiente para leerla o modificarla.

No se usará fingerprinting, dirección IP, user-agent, localStorage o IndexedDB
como identidad de autorización. El token invitado crudo no aparecerá en la base
de datos, respuestas, URLs o logs; su hash usará un secreto distinto del secreto
de sesiones de cuenta.

Un invitado podrá conservar todas las partidas que juegue. Podrá reabrirlas
desde el navegador que mantenga su credencial invitada. Si elimina las cookies o
datos del sitio perderá ese acceso, pero las sesiones no se borrarán
automáticamente por perder la credencial, por inactividad ni por dejar de ser
recuperables desde ese navegador. Permanecerán en la base de datos hasta una
acción de borrado autorizada y explícita.

En ambos ámbitos:

- autoguardar después de cada acción;
- validar y versionar todos los payloads;
- aplicar revisión optimista para impedir sobrescrituras silenciosas;
- detectar dos pestañas editando la misma sesión;
- mostrar la hora y el estado real del último guardado;
- filtrar toda lectura, actualización y borrado por el principal derivado de la
  sesión o credencial invitada.

IndexedDB no será el almacén definitivo. Actuará como caché de trabajo y cola de
salida para que una partida siga siendo operable sin conexión. Cada toque se
guardará localmente primero y se sincronizará en orden cuando vuelva la red. Un
UUID generado en cliente y una operación idempotente evitarán duplicados al
crear offline.

Estados visibles mínimos:

- **Guardada · 18:42**;
- **Guardando…**;
- **Sin conexión · N cambios pendientes**;
- **Servidor no disponible · cambios protegidos en este dispositivo**;
- **No se pudo sincronizar · Reintentar**;
- **Hay una versión más reciente**;
- **Guardando en tu cuenta…**.

Mientras existan cambios pendientes, la interfaz no afirmará que ya están
guardados en la base de datos. El estado tampoco dependerá de
**beforeunload**, que no es fiable en móviles.

### 11.1 Bibliotecas de partidas

Invitado y cuenta reutilizarán el mismo patrón de tarjetas:

- **Tus partidas en este navegador** para la identidad invitada.
- **Mis partidas** para el usuario autenticado.

Cada tarjeta mostrará:

- estado: en curso, finalizada o abandonada;
- misión;
- nombre y raza de Jugador 1 y Jugador 2;
- marcador actual;
- ronda actual;
- límite común de puntos;
- última modificación.
- estado de sincronización.

Acciones mínimas:

- **Continuar** para una partida activa;
- **Ver** para una partida finalizada;
- **Borrar**, con confirmación;
- **Nueva partida**.

En la pantalla de acceso no se incrustará la biblioteca completa. Si existen
partidas invitadas, el bloque **Usar sin cuenta** mostrará la activa más reciente
y un enlace **Ver todas (N)**.

La copia para invitado será «Guardada para este navegador». Se explicará que
iniciar sesión permite incorporarla a la cuenta y verla en otros dispositivos.
Incluirá **Borrar todas mis partidas invitadas**, que actuará también sobre el
servidor y no solo sobre la caché.

### 11.2 Guardar una partida invitada en la cuenta

El traspaso será siempre explícito:

1. El usuario pulsa **Guardar en mi cuenta** sobre una o varias partidas.
2. Inicia sesión si todavía no lo ha hecho.
3. Revisa qué partidas, nombres y resultados se incorporarán.
4. Confirma la operación.
5. El servidor cambia el propietario de invitado a cuenta de forma atómica e
   idempotente, manteniendo identificador, estado y origen.
6. Solo tras el éxito desaparece de la biblioteca invitada y aparece en
   **Mis partidas**.

Si falla, la propiedad invitada y su copia local se mantienen intactas. El
traspaso necesita conexión y no se encolará como una operación offline. Una
partida reclamada sigue siendo una sola fila y nunca cuenta dos veces en
estadísticas.

### 11.3 Estadísticas futuras y privacidad

Las partidas finalizadas, tanto de cuenta como invitadas, quedarán preparadas
para estadísticas agregadas futuras. Las sesiones activas o abandonadas no
contarán como resultados.

- Los nombres de jugadores son privados y no aparecerán en agregaciones,
  listados públicos ni índices.
- Las estadísticas usarán únicamente campos como misión, razas, puntos,
  resultado, margen y fecha agregada.
- Los resultados agregados deberán aplicar un tamaño mínimo de grupo antes de
  mostrarse para no identificar una partida concreta.
- Crear o modificar partidas invitadas tendrá límites de frecuencia y tamaño.
- El formulario invitado informará antes de empezar de que nombres y resultados
  se guardan en el servidor y enlazará las condiciones aplicables.
- Perder o revocar la credencial invitada no eliminará automáticamente la
  información. Las sesiones huérfanas permanecerán privadas y no recuperables
  por UUID; solo las finalizadas podrán contribuir a agregaciones.
- El borrado explícito solicitado desde una identidad todavía autorizada seguirá
  eliminando la sesión correspondiente del servidor.

La sesión de partida será la fuente preparada para estadísticas globales. La
tabla histórica ligada a listas solo recibirá, cuando el usuario lo confirme,
una proyección opcional para sus estadísticas personales; no será la fuente del
estado vivo ni de las agregaciones globales.

## 12. Separación técnica recomendada

Cuando se apruebe la implementación:

- **src/engine/game-session/**: tipos, cálculos y transiciones puras.
- **src/store/gameSessionStore.ts**: coordinación de estado, sin reglas
  duplicadas.
- **src/store/gameSessionPersistence.ts**: esquema, caché local y cola offline.
- **src/auth/gameSessionService.ts**: cliente HTTP para partidas de cuenta e
  invitado.
- **src/ui/game/**: configuración, tablero, paneles de participante, misión y
  confirmaciones.
- **src/i18n/**: rutas y textos completos en español e inglés.
- **server/src/modules/game-sessions/**: esquema, repositorio y rutas de
  partidas con principal de cuenta o invitado.
- **tests/engine/game-session/**: reglas y transiciones.
- **tests/store/** y **tests/ui/**: persistencia e interfaz.

### 12.1 Persistencia de servidor

La siguiente migración será **014_game_sessions.sql** y mantendrá tres
responsabilidades separadas:

- **game_guest_principals**: hash de la credencial invitada, creación, última
  actividad, estado y revocación, sin borrado en cascada al perder acceso;
- **game_sessions**: propietario excluyente de cuenta o invitado, estado,
  puntos, misión e instantánea oficial, ronda, resultado confirmado, slot propio
  opcional, revisión y fechas;
- **game_session_players**: exactamente los slots 1 y 2, nombre en texto plano
  limitado, raza y PV no negativos.

La restricción de propietario exigirá una cuenta o un principal invitado, pero
nunca ambos. Los dos jugadores se insertarán en la misma transacción. Un campo
opcional podrá identificar qué slot representa al propietario de cuenta para
estadísticas personales futuras; si no se informa, la sesión seguirá siendo
válida para estadísticas globales.

El servidor resolverá **missionId** contra el catálogo y construirá la
instantánea oficial. No aceptará del cliente suministro, duración o umbral de
victoria presentados como valores oficiales.

La API expondrá listado paginado, creación, lectura, comandos de PV y ronda,
finalización, abandono, borrado y **Guardar en mi cuenta**. El ámbito
**account** o **browser** será explícito cuando ambas credenciales coexistan.

La asociación histórica tendrá un comando propio y solo aceptará una lista del
propietario cuya raza coincida con el slot elegido. La migración añadirá a
**list_match_records** una referencia opcional y única a la sesión de origen.
El resultado **WIN/LOSS/DRAW** se calculará en servidor desde el ganador
confirmado y el slot del propietario. El enlace no hará a la sesión dependiente
del registro histórico: borrar este último no modificará la sesión.

Toda mutación exigirá la revisión conocida:

- revisión ausente: error de precondición;
- revisión obsoleta: conflicto sin modificar el estado;
- operación correcta: incremento de revisión exactamente una vez.

Las consultas filtrarán por propietario dentro del **WHERE** y responderán 404
si el identificador no pertenece al principal actual. No se cargará una partida
por UUID para comprobar la propiedad después.

Las rutas invitadas tendrán paginación, cuotas de sesiones y límites de
frecuencia y tamaño. Los nombres admitirán un máximo razonable, se tratarán
siempre como texto y no se escribirán en logs.

La funcionalidad tendrá rutas localizadas compartidas por ambos modos:

- **/es/partidas** y **/en/games** para la biblioteca del principal actual;
- **/es/partidas/nueva** y **/en/games/new** para configurar;
- una ruta de detalle por identificador para continuar o consultar.

La navegación autenticada la llamará **Mis partidas**. En invitado será
**Tus partidas en este navegador**. La pantalla de acceso enlazará a crear una
partida nueva o a la biblioteca invitada existente.

No se introducirá lógica de rondas en **App.tsx**, en los componentes React ni
en el store de listas. React enviará intenciones como avanzar, corregir PV o
deshacer; el motor devolverá el nuevo estado.

## 13. Diseño móvil y apaisado

La PWA ya permite cualquier orientación. No se debe bloquear el giro.

### 13.1 Retrato

- Cabecera compacta con misión, ronda y suministro.
- Paneles de participantes apilados.
- Totales de PV grandes y controles alcanzables con una mano.
- Margen y acciones de ronda visibles sin volver al inicio de la página.
- Reglas de misión plegadas por defecto.

### 13.2 Apaisado

En móviles de poca altura se usará un modo de mesa de tres columnas:

**Participante 1 | ronda, suministro, margen y acciones | Participante 2**

Requisitos:

- altura basada en **100dvh**;
- cabecera y navegación compactas;
- footer oculto durante la partida;
- sin barra inferior alta que reste superficie de juego;
- safe areas en los cuatro lados;
- sin scroll horizontal de página;
- scroll vertical disponible como escape en pantallas extremadamente pequeñas;
- PV, ronda, suministro y ambos botones de ronda visibles a la vez.

La aplicación actual decide casi todo por anchura. El gestor necesitará además
una regla específica para móvil apaisado, por ejemplo orientación horizontal y
altura máxima aproximada de 520 px.

### 13.3 Tamaños y comprobación visual

- Objetivos táctiles mínimos de 44 × 44 px.
- Números tabulares para evitar saltos al cambiar cifras.
- Ningún control fijo puede tapar contenido.
- Probar, como mínimo: 360 × 800, 390 × 844, 768 × 1024, 1024 × 768,
  844 × 390 y 740 × 360.
- Probar navegador y PWA instalada tanto en Android como en iOS cuando sea
  posible.

## 14. Accesibilidad y fiabilidad

- Cada botón más/menos tendrá un nombre accesible que incluya participante y
  magnitud.
- Los cambios de ronda, margen y victoria usarán una región anunciable sin
  repetir cada pulsación de forma molesta.
- El color no será la única señal de jugador, líder, empate, error o victoria.
- Foco visible, navegación por teclado y compatibilidad con zoom al 200 %.
- Respetar **prefers-reduced-motion**.
- Confirmar acciones destructivas o que descarten cambios.
- Bloquear dobles pulsaciones mientras se completa una transición.
- Girar la pantalla, recargar o volver desde segundo plano no debe alterar el
  estado.

## 15. Estrategia de pruebas

### 15.1 Motor

- Ronda 1 usa el suministro inicial.
- Cada ronda intermedia aplica exactamente un escalado.
- La ronda final es ilimitada.
- No se puede avanzar más allá del límite.
- Los dos totales de PV se actualizan correctamente y líder y margen se derivan
  de ellos.
- Empate y umbral de victoria instantánea.
- Valores inválidos de ronda, misión y límite de puntos.
- **+1** incrementa exactamente uno y **-1** nunca baja de cero.
- Avanzar dos veces rápidamente solo produce un avance.
- Avanzar y deshacer nunca modifican los PV.
- Deshacer decrementa la ronda y recupera la reserva derivada correcta.
- Secuencia completa avanzar, deshacer y volver a avanzar.
- Finalización propone ganador o empate desde los PV, pero persiste únicamente
  el resultado confirmado.
- Una sesión finalizada rechaza cambios posteriores de PV o ronda.

### 15.2 Persistencia

- Guardado después de cada tipo de acción.
- Creación, actualización, listado, reapertura y borrado de varias partidas de
  invitado en base de datos.
- Aislamiento entre dos identidades invitadas distintas.
- Creación, actualización, reapertura y propiedad de partidas de cuenta.
- Migración o rechazo seguro de versiones incompatibles.
- Aislamiento obligatorio entre usuarios.
- Separación entre partidas de invitado y de cuenta.
- Reclamo invitado a cuenta atómico e idempotente.
- Un fallo al reclamar conserva intacta la partida invitada.
- Cola offline, reintento sin duplicados y resolución de revisión conflictiva.
- Solo las partidas finalizadas entran en agregaciones estadísticas.
- Perder o revocar una credencial invitada no borra sus sesiones.
- Asociación a una lista autorizada y de la misma raza.
- Proyección correcta de victoria, derrota o empate desde el slot elegido.
- Reintentar la asociación no duplica el **MatchRecord**.
- Un invitado no puede asociar una sesión a una lista sin reclamarla primero.
- Omitir o borrar el registro histórico no altera la sesión finalizada.
- Detección de escrituras desde dos pestañas.

### 15.3 Interfaz

- Configuración válida e inválida.
- Exactamente dos jugadores con nombre y raza.
- Un único límite de puntos compartido.
- Cualquier límite entero positivo.
- Variantes Skirmish y Standard agrupadas y elegibles independientemente de los
  puntos.
- **Deshacer ronda** deshabilitado únicamente en ronda 1.
- **Avanzar ronda** ausente o deshabilitado únicamente en la ronda final.
- Controles **-1/+1** disponibles en cualquier ronda y **-1** deshabilitado en
  cero.
- Acceso de invitado desde la pantalla de login.
- Biblioteca de partidas invitadas del navegador.
- Biblioteca **Mis partidas** para usuarios registrados.
- Estados guardando, guardado, offline pendiente, error y conflicto.
- Flujo explícito **Guardar en mi cuenta**.
- Aviso de victoria instantánea.
- Confirmación de resultado antes de finalizar.
- Asociación opcional al historial al finalizar o desde el detalle posterior.
- Textos equivalentes en español e inglés.
- Orden de foco, etiquetas accesibles y estados de carga.
- Revisión visual en retrato y apaisado.

El proyecto no dispone todavía de pruebas E2E reales de navegador. Esta pantalla
es especialmente sensible a orientación, persistencia y dobles toques, por lo
que conviene añadir una cobertura E2E pequeña o, como mínimo, una matriz manual
documentada antes de publicarla.

## 16. Criterios de aceptación

1. El gestor aparece como página propia y no como paso del constructor.
2. Una partida puede configurarse sin modificar una lista en edición.
3. La configuración contiene exactamente dos jugadores con nombre editable y
   raza Zerg, Terran o Protoss.
4. Ambos jugadores comparten un único límite de puntos.
5. El límite admite cualquier entero positivo.
6. Elegir una variante de misión muestra sus valores reales de suministro, escalado,
   duración y victoria instantánea.
7. La variante de misión se elige expresamente y no se deduce de los puntos.
8. La ronda 1 comienza con el suministro inicial correcto.
9. Avanzar una ronda aplica el escalado una sola vez.
10. La ronda final muestra suministro sin límite.
11. No es posible avanzar más allá de la duración de la misión.
12. Cada jugador puede usar **-1/+1** en cualquier momento.
13. Los PV nunca son negativos y **-1** está deshabilitado en cero.
14. El líder y el margen siempre coinciden con los totales de PV.
15. Alcanzar el margen de victoria instantánea muestra un aviso, pero no
    finaliza sin confirmación.
16. Deshacer reduce la ronda en uno, recalcula su reserva y conserva exactamente
    los PV actuales.
17. Un doble toque no avanza ni retrocede dos rondas.
18. Recargar, cerrar, reabrir o girar el móvil conserva la partida.
19. La pantalla es plenamente operable a 360 px de ancho.
20. En 844 × 390 se ven los dos participantes, la ronda, el suministro, el
    margen, avanzar y deshacer sin scroll horizontal.
21. Todos los controles son accesibles y tienen objetivos táctiles adecuados.
22. La pantalla de acceso permite empezar una partida como invitado junto a la
    opción de crear una lista anónima.
23. Todas las partidas invitadas sincronizadas existen en la base de datos.
24. El invitado puede guardar y reabrir todas sus partidas desde el navegador
    que conserva su identidad invitada.
25. Una identidad invitada no puede acceder a partidas de otra.
26. Un usuario registrado dispone de **Mis partidas** y puede guardar, reabrir
    y continuar sus partidas.
27. Las partidas de otros usuarios no son accesibles por interfaz ni API.
28. **Guardar en mi cuenta** nunca se ejecuta automáticamente, no duplica la
    partida y no elimina la propiedad invitada si falla.
29. Sin conexión se puede seguir jugando, pero la interfaz indica que hay
    cambios pendientes de sincronizar.
30. Las estadísticas futuras solo usan partidas finalizadas y nunca exponen los
    nombres de los jugadores.
31. La funcionalidad está completa en español e inglés.
32. Finalizar siempre guarda un resultado confirmado y después bloquea ronda y
    PV de la sesión.
33. La sesión finalizada se conserva aunque el usuario omita o borre su
    proyección al historial de una lista.
34. Asociar una partida al historial es opcional, exige cuenta, slot propio y
    una lista de la misma raza, y nunca modifica la composición de esa lista.
35. Reintentar la asociación no duplica el registro histórico.
36. Perder la credencial invitada no borra automáticamente la información
    guardada en la base de datos.
37. Las reglas viven en TypeScript puro y tienen pruebas independientes de
    React.
38. Las comprobaciones generales del proyecto siguen pasando.

## 17. Orden de implementación futuro

Este orden solo se aplicará cuando se autorice expresamente la implementación:

1. Cerrar alcance y vocabulario.
2. Definir esquema versionado y transiciones puras.
3. Probar cálculos, avance y deshacer.
4. Crear persistencia de servidor y autorización para cuenta e invitado.
5. Implementar caché local, cola offline y recuperación.
6. Crear configuración y tablero de partida.
7. Crear bibliotecas invitada y **Mis partidas**.
8. Implementar el reclamo explícito de invitado a cuenta.
9. Integrar acceso invitado, navegación y rutas localizadas.
10. Adaptar retrato, apaisado y safe areas.
11. Añadir accesibilidad y protección frente a doble acción.
12. Realizar pruebas funcionales, de autorización y visuales.
13. Añadir la asociación histórica opcional e idempotente ligada a listas.
14. Actualizar PRD, pendientes e ideas para reflejar el nuevo alcance.

## 18. Decisiones adoptadas

1. La primera versión es exactamente 1 contra 1.
2. Cada jugador tiene un nombre editable y selecciona únicamente su raza:
   Zerg, Terran o Protoss.
3. Ambos jugadores comparten cualquier límite entero positivo de puntos.
4. El gestor solo calcula la reserva de suministro de la misión según la ronda.
5. La variante Skirmish o Standard se elige expresamente y no se calcula a
   partir de los puntos.
6. Los PV se modifican exclusivamente con **-1/+1**, nunca bajan de cero y se
   pueden cambiar en cualquier momento.
7. Avanzar o deshacer ronda nunca modifica los PV.
8. **Deshacer ronda** solo decrementa la ronda y recalcula su reserva de
   suministro.
9. Todas las partidas se guardan en la base de datos.
10. Un invitado puede conservar todas las partidas que juegue bajo la identidad
    invitada privada de ese navegador.
11. Los usuarios registrados disponen de **Mis partidas** y guardan sus sesiones
   privadas en la cuenta.
12. **Guardar en mi cuenta** reclama una partida invitada solo tras confirmación
    explícita.
13. Los nombres de jugadores y la raza forman parte de toda partida guardada.
14. Al finalizar se confirma y conserva un resultado canónico de la sesión.
15. Un usuario registrado puede proyectar opcionalmente ese resultado al
    historial de una lista compatible; nunca se hará de forma automática.
16. Las partidas invitadas no se eliminan automáticamente si se pierde o revoca
    la credencial del navegador; la información permanece en la base de datos.

## 19. Decisiones pendientes

No quedan decisiones funcionales pendientes para el alcance descrito. Cualquier
cambio posterior deberá registrarse primero en estas directrices antes de
autorizar su implementación.
