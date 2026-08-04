# PRD — Constructor de listas de ejército · StarCraft: The Miniatures Game

Versión 2.1 · Requisitos vigentes tras incorporar listas públicas, likes y términos legales

Este documento define el producto objetivo. El grado de cumplimiento y las
brechas detectadas están en [`08-AUDITORIA-2026-08-03.md`](08-AUDITORIA-2026-08-03.md)
y [`07-PENDIENTE.md`](07-PENDIENTE.md).

---

## 1. Objetivo

Aplicación web accesible desde escritorio y móvil que permita construir listas
para StarCraft: The Miniatures Game sin exigir una cuenta. Los usuarios
registrados pueden además guardarlas, sincronizarlas entre dispositivos y
gestionarlas desde su perfil.

El valor central no es «una hoja de cálculo bonita»: es **garantizar que la lista es legal**. El usuario debe poder confiar en que si la app dice que la lista es válida, lo es.

## 2. Usuarios

| Perfil | Contexto | Necesidad principal |
|---|---|---|
| Invitado | Primera visita o uso puntual | Crear, validar, intercambiar e imprimir una lista sin registrarse |
| Constructor | En casa, escritorio, con tiempo | Explorar composiciones, comparar costes, optimizar |
| Jugador en mesa | Club o tienda, móvil, con prisa | Consultar su lista y los perfiles de sus unidades |
| Oponente | Frente al usuario | Ver la lista rival (regla de listas abiertas, §9.1.10) |

## 3. Alcance de la versión 1

### Incluido
- Construcción de listas Zerg, Terran y Protoss completas y validadas.
- Constructor público para invitados en `/crear-lista`, sin acceso a datos de cuenta.
- Selección de cartas de misión y despliegue (disponible para las tres razas desde el inicio).
- Consulta del catálogo de cartas (unidades, facción, tácticas).
- Registro, acceso, verificación de correo, perfil y gestión de cuenta.
- Guardado remoto de múltiples listas por usuario con control de conflictos.
- Publicación opcional de listas, consulta en solo lectura y clonación para otros usuarios autenticados.
- Directorio de listas públicas con búsqueda, filtros, ordenación y likes por usuario.
- Importación y exportación de listas.
- Impresión: hoja resumen A4, cartas de las unidades incluidas, exportación a PDF.
- PWA instalable; el funcionamiento autenticado requiere conexión con la API.
- Interfaz en español, con nombres propios en inglés.

### Regla de idioma

Se traduce lo que explica, no lo que nombra. Nombres de unidades, armas, habilidades, cartas y palabras clave de regla permanecen en **inglés**, igual que en las cartas físicas. Textos de efecto, interfaz, errores y términos estructurales (Minerales, Suministro, Núcleo…) van en **español**.

### Excluido explícitamente
- Funcionamiento íntegro sin conexión y sincronización diferida.
- Acompañante de partida (heridas, recursos por ronda, fases).
- Asistente para ejecutar el draft en la mesa (tirada, descartes, afinidad de marcadores) — pendiente de confirmar.
- Partidas por equipos (§9.1.8).
- Listas cerradas (§9.1.10) — solo se contempla el modo abierto por defecto.
- Funcionalidades sociales fuera del directorio de listas públicas y sus likes.

## 4. Historias de usuario

Cada historia tiene criterios de aceptación verificables. `CA` = criterio de aceptación.

### Bloque A — Construcción

**US-01 · Elegir escala de enfrentamiento**
Como jugador, quiero fijar la escala de la partida para conocer mi presupuesto.
- CA-01.1 Se ofrecen Escaramuza (hasta 1 000), Estándar (hasta 2 000) y Gran Ofensiva (2 001+).
- CA-01.2 En Gran Ofensiva el usuario introduce el límite exacto de minerales.
- CA-01.3 El presupuesto de gas vespeno se calcula como el 10 % del límite de minerales y se muestra sin que el usuario lo introduzca.
- CA-01.4 Cambiar la escala a la baja no borra la lista: la marca como inválida e indica qué sobra.

**US-02 · Elegir raza y carta de facción**
Como jugador, quiero elegir mi carta de facción para conocer mis espacios iniciales y qué puedo incluir.
- CA-02.1 Se muestran las cartas de facción disponibles de la raza con sus etiquetas y espacios iniciales.
- CA-02.2 Al seleccionarla se muestran los espacios iniciales desglosados por tipo (Núcleo, Élite, Apoyo, Aéreo, Héroe).
- CA-02.3 Se muestra el recurso por ronda que aporta (CP, BM o PE) y sus habilidades.
- CA-02.4 Cambiar de carta de facción avisa de qué elementos de la lista dejarían de ser elegibles antes de confirmar.

**US-03 · Comprar cartas tácticas**
Como jugador, quiero gastar gas vespeno en cartas tácticas para desbloquear espacios de ejército.
- CA-03.1 Solo se ofrecen cartas cuyas etiquetas estén todas contenidas en las de la carta de facción.
- CA-03.2 Cada carta muestra su coste en gas y los espacios que otorga.
- CA-03.3 Las cartas marcadas UNIQUE solo pueden incluirse una vez; la app lo impide.
- CA-03.4 El contador de espacios totales por tipo se actualiza en el momento.
- CA-03.5 No se puede superar el presupuesto de gas.
- CA-03.6 El gas no gastado se muestra explícitamente como perdido (§9.1.4).

**US-03b · Seleccionar Creep Card (solo Zerg)**
Como jugador Zerg, debo incluir exactamente una Creep Card, porque mi carta de facción me obliga.
- CA-03b.1 Las Creep Cards se presentan en un bloque propio, separado de las tácticas.
- CA-03b.2 Mientras no haya ninguna seleccionada, la lista es ilegal y se avisa de forma persistente.
- CA-03b.3 No se puede seleccionar más de una.
- CA-03b.4 Su coste en gas computa en el límite de gas vespeno.
- CA-03b.5 El bloque no aparece en razas que no sean Zerg.

**US-04 · Reclutar unidades**
Como jugador, quiero añadir unidades gastando minerales y ocupando espacios.
- CA-04.1 Las unidades que **nunca** podrán formar parte del ejército (etiquetas incompatibles, otra raza, UNIQUE ya incluida) **no se muestran**.
- CA-04.1b Las unidades legales pero que ahora no caben (minerales o espacios insuficientes) **sí se muestran**, atenuadas, con su coste y el motivo, y no se pueden añadir.
- CA-04.2 Cada unidad muestra sus opciones de composición con número de modelos, coste y valor de suministro.
- CA-04.3 Al elegir una opción, la unidad ocupa tantos espacios de su tipo como su valor de suministro.
- CA-04.4 Si no quedan espacios libres del tipo requerido, la app lo indica y explica qué carta táctica lo desbloquearía.
- CA-04.5 No se pueden componer unidades con un número de modelos que no figure como opción.
- CA-04.6 Las unidades invocadas se pueden añadir para tener sus stats a mano, pero no cuestan minerales ni ocupan espacios (§9.1.9).
- CA-04.7 Las unidades invocadas se distinguen visualmente de las reclutadas, en pantalla y en la impresión.

**US-05 · Comprar mejoras**
Como jugador, quiero personalizar mis unidades con mejoras.
- CA-05.1 Se muestran las mejoras disponibles para la unidad con el coste correspondiente a la composición elegida.
- CA-05.2 Una mejora estándar se aplica a todos los modelos de la unidad.
- CA-05.3 Una mejora ESPECIALISTA se asigna a un modelo concreto, nominado por el usuario.
- CA-05.4 La misma mejora ESPECIALISTA no puede comprarse dos veces para la misma unidad.
- CA-05.5 Dos mejoras ESPECIALISTA distintas deben ir en modelos distintos.
- CA-05.6 Una mejora de reemplazo (`↑ POR arma`) sustituye el arma nombrada; la app muestra el equipo resultante de cada modelo.
- CA-05.7 Cambiar la composición de la unidad recalcula el coste de sus mejoras y avisa si alguna deja de ser aplicable.

**US-06 · Ver el estado de recursos en todo momento**
- CA-06.1 Minerales gastados / límite, gas gastado / límite y espacios ocupados / totales por tipo son visibles en cualquier paso.
- CA-06.2 Los excesos se señalan como error, no solo con un número en rojo.
- CA-06.3 Se muestran los espacios de todos los tipos que otorga la lista, **incluido Aéreo**.
- CA-06.4 Se muestra el recurso por ronda acumulado (CP, BM o PE) sumando facción y tácticas.
- CA-06.5 Se muestra el suministro total de la lista.
- CA-06.6 El límite de minerales es editable directamente, además de por escala predefinida.
- CA-06.7 La barra de recursos **nunca se oculta**: permanece visible en todos los pasos, al desplazar y en cualquier anchura de pantalla. En móvil puede contraer el detalle secundario, pero minerales, gas y espacios siguen visibles siempre.

**US-06b · Entender de dónde salen mis espacios**
Como jugador, quiero saber qué carta aporta cada espacio y qué unidad lo consume.
- CA-06b.1 Desglose por tipo de espacio con las cartas que lo otorgan y las unidades que lo ocupan.
- CA-06b.2 Cuando un error se debe a falta de espacios, se indica qué carta táctica lo resolvería y a qué coste.

**US-16 · Elegir misiones y despliegues**
Como jugador, quiero seleccionar las 2 cartas de misión y las 2 de despliegue que llevo al draft.
- CA-16.1 Se seleccionan exactamente 2 misiones y 2 despliegues, sin duplicados en el propio conjunto (§9.2).
- CA-16.2 Se ofrecen preferentemente las de la escala de la partida; las de otra escala se pueden elegir con aviso.
- CA-16.3 Cada misión muestra suministro inicial, escalado por ronda, duración, condiciones de puntuación y victoria instantánea.
- CA-16.4 Cada despliegue muestra dimensiones de mesa y el diagrama de posición de los marcadores.
- CA-16.5 Las 4 cartas se guardan con la lista y aparecen en la impresión.
- CA-16.6 Las cartas de escenario están disponibles con independencia de la raza elegida.

### Bloque B — Validación

**US-07 · Saber si mi lista es legal**
- CA-07.1 La app distingue **errores** (lista ilegal) de **avisos** (legal pero cuestionable, p. ej. espacios sin usar o recursos sin gastar).
- CA-07.2 Cada error indica la regla concreta del reglamento que se incumple y qué hacer para resolverlo.
- CA-07.3 Una lista con errores puede guardarse o imprimirse, pero se marca
  visiblemente como no válida tanto en pantalla como en la salida impresa.

### Bloque C — Gestión

**US-08 · Guardar y recuperar listas**
- CA-08.1 Varias listas guardadas con nombre, raza, escala y fecha.
- CA-08.2 Las listas se recuperan desde la cuenta en otro navegador o
  dispositivo.
- CA-08.3 Duplicar una lista para crear variantes.
- CA-08.4 Cada lista registra la versión del catálogo con la que se creó.
- CA-08.5 Si el catálogo cambia y afecta a una lista guardada, la app avisa y detalla qué cambió.
- CA-08.6 Una actualización debe incluir la revisión conocida y avisar si otra
  sesión modificó la lista.
- CA-08.7 Guardar, cargar, renombrar o borrar listas remotas requiere una sesión
  válida y el nivel de verificación exigido por la cuenta; nunca está disponible
  para un invitado.

**US-09 · Compartir listas por fichero**
- CA-09.1 Exportar a fichero JSON.
- CA-09.2 Importar desde fichero, con validación y mensaje claro si el fichero no es válido.
- CA-09.3 Importar y exportar JSON está disponible también en el constructor de
  invitado y se realiza localmente, sin guardar la lista en la API.

**US-09b · Compartir listas por seed**
Como jugador, quiero compartir una lista pegando un código corto en un chat, y recuperarla pegándolo en la app.
- CA-09b.1 Cualquier lista genera un seed que la codifica **por completo**, sin depender de ningún servidor.
- CA-09b.2 El seed se copia al portapapeles con un solo gesto.
- CA-09b.3 Pegar un seed reconstruye la lista idéntica al original.
- CA-09b.4 Un seed incompleto o alterado se detecta y se rechaza con un mensaje claro; nunca produce una lista incorrecta en silencio.
- CA-09b.5 Un seed creado con otra versión del catálogo se importa igualmente, detallando qué costes cambiaron o qué elementos ya no existen.
- CA-09b.6 El seed usa un alfabeto sin caracteres ambiguos, para poder dictarse en voz alta.
- CA-09b.7 El seed es autocontenido y no referencia un registro remoto.
- CA-09b.8 Generar e importar seeds está disponible también para invitados y no
  exige una sesión.

**US-14 · Publicar y descubrir listas** — ✅ Implementada

Como usuario autenticado, quiero publicar una lista para que otros usuarios
puedan consultarla, valorarla y clonarla sin modificar mi original.

- CA-14.1 Una lista nueva es privada por defecto y el propietario puede cambiar
  su visibilidad antes de guardarla.
- CA-14.2 Una lista pública se puede ver en modo solo lectura y clonar como una
  copia independiente.
- CA-14.3 Solo el propietario puede editar, hacer privada o borrar la lista
  original.
- CA-14.4 Cada usuario puede dar como máximo un like a cada lista pública y
  retirarlo posteriormente.
- CA-14.5 El directorio muestra el contador de likes y permite ordenar por las
  listas más valoradas.
- CA-14.6 El acceso al directorio y a las listas públicas requiere iniciar
  sesión.

**US-15 · Aceptar los términos de uso** — ✅ Implementada

Como usuario que crea una cuenta, debo aceptar los términos y condiciones
mediante una casilla obligatoria con enlace a la página legal.

- CA-15.1 La página legal está accesible desde el footer y desde el enlace del
  formulario de registro.
- CA-15.2 El registro no continúa si no se aceptan los términos.
- CA-15.3 El titular se identifica mediante el dominio `starcraft-builder.com`.

### Bloque D — Consulta

**US-10 · Consultar cartas**
- CA-10.1 Buscador de unidades, cartas de facción y cartas tácticas.
- CA-10.2 Filtros por raza, tipo de espacio, rol de combate y etiquetas.
- CA-10.3 Ficha completa con perfil, armas, habilidades, mejoras y costes.
- CA-10.4 Accesible sin haber creado ninguna lista.

### Bloque E — Impresión

**US-11 · Imprimir la hoja de lista**
- CA-11.1 Hoja A4 con: nombre, escala, carta de facción, cartas tácticas, Creep Card, unidades con composición y mejoras por modelo, misiones y despliegues elegidos, y desglose de recursos y espacios.
- CA-11.2 Legible en blanco y negro.
- CA-11.3 Sin elementos de interfaz en la salida impresa.
- CA-11.4 La impresión está disponible para invitados. Si la lista es inválida,
  se permite continuar y la hoja incluye un aviso inequívoco.

**US-12 · Imprimir las cartas de las unidades**
- CA-12.1 Se imprimen las cartas de las unidades incluidas en la lista.
- CA-12.2 Formato apto para recortar, con las dos caras de cada carta.
- CA-12.3 Las cartas son la imagen original en inglés recortada del PDF, no una regeneración.
- CA-12.4 Se puede elegir qué cartas imprimir, sin obligar a imprimirlas todas.

**US-13 · Exportar a PDF**
- CA-13.1 Descarga de un PDF con el mismo contenido que la impresión.
- CA-13.2 Se genera en el cliente mediante la vista de impresión del navegador.

### Bloque F — Plataforma

**US-14 · Usar la app en el móvil**
- CA-14.1 Interfaz utilizable en pantallas desde 360 px de ancho.
- CA-14.2 Objetivos táctiles adecuados; nada que requiera precisión de ratón.
- CA-14.3 Sin pérdida de funcionalidad respecto a escritorio.

**US-15 · Instalar la aplicación**
- CA-15.1 Instalable como PWA.
- CA-15.2 Si la API no responde, las funciones de cuenta muestran un estado de
  servicio no disponible y una acción de reintento. El constructor público puede
  seguir funcionando mientras sus recursos estáticos estén disponibles.
- CA-15.3 La documentación y la interfaz no prometen edición offline mientras
  no existan caché completa, borrador durable y sincronización posterior. El
  borrador invitado en RAM no constituye soporte offline ni recuperación.

### Bloque G — Cuenta y seguridad

**US-17 · Acceder y verificar la cuenta**
- CA-17.1 Registro y acceso con correo y contraseña.
- CA-17.2 El guardado remoto, «Mis listas» y el perfil exigen sesión y el nivel
  de verificación correspondiente; el constructor público `/crear-lista` no.
- CA-17.3 La verificación puede reenviarse sin crear otra cuenta.
- CA-17.4 Un fallo de correo no deja una cuenta irrecuperable.
- CA-17.5 El superadministrador puede verificar o desverificar una cuenta a mano
  desde su panel, sin token y sin poder aplicarlo a la suya propia.
- CA-17.6 Al verificar una cuenta a mano, su titular recibe un correo que lo
  comunica; si ese envío falla, la cuenta sigue verificada y el administrador ve
  el aviso.
- CA-17.7 Entrar con Google no exige verificación propia, y sólo se acepta si
  Google confirma el correo. Si ya existía una cuenta con ese correo, se vincula
  en lugar de duplicarla.
- CA-17.8 Una cuenta de Google puede añadir contraseña y conservar ambos
  accesos. Las operaciones sensibles sin contraseña se reautentican con Google.

**US-18 · Recuperar el acceso**
- CA-18.1 El usuario puede solicitar un enlace sin revelar si el correo existe.
- CA-18.2 El enlace es aleatorio, de un solo uso y con caducidad corta.
- CA-18.3 La web dispone de una pantalla funcional para establecer la nueva
  contraseña.

**US-19 · Administrar con privilegios explícitos**
- CA-19.1 Los roles proceden de la base de datos y no de un correo codificado.
- CA-19.2 El primer administrador se provisiona fuera del registro público.
- CA-19.3 Las operaciones sensibles exigen cuenta verificada, reautenticación y
  registro de auditoría.
- CA-19.4 Registro, acceso y correo tienen límites de intentos.

**US-20 · Crear una lista como invitado**

Como visitante, quiero probar el constructor y obtener una lista utilizable sin
crear primero una cuenta.

- CA-20.1 `/crear-lista` es una URL pública y abre exclusivamente el constructor.
- CA-20.2 El invitado puede crear, editar, validar, importar y exportar JSON,
  generar o importar un seed e imprimir o guardar como PDF.
- CA-20.3 El invitado no puede guardar remotamente, abrir «Mis listas» ni acceder
  al perfil; la interfaz no muestra esas acciones y la API continúa rechazándolas
  sin una sesión válida.
- CA-20.4 El borrador se mantiene únicamente en RAM y se pierde al recargar,
  cerrar la pestaña o abandonar el flujo. La interfaz lo comunica antes de que
  el usuario empiece y al intentar salir con cambios.
- CA-20.5 Si el invitado inicia sesión o se registra dentro de la misma ejecución
  de la SPA, el borrador permanece en memoria y, después de autenticarse y
  verificarse, puede guardarlo en su cuenta.
- CA-20.6 La transición a autenticación no envía ni persiste el borrador hasta
  que el usuario autenticado ejecuta expresamente «Guardar».

## 5. Requisitos no funcionales

| Requisito | Criterio |
|---|---|
| Rendimiento | Validación de una lista completa por debajo de 50 ms; interacción sin latencia perceptible |
| Carga inicial | Aplicación utilizable en menos de 3 s en 4G |
| Fiabilidad de datos | Cobertura de pruebas del motor de reglas al 100 % de las reglas R1–R10 |
| Accesibilidad | Contraste AA; navegación por teclado en escritorio |
| Privacidad | El borrador invitado no se envía a la API; sólo un guardado remoto explícito tras autenticarse transmite la lista. Contraseñas únicamente sobre HTTPS y almacenadas como hash Argon2id |
| Mantenibilidad | Añadir una raza nueva no debe requerir cambios en el motor de reglas ni en la interfaz |

## 6. Métrica de éxito

La versión 1 se considera terminada cuando:
1. La lista de ejemplo del reglamento se reproduce en la app y valida con el desglose exacto de minerales y espacios que aparece impreso en el manual.
2. El usuario construye una lista Zerg completa, la imprime y la usa en una partida real sin necesitar consultar el PDF.
3. Las tres razas se cargan sin duplicar reglas en la interfaz.
4. Una lista guardada se recupera desde otro dispositivo con la misma cuenta.
5. Los flujos de registro, verificación, recuperación y autorización superan
   pruebas de integración y E2E.
6. Un invitado completa el flujo público, imprime la lista y comprueba que no
   puede acceder al guardado remoto, «Mis listas» ni perfil.
