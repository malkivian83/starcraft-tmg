# Constructor de listas de ejército · StarCraft: The Miniatures Game

Aplicación web para construir, validar, guardar e imprimir listas de ejército.
Funciona en escritorio y móvil, permite instalar la interfaz como PWA y guarda
las listas en una cuenta centralizada mediante una API propia y MariaDB.
Las listas pueden mantenerse privadas o publicarse para consulta y clonación;
el directorio público incluye filtros, ordenación por likes y valoración por
usuario. El registro exige aceptar los términos de uso de
`starcraft-builder.com`.

La interfaz está disponible en español e inglés. El selector cambia también la
ruta (`/es/...` o `/en/...`) y, cuando hay una cuenta, guarda la preferencia en
el perfil. El español es el idioma base; las rutas antiguas sin prefijo se
redirigen automáticamente. Los nombres de unidades, cartas, armas y
habilidades se conservan en inglés, mientras que los textos explicativos se
localizan.

> **Estado actual:** las funciones de cuenta y listas remotas requieren conexión
> con la API. El modo invitado descrito a continuación está implementado y
> verificado con pruebas de permisos, renderizado y navegación local. La
> instalación PWA no implica funcionamiento íntegro sin conexión. Consulta
> [`docs/08-AUDITORIA-2026-08-03.md`](docs/08-AUDITORIA-2026-08-03.md) para ver
> los riesgos y mejoras pendientes antes de un despliegue multiusuario.

## Modo invitado

Las entradas públicas del constructor son `/es/crear-lista` y
`/en/create-list` (`/crear-lista` se conserva como alias). Sin iniciar sesión, un
invitado podrá crear y validar una lista, importar o exportar JSON, copiar o
importar un seed e imprimir o guardar como PDF. También podrá imprimir una lista
inválida, pero la salida conservará un aviso visible de que no es válida.

El invitado no podrá guardar en la cuenta, abrir «Mis listas» ni acceder al
perfil. Su borrador se guarda únicamente en el almacenamiento local de ese
dispositivo; no se envía a la API ni se sincroniza entre dispositivos. JSON y
seed son salidas portables iniciadas expresamente por el usuario.

Si el invitado inicia el flujo de acceso o registro sin recargar la aplicación,
el borrador se conservará en memoria y seguirá disponible localmente. Tras
completar la autenticación y la verificación exigida, podrá guardarlo como una
lista remota. Este traspaso no
abre ningún endpoint público: toda operación de guardado, biblioteca o perfil
seguirá protegida por la sesión en la API.

## Instalar la PWA

La interfaz se puede instalar desde un navegador compatible sin pasar por una
tienda. En Android/Chrome aparece el botón «Instalar» dentro de la aplicación;
en iPhone abre la página en Safari y usa **Compartir → Añadir a pantalla de
inicio**. La instalación incluye el shell de la interfaz y algunas imágenes en
caché, pero las cuentas y las listas guardadas siguen necesitando conexión con
la API y MariaDB online.

## Google Analytics

La aplicación integra Google Analytics 4 con `VITE_GOOGLE_ANALYTICS_ID` (por
defecto, `G-F7DMMN328B`). En producción aparece un aviso de cookies: las cookies
técnicas de sesión siguen disponibles y las cookies de analítica no se cargan
hasta que el visitante las acepta. La navegación SPA se registra mediante la
medición mejorada de cambios del historial de GA4; mantén esa opción activada
en el flujo de datos. En la primera ubicación enviada se omiten las query
strings para no transmitir tokens, seeds ni parámetros de sesión.

## Puesta en marcha

```bash
npm install
```

1. Copia `.env.example` a `.env` y ajusta la conexión a MariaDB y los orígenes.
2. Inicia MariaDB y aplica las migraciones:

   ```bash
   npm run db:migrate
   ```

3. Arranca API e interfaz en terminales distintas:

   ```bash
   npm run dev:server
   npm run dev
   ```

4. Ejecuta las comprobaciones:

   ```bash
   npm run typecheck
   npm test
   npm run build
   npm run build:server
   ```

## Desarrollo con cuentas de usuario

El registro necesita la API y MariaDB. En desarrollo puede usarse MariaDB de
XAMPP. Define un `SESSION_SECRET` largo, crea la base de datos y un usuario de
aplicación, y aplica el esquema antes de iniciar el servidor.

```bash
npm run db:migrate
npm run dev:server
```

En desarrollo, los enlaces de verificación se muestran también en la pantalla
tras registrarse cuando no hay SMTP configurado. En producción deben existir
SMTP, HTTPS, MariaDB y el backend desplegado.

La compilación del frontend queda en `dist/` y la del backend en
`server/dist/`. El frontend contendrá el catálogo, el motor y el constructor
público; autenticación, perfil y listas guardadas seguirán dependiendo de la
API. El servidor web debe resolver las rutas localizadas (`/es/*`, `/en/*`) y
el alias `/crear-lista` con el `index.html` de la SPA.

## Despliegue

El despliegue vigente compila frontend y backend, aplica migraciones y arranca
`app.js` como aplicación Node. La configuración concreta de Plesk está en
[`PLESK_DEPLOYMENT.md`](PLESK_DEPLOYMENT.md).

HTTPS es obligatorio en producción para proteger cookies y credenciales y para
registrar el service worker de la PWA. Antes de publicar debe cerrarse al menos
el hallazgo crítico de superadministración recogido en la auditoría.

## Estructura

```
src/
  engine/     motor de reglas: TypeScript puro, sin React ni navegador
    seed/     códec de seed para compartir listas por código
  catalog/    esquemas Zod y datos JSON del catálogo
  auth/       clientes de autenticación y listas remotas
  store/      sesión y estado de la lista en edición
  ui/         interfaz React, cuenta, listas e impresión
  i18n/       catálogos, selector y rutas localizadas
server/
  src/        API Express, autenticación, administración y migraciones
docs/         PRD, SDD, modelo de datos y análisis
tests/        pruebas del motor y de integridad del catálogo
```

El motor de reglas no importa nada de la interfaz. Es lo único que decide si
una lista es legal y es lo que está cubierto por pruebas: si esa separación se
rompe, la corrección del producto deja de ser verificable.

Las listas guardadas se persisten en MariaDB. El borrador de invitado se guarda
localmente en el dispositivo mientras no se elimine el almacenamiento del
navegador; no es el almacén principal de la cuenta ni un dato compartido entre
dispositivos. JSON y seed siguen siendo formatos portables de importación y
exportación.

## Estado del contenido

| Raza | Estado |
|---|---|
| Zerg | 12 unidades, 2 facciones, 9 tácticas y 2 Creep Cards; fases revisadas |
| Terran | 7 unidades, 2 facciones y 10 tácticas; fases revisadas |
| Protoss | 7 unidades, 2 facciones y 10 tácticas; fases revisadas |

Escenarios: 5 misiones × 2 escalas y 10 despliegues, comunes a las tres razas.

**Los costes provienen del reglamento §12.10 y §12.11**, no de las hojas de
cartas, que no los incluyen. Están pendientes de una segunda verificación
humana; ver `docs/00-PLAN-DE-TRABAJO.md`.

La aplicación y la hoja PDF de lista muestran la fase de uso de habilidades y
mejoras (Movimiento, Asalto, Combate o Cualquier fase). Las imágenes completas
de carta siguen siendo opcionales: la interfaz las oculta si no existen.

## Verificación

Actualmente hay **181 pruebas**. La más importante es
`tests/engine/regression-manual.test.ts`: reproduce
la lista de ejemplo del reglamento §9.1 y comprueba las cifras **publicadas por
el fabricante** — 1670 minerales, 185 de gas, 8/8 Núcleo, 2/2 Élite, 2/3 Apoyo,
1/1 Héroe, 0/1 Aéreo. Es el único punto donde una fuente externa confirma a la
vez que los datos y las reglas son correctos.

La cobertura actual no incluye todavía pruebas E2E ni integración completa de
las rutas de autenticación, autorización y listas. Esa ausencia está registrada
en la auditoría y en `docs/07-PENDIENTE.md`.
