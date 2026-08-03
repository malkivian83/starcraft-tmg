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
- Versión de Node.js: 20 o posterior

## Configuración inicial

En `httpdocs/.env`, crear la configuración de producción. El archivo no se
guarda en Git y debe permanecer únicamente en el servidor.

```env
VITE_API_BASE_URL=https://starcraft-builder.com/api
APP_ORIGIN=https://starcraft-builder.com
APP_BASE_URL=https://starcraft-builder.com
DATABASE_URL=mysql://USUARIO:CONTRASENA_CODIFICADA@localhost:3306/BASE_DE_DATOS
SESSION_SECRET=SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
NODE_ENV=production
```

No fijar `PORT` en Plesk: el alojamiento Node.js debe proporcionar el puerto al
proceso de la aplicación.

Desde la pantalla Node.js de Plesk, ejecutar una vez `NPM Install`. Después,
ejecutar el script `deploy:plesk` y habilitar la aplicación.

## Repositorio Git de Plesk

Añadir el repositorio remoto:

`https://github.com/malkivian83/starcraft-tmg.git`

Usar la rama `main`, la ruta de despliegue `httpdocs` y el modo de
despliegue automático.

En "Acciones adicionales de despliegue", configurar una orden por línea:

```sh
cd httpdocs
npm ci
npm run deploy:plesk
touch tmp/restart.txt
```

Si Plesk indica que `npm` no existe, hay que sustituirlo por la ruta de npm de
la versión de Node seleccionada en Plesk, por ejemplo
`/opt/plesk/node/20/bin/npm`.

## Webhook de GitHub

Plesk muestra una URL de webhook en la configuración del repositorio. Añadirla
en GitHub, en `Settings > Webhooks`, con tipo de contenido `application/json` y
el evento `push`.

Después de esta configuración, cada `push` a `main` hará que Plesk descargue el
cambio, instale exactamente las dependencias del lockfile, compile frontend y
backend, aplique migraciones pendientes y reinicie la aplicación.

El script `deploy:plesk` arranca el orquestador con la instalación seleccionada
de Plesk (`/opt/plesk/node/22/bin/node`). El orquestador reutiliza ese mismo
ejecutable para cada herramienta. Esto evita depender de `node` o `npm` en el
`PATH` interno de Nodeenv y de los permisos de `node_modules/.bin`.

Antes de compilar, el orquestador ejecuta una instalación limpia mediante
`npm ci --include=dev --include=optional`. Las dependencias de desarrollo son
necesarias para TypeScript y Vite; las opcionales incluyen el binario nativo de
Rollup correspondiente a Linux.
