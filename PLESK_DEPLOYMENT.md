# Despliegue automático desde GitHub a Plesk

Este proyecto no debe publicarse sirviendo directamente el contenido del
repositorio. Vite genera la aplicación web de producción en `dist/` y
TypeScript genera el servidor en `server/dist/`.

## Estructura recomendada

- Ruta de despliegue Git: `httpdocs`
- Application root de Node.js: `httpdocs`
- Document root de Node.js: `httpdocs/dist`
- Archivo de inicio: `app.js`
- Modo de aplicación: `production`
- Versión de Node.js: 22 mientras `package.json` y el orquestador mantengan la
  ruta `/opt/plesk/node/22/bin/node`

## Configuración inicial

En `httpdocs/.env`, crear la configuración de producción. El archivo no se
guarda en Git y debe permanecer únicamente en el servidor.

```env
VITE_API_BASE_URL=https://starcraft-builder.com/api
VITE_GOOGLE_CLIENT_ID=IDENTIFICADOR.apps.googleusercontent.com
GOOGLE_CLIENT_ID=IDENTIFICADOR.apps.googleusercontent.com
APP_ORIGIN=https://starcraft-builder.com
APP_BASE_URL=https://starcraft-builder.com
DATABASE_URL=mysql://USUARIO:CONTRASENA_CODIFICADA@localhost:3306/BASE_DE_DATOS
SESSION_SECRET=SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
NODE_ENV=production
```

No fijar `PORT` en Plesk: el alojamiento Node.js debe proporcionar el puerto al
proceso de la aplicación.

Las dos variables de Google llevan el mismo valor: el identificador de cliente
es público por diseño y el secreto de OAuth no se usa. `VITE_GOOGLE_CLIENT_ID`
se incrusta en el bundle durante `vite build`, así que debe estar en `.env`
**antes** de desplegar; cambiarla después obliga a reconstruir. Si falta, el
botón de Google no aparece y el resto de la aplicación funciona igual.

En Google Cloud Console, el dominio de producción debe figurar en «Orígenes de
JavaScript autorizados» (`https://starcraft-builder.com`, sin barra final) y la
pantalla de consentimiento debe estar publicada: en modo de prueba sólo entran
las cuentas añadidas como usuarios de prueba.

Desde la pantalla Node.js de Plesk, ejecuta `deploy:plesk` y habilita la
aplicación. No es necesario pulsar antes `NPM Install`, porque el propio script
realiza `npm ci`.

## Repositorio Git de Plesk

Añadir el repositorio remoto:

`https://github.com/malkivian83/starcraft-tmg.git`

Usar la rama `main`, la ruta de despliegue `httpdocs` y el modo de
despliegue automático.

En "Acciones adicionales de despliegue", configurar una orden por línea:

```sh
cd httpdocs
npm run deploy:plesk
touch tmp/restart.txt
```

No añadas otro `npm ci`: `deploy:plesk` ya ejecuta una instalación limpia con
las dependencias de desarrollo y opcionales necesarias para compilar.

Si Plesk indica que `npm` no existe, usa la ruta de la versión configurada:
`/opt/plesk/node/22/bin/npm run deploy:plesk`.

## Webhook de GitHub

Plesk muestra una URL de webhook en la configuración del repositorio. Añadirla
en GitHub, en `Settings > Webhooks`, con tipo de contenido `application/json` y
el evento `push`.

Después de esta configuración, cada `push` a `main` hará que Plesk descargue el
cambio, instale exactamente las dependencias del lockfile, compile frontend y
backend, aplique migraciones pendientes y reinicie la aplicación.

## Dominio canónico y PWA

El origen de una PWA forma parte de su instalación. Debe elegirse un único
dominio canónico (`starcraft-builder.com` o `www.starcraft-builder.com`) antes
de distribuirla y mantenerse estable en `APP_ORIGIN`, `APP_BASE_URL`, Google y
la configuración de Nginx/Plesk.

No se debe redirigir `/sw.js` de un origen que ya tuvo instalaciones al otro
origen. El navegador exige que la actualización del service worker proceda del
mismo origen; una redirección deja esas instalaciones usando su caché anterior.
Para cambiar de dominio, el virtual host antiguo debe servir temporalmente en
`/sw.js` un worker de migración que vacíe sus cachés y se desregistre, y
redirigir después la navegación al dominio nuevo. Mantener esa excepción al
menos mientras existan instalaciones de la PWA antigua.

El script `deploy:plesk` arranca el orquestador con la instalación seleccionada
de Plesk (`/opt/plesk/node/22/bin/node`). El orquestador reutiliza ese mismo
ejecutable para cada herramienta. Esto evita depender de `node` o `npm` en el
`PATH` interno de Nodeenv y de los permisos de `node_modules/.bin`.

Antes de compilar, el orquestador ejecuta una instalación limpia mediante
`npm ci --include=dev --include=optional`. Las dependencias de desarrollo son
necesarias para TypeScript y Vite; las opcionales incluyen el binario nativo de
Rollup correspondiente a Linux.

El orquestador añade `/opt/plesk/node/22/bin` al `PATH` de la instalación y la
compilación para que los scripts nativos, como el de `argon2`, puedan invocar
`node` dentro del entorno aislado de Plesk.

## Comprobaciones y limitaciones conocidas

Antes del primer despliegue y de cada cambio de esquema:

1. Realiza una copia de seguridad de MariaDB.
2. Comprueba que `.env` contiene `NODE_ENV=production`, un `SESSION_SECRET`
   robusto y orígenes HTTPS exactos.
3. Ejecuta el despliegue en un entorno de prueba y verifica `/api/health`.
4. Conserva una versión anterior de `dist/`, `server/dist/` y la base de datos
   para poder volver atrás.

El ejecutor de migraciones actual no comprueba todavía el resultado de
`GET_LOCK` y las operaciones DDL de MySQL pueden quedar aplicadas parcialmente
aunque exista una transacción. Hasta corregirlo, una migración interrumpida debe
revisarse manualmente antes de reintentar el despliegue.

Existe además un bloqueo de bootstrap en una base vacía: producción exige SMTP
para verificar al primer usuario, pero SMTP se configura desde un panel
administrativo al que esa cuenta no puede llegar sin verificarse. El registro
crea la cuenta antes de fallar el envío y no hay reenvío. Antes del lanzamiento
debe existir un mecanismo seguro de provisión inicial —administrador creado
fuera del registro público y SMTP por entorno/migración, o un flujo equivalente
con recuperación idempotente—. No debe resolverse cambiando temporalmente el
servidor a modo desarrollo.

Conserva `SESSION_SECRET`: rotarlo revoca todas las sesiones y también impide
descifrar la contraseña SMTP existente, porque ambas funciones comparten el
secreto. Tras una rotación debe guardarse de nuevo la configuración SMTP.

Las rutas de la SPA (`/verify-email`, `/reset-password` y cualquier futura ruta
del cliente) necesitan fallback a `dist/index.html`, excluyendo `/api` y los
ficheros reales. Esa regla no se genera hoy en `dist/`; debe configurarse en
Apache/Plesk antes de probar enlaces abiertos directamente desde un correo.

La publicación multiusuario debe esperar al cierre de los hallazgos P0 y P1 de
[`docs/08-AUDITORIA-2026-08-03.md`](docs/08-AUDITORIA-2026-08-03.md), en
especial el modelo de permisos de superadministración.
