# Plan de autenticación, cuenta y listas sincronizadas

## Objetivo

Permitir que cada jugador se registre e inicie sesión, guarde sus listas en su
cuenta y pueda cargarlas desde cualquier dispositivo. La cuenta tendrá un panel
para cambiar la contraseña y elegir una facción predeterminada. Al crear una
lista nueva tras iniciar sesión, se usará esa facción.

Este documento comenzó como planificación y ahora sirve como referencia de la
implementación en curso.

## Alcance funcional

- Registro con correo electrónico y contraseña.
- Inicio y cierre de sesión, verificación de correo y restablecimiento de
  contraseña.
- Acceso al constructor y a cualquier dato de la aplicación sólo después de
  iniciar sesión.
- Guardar, listar, cargar, renombrar y borrar listas propias en la nube.
- Panel de cuenta con cambio de contraseña y facción predeterminada.
- Guardado y carga exclusivamente desde la base de datos de la aplicación.
- Borrado físico de listas propias y borrado lógico de cuentas.

No forma parte de la primera versión: compartir listas entre usuarios,
colaboración en tiempo real, perfiles públicos ni inicio de sesión social.

## Arquitectura propuesta

La interfaz React no debe acceder directamente a la API ni a la base de datos.
Se introducirá una capa de aplicación con dos contratos: autenticación y
repositorio de listas. Así se preserva el motor de reglas y se mantiene aislado
el protocolo del backend.

```text
React (pantallas y componentes)
        |
Zustand (sesión, preferencias, lista en edición)
        |
auth/AuthService.ts        lists/ListRepository.ts
        |                         |
API propia                 Base de datos remota con propiedad por usuario
        |
Correo / restablecimiento
```

La solución usará un **backend propio** con una API y una base de datos
centralizada. La implementación usará MariaDB mediante XAMPP en desarrollo:
encaja con la relación usuario-listas, permite restricciones e índices claros y
facilita copias de seguridad. El cliente sólo hablará con la API; nunca con la
base de datos.

```text
Cliente React/PWA
        |
      HTTPS
        |
API propia
  |- autenticación y sesiones
  |- perfiles y preferencias
  |- listas y validación de propiedad
        |
MariaDB centralizada
```

## Modelo de datos remoto

Las contraseñas nunca se guardan en texto plano ni se procesan en el cliente.
El backend almacenará exclusivamente hashes con Argon2id y gestionará sesiones
de corta duración con renovación segura.

### Usuario y perfil

```text
users
  user_id: UUID, clave primaria
  email: texto único, normalizado
  password_hash: texto, sólo accesible al backend
  email_verified_at: fecha UTC o nulo
  deleted_at: fecha UTC o nulo; nulo significa cuenta activa
  created_at: fecha UTC
  updated_at: fecha UTC

profiles
  user_id: UUID, clave primaria y referencia a users
  default_race: ZERG | TERRAN | PROTOSS
  created_at: fecha UTC
  updated_at: fecha UTC
```

### Lista guardada

```text
saved_lists
  id: UUID, clave primaria
  owner_id: UUID, propietario autenticado
  name: texto
  race: ZERG | TERRAN | PROTOSS
  payload: JSON (ArmyList validada)
  catalog_content_version: texto
  schema_version: texto
  created_at: fecha UTC
  updated_at: fecha UTC
```

La API debe permitir leer y escribir sólo cuando `owner_id` coincida con el
usuario autenticado de la sesión. El servidor asignará el propietario; el
cliente no podrá elegirlo ni modificarlo.

Al borrar una lista, el servidor eliminará físicamente sólo esa fila, tras
comprobar su propietario. Al borrar una cuenta, se establecerá `deleted_at`, se
revocarán todas sus sesiones y se bloqueará cualquier acceso futuro. Sus listas
no se eliminarán automáticamente: quedarán asociadas al usuario desactivado y
no serán accesibles mientras la cuenta permanezca borrada lógicamente.

## Estructura prevista

Esta es la estructura objetivo para la futura implementación; aún no se crean
estos módulos.

```text
src/
  auth/
    AuthService.ts          contrato de autenticación
    authClient.ts           cliente de la API de autenticación
    authTypes.ts
  lists/
    ListRepository.ts       contrato de almacenamiento de listas
    remoteListRepository.ts adaptador de base de datos remota
  store/
    authStore.ts            sesión, carga y estado de autenticación
    preferencesStore.ts     preferencias del perfil
    listStore.ts            lista en edición (existente)
  ui/
    auth/
      LoginPage.tsx
      RegisterPage.tsx
      ResetPasswordPage.tsx
    lists/
      SavedListsPage.tsx
    account/
      AccountPage.tsx
      PasswordForm.tsx
      DefaultRaceForm.tsx
      DeleteAccountForm.tsx
  routes/
    RequireAuthenticatedUser.tsx
server/                         futuro backend propio
  src/
    app.ts                       creación del servidor y rutas
    config/                      entorno y configuración segura
    modules/
      auth/                      registro, sesión, contraseña y correo
      users/                     perfil y preferencias
      lists/                     CRUD y autorización de listas
    db/
      migrations/                evolución versionada de MariaDB
      repositories/              acceso a datos, aislado de las rutas
    middleware/                  autenticación, errores y límites
  tests/
    integration/                 API, autorización y base de datos
```

También se añadirán ejemplos de entorno separados para cliente y servidor. El
cliente sólo conocerá `VITE_API_BASE_URL`; el servidor conservará `DATABASE_URL`,
secretos de sesión, configuración de correo y cualquier clave privada. Las
credenciales reales nunca se incluirán en Git.

## Flujos de usuario

### Usuario sin sesión

1. Sólo puede acceder a las pantallas de registro, inicio de sesión y
   recuperación de contraseña.
2. Cualquier ruta del constructor, de listas o de cuenta redirige a inicio de
   sesión.
3. Una vez autenticado y con correo verificado, accede al constructor y a sus
   listas remotas.

### Usuario autenticado

1. Al abrir la aplicación se recuperan perfil y listas guardadas.
2. «Nueva lista» usa `default_race`; si no hay preferencia, usa Zerg.
3. «Guardar» crea o actualiza la lista remota y muestra su estado.
4. El panel «Mis listas» permite cargar, renombrar y borrar sólo las listas
   propias.
5. El panel «Cuenta» permite cambiar contraseña y facción predeterminada.
6. El panel permite borrar la cuenta con una confirmación reforzada. La acción
   es lógica: cierra las sesiones y desactiva la cuenta.

### Conflictos de edición

- Antes de guardar, cada lista se validará con el esquema `armyListSchema`.
- Cada actualización enviará la fecha o versión conocida por el cliente.
- Si la lista remota cambió mientras se editaba, se avisará antes de
  sobrescribir. No se aplicará un «última escritura gana» silencioso.

## Seguridad y privacidad

- Hashes de contraseña con Argon2id, sal única por contraseña y parámetros
  revisables.
- Verificación de correo obligatoria antes de habilitar el guardado y la carga
  de listas.
- Restablecimiento de contraseña mediante un enlace propio, aleatorio, de un
  solo uso y con caducidad corta.
- Cambio de contraseña sólo en una sesión válida y con reautenticación.
- Borrado lógico de cuenta sólo tras reautenticación y una confirmación
  explícita; revoca todas las sesiones activas inmediatamente.
- Cookies de sesión `HttpOnly`, `Secure` y `SameSite`, protección CSRF cuando
  corresponda y rotación de tokens al renovarlos.
- Límites de intentos y mensajes de error que no revelen si un correo existe.
- Validar el `payload` tanto en cliente como en servidor antes de guardarlo.
- Usar HTTPS en producción, rotar claves expuestas y limitar las variables de
  entorno públicas a las estrictamente necesarias.
- Definir retención y recuperación de cuentas antes del lanzamiento. El
  borrado de cuenta será lógico y no eliminará listas automáticamente.

## Fases de desarrollo

### Fase 0 - Decisiones y preparación

- Confirmar MariaDB como base de datos, dominio de correos y entorno de
  despliegue del backend.
- Definir textos legales de privacidad y conservación de datos.
- Crear proyecto remoto, entornos de desarrollo y producción, y un documento
  de variables de entorno.

**Salida:** backend y base de datos de desarrollo provisionados, sin código de
producto aún.

### Fase 1 - Base de datos y autenticación

- Crear tablas, índices, restricciones y migraciones versionadas.
- Implementar los contratos `AuthService` y `ListRepository` con el cliente de
  la API propia.
- Implementar registro, inicio/cierre de sesión, verificación y recuperación
  de contraseña.
- Proteger todas las rutas de producto con
  `RequireAuthenticatedUser` y comprobar la sesión al recargar la página.
- Añadir pruebas de autorización que demuestren que un usuario no puede leer ni
  modificar listas de otro.

**Salida:** dos cuentas de prueba aisladas entre sí y autenticación operativa.

### Fase 2 - Guardado y carga de listas

- Crear el repositorio remoto y mapear `ArmyList` a `saved_lists`.
- Retirar IndexedDB y las acciones de guardado/carga local actuales.
- Añadir estados de carga, error y reintento; no perder cambios al fallar la
  red.
- Implementar panel «Mis listas» y carga de una lista en el editor.
- Añadir borrado físico de listas con confirmación y autorización por
  propietario.

**Salida:** un usuario puede guardar, abrir, renombrar y borrar sus listas
desde dos sesiones distintas.

### Fase 3 - Cuenta y preferencias

- Implementar lectura y actualización del perfil.
- Añadir selector de facción predeterminada.
- Aplicar la preferencia sólo al crear listas nuevas, nunca al abrir una lista
  existente.
- Implementar cambio de contraseña y sus estados de seguridad.
- Implementar el borrado lógico de cuenta, revocación de sesiones y pantalla
  de confirmación reforzada.

**Salida:** al iniciar sesión, una lista nueva toma la facción elegida en el
panel de cuenta.

### Fase 4 - Calidad y despliegue

- Pruebas unitarias de adaptadores y stores.
- Pruebas de integración para políticas de acceso y control de conflictos.
- Pruebas E2E: registro, inicio, guardado, carga, cambio de contraseña y
  preferencia de facción.
- Revisión de accesibilidad, estados sin conexión, telemetría de errores y
  copias de seguridad de la base de datos.
- Despliegue gradual con cuentas de prueba antes de habilitarlo a todos.

## Criterios de aceptación

- Un usuario no autenticado no puede acceder a listas de otra cuenta.
- Un usuario no autenticado no puede acceder al constructor, a las listas ni al
  panel de cuenta, incluso navegando directamente a sus URL.
- Una lista guardada por una cuenta se recupera correctamente desde otro
  navegador tras iniciar sesión.
- Ninguna lista se guarda fuera de la base de datos centralizada de la
  aplicación.
- Cambiar la facción predeterminada afecta a la siguiente lista nueva y no
  altera listas guardadas.
- Cambiar o recuperar contraseña no expone contraseñas ni tokens en consola,
  URL persistente o repositorio.
- Borrar una lista elimina únicamente la lista seleccionada del propietario.
- Borrar una cuenta establece su marca de borrado lógico, revoca sus sesiones
  y conserva sus datos para una posible recuperación administrativa.
- La validación del motor sigue siendo la única fuente de verdad para la
  legalidad de una lista.

## Decisiones confirmadas

1. Confirmado: backend propio con una base de datos centralizada.
2. Confirmado: acceso inicial sólo con correo y contraseña.
3. Confirmado: no habrá listas locales; todas se guardan en la base de datos
   centralizada de la aplicación.
4. Confirmado: el correo debe verificarse antes de poder guardar o cargar
   listas.
5. Confirmado: la aplicación sólo es accesible para usuarios autenticados; las
   únicas pantallas públicas son registro, acceso y recuperación de contraseña.
6. Confirmado: las listas se borran físicamente; las cuentas se borran de forma
   lógica, conservando los datos y bloqueando el acceso.
