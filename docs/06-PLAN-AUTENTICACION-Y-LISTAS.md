# Estado de autenticación, cuenta y listas sincronizadas

## Objetivo

Permitir que cada jugador se registre e inicie sesión, guarde sus listas en su
cuenta y pueda cargarlas desde cualquier dispositivo. La cuenta tendrá un panel
para cambiar la contraseña y elegir una facción predeterminada. Al crear una
lista nueva tras iniciar sesión, se usará esa facción.

Este documento comenzó como planificación y ahora describe la implementación
vigente, sus garantías y sus brechas. Los hallazgos priorizados están en
[`08-AUDITORIA-2026-08-03.md`](08-AUDITORIA-2026-08-03.md).

## Alcance funcional

- Registro con correo electrónico y contraseña.
- Inicio y cierre de sesión y verificación de correo. La API de recuperación de
  contraseña existe, pero la interfaz `/reset-password` todavía no.
- Acceso al constructor y a cualquier dato de la aplicación sólo después de
  iniciar sesión.
- Guardar, listar, cargar, renombrar y borrar listas propias en la nube.
- Panel de cuenta con cambio de contraseña y facción predeterminada.
- Guardado y carga exclusivamente desde la base de datos de la aplicación.
- Borrado físico de listas propias y borrado lógico de cuentas.

No forma parte de la primera versión: compartir listas entre usuarios,
colaboración en tiempo real, perfiles públicos ni inicio de sesión social.

## Arquitectura actual

La interfaz React accede a la API mediante `src/auth/authService.ts` y
`src/auth/listService.ts`; nunca accede directamente a MariaDB. Zustand conserva
la sesión y la lista en edición. El motor de reglas permanece independiente del
protocolo y de React.

```text
React (pantallas y componentes)
        |
Zustand (sesión, preferencias, lista en edición)
        |
authService.ts             listService.ts
        |                         |
API propia Express con autorización por sesión
        |
MariaDB · SMTP
```

La solución usa un **backend propio** con una API y una base de datos
centralizada. En desarrollo puede usarse MariaDB mediante XAMPP:
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

Las contraseñas nunca se guardan en texto plano. El backend almacena hashes con
Argon2id y emite JWT de 15 minutos en cookies `HttpOnly`; no existe renovación
automática de sesión.

### Usuario y perfil

```text
users
  user_id: UUID, clave primaria
  email: texto único, normalizado
  password_hash: texto, sólo accesible al backend
  email_verified_at: fecha UTC o nulo
  deleted_at: fecha UTC o nulo; nulo significa cuenta activa
  is_active: booleano administrativo
  session_version: entero; revoca sesiones anteriores
  last_login_at: fecha UTC o nulo
  created_at: fecha UTC
  updated_at: fecha UTC

profiles
  user_id: UUID, clave primaria y referencia a users
  default_race: ZERG | TERRAN | PROTOSS
  nickname: texto o nulo
  avatar: texto o nulo
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
  revision: entero para control optimista
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

### Otras tablas

```text
account_tokens        verificación y recuperación; hash, propósito y caducidad
app_settings          configuración SMTP cifrada con AES-256-GCM
email_delivery_logs   resultado y diagnóstico de cada intento de correo
schema_migrations     migraciones aplicadas
```

## Estructura implementada

```text
src/
  auth/
    authService.ts          cliente de cuenta, perfil y administración
    listService.ts          cliente de listas remotas
  store/
    authStore.ts            sesión, carga y estado de autenticación
    listStore.ts            lista en edición y valores derivados
  ui/
    auth/AuthGate.tsx       acceso, registro y verificación
    lists/
      SavedListsPage.tsx
    account/
      AccountPage.tsx
      SuperAdminPanel.tsx
server/
  src/
    app.ts                       creación del servidor y rutas
    config/                      entorno y configuración segura
    modules/
      auth/                      registro, sesión, contraseña y correo
      lists/                     CRUD y autorización de listas
      admin/                     usuarios, SMTP y registros de correo
      email/                     transporte, configuración y trazas
    db/
      migrations/                evolución versionada de MariaDB
    middleware/                  autenticación y correo verificado
```

`.env.example` documenta el entorno común en la raíz. El cliente sólo conoce
`VITE_API_BASE_URL`; el servidor conserva `DATABASE_URL`,
secretos de sesión, configuración de correo y cualquier clave privada. Las
credenciales reales nunca se incluirán en Git.

## Flujos de usuario

### Usuario sin sesión

1. Puede acceder a registro, inicio de sesión y verificación. La recuperación
   existe en la API, pero carece de pantallas y cliente en la web.
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

### Implementado

- Hashes de contraseña con Argon2id.
- Tokens aleatorios de 32 bytes almacenados como SHA-256, de un solo uso y con
  30 minutos de caducidad.
- Cookie de sesión `HttpOnly`, `SameSite=Lax`, `Secure` en producción, ruta
  `/api` y 15 minutos de duración.
- `session_version` revoca sesiones al cambiar contraseña, desactivar o borrar
  una cuenta.
- Reautenticación para cambio de contraseña y borrado lógico de cuenta.
- Consultas parametrizadas y filtrado de listas por propietario en servidor.
- Contraseña SMTP cifrada con AES-256-GCM derivada de `SESSION_SECRET`.

### Brechas abiertas

- **Crítica:** el superadministrador se reconoce por un correo fijo en código y
  no se exige que esté verificado. Debe sustituirse por roles persistidos y un
  bootstrap fuera del registro público.
- No existen límites de intentos para registro, acceso o recuperación.
- La recuperación tiene API, pero no interfaz; tampoco hay reenvío de
  verificación.
- Si SMTP falla durante el registro, el usuario ya está creado y puede quedar
  bloqueado. En una base vacía de producción esto también impide configurar
  SMTP de forma segura desde el propio panel.
- El servidor valida la estructura del payload, no sus referencias de catálogo
  ni su legalidad.
- No hay pruebas de integración de autenticación, autorización, administración
  o MariaDB ni pruebas E2E.
- Rotar `SESSION_SECRET` invalida sesiones y hace necesario volver a configurar
  la contraseña SMTP cifrada.
- Deben definirse retención, copias de seguridad y recuperación de cuentas
  antes del lanzamiento.

## Estado de implementación

| Área | Estado |
|---|---|
| Registro, login, logout y sesión | Implementado |
| Verificación de correo | Implementada; reenvío pendiente |
| Recuperación de contraseña | Backend implementado; frontend pendiente |
| Perfil, raza predeterminada, apodo y avatar | Implementado |
| Cambio de contraseña y borrado lógico | Implementado |
| Listas remotas y control de propietario | Implementado; faltan pruebas de integración |
| Control de conflictos por revisión | Implementado en actualización; UX básica |
| Administración de usuarios, SMTP y logs | Implementada con autorización insegura por correo fijo |
| Rate limiting y auditoría sensible | No implementado |
| Validación semántica de listas en servidor | No implementada |
| Pruebas API/BD y E2E | No implementadas |
| Trabajo offline y sincronización posterior | No implementado |

## Plan original de desarrollo (histórico)

Las fases siguientes explican la intención original. La tabla anterior, no esta
lista, representa el estado vigente.

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

Son criterios objetivo. La auditoría del 3 de agosto confirma el aislamiento por
propietario en el código, pero no mediante pruebas de integración; recuperación,
rate limiting y autorización administrativa todavía no los cumplen.

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
3. Confirmado: el guardado de producto es remoto; JSON y seed son formatos
   portables y no constituyen una biblioteca local de listas.
4. Confirmado: el correo debe verificarse antes de poder guardar o cargar
   listas.
5. Confirmado: la aplicación sólo es accesible para usuarios autenticados; las
   únicas pantallas públicas son registro, acceso y recuperación de contraseña.
6. Confirmado: las listas se borran físicamente; las cuentas se borran de forma
   lógica, conservando los datos y bloqueando el acceso.
