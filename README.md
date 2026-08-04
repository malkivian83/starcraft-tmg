# Constructor de listas de ejército · StarCraft: The Miniatures Game

Aplicación web para construir, validar, guardar e imprimir listas de ejército.
Funciona en escritorio y móvil, permite instalar la interfaz como PWA y guarda
las listas en una cuenta centralizada mediante una API propia y MariaDB.
Las listas pueden mantenerse privadas o publicarse para consulta y clonación;
el directorio público incluye filtros, ordenación por likes y valoración por
usuario. El registro exige aceptar los términos de uso de
`starcraft-builder.com`.

> **Estado actual:** las funciones de cuenta y listas remotas requieren conexión
> con la API. El modo invitado descrito a continuación está implementado y
> verificado con pruebas de permisos, renderizado y navegación local. La
> instalación PWA no implica funcionamiento íntegro sin conexión. Consulta
> [`docs/08-AUDITORIA-2026-08-03.md`](docs/08-AUDITORIA-2026-08-03.md) para ver
> los riesgos y mejoras pendientes antes de un despliegue multiusuario.

## Modo invitado

La entrada pública del constructor será `/crear-lista`. Sin iniciar sesión, un
invitado podrá crear y validar una lista, importar o exportar JSON, copiar o
importar un seed e imprimir o guardar como PDF. También podrá imprimir una lista
inválida, pero la salida conservará un aviso visible de que no es válida.

El invitado no podrá guardar en la cuenta, abrir «Mis listas» ni acceder al
perfil. Su borrador vivirá únicamente en la memoria de la pestaña: recargar la
página, cerrarla o abandonar el flujo lo descartará. JSON y seed son salidas
portables iniciadas expresamente por el usuario y no convierten el borrador en
persistencia automática.

Si el invitado inicia el flujo de acceso o registro sin recargar la aplicación,
el borrador se conservará en memoria. Tras completar la autenticación y la
verificación exigida, podrá guardarlo como una lista remota. Este traspaso no
abre ningún endpoint público: toda operación de guardado, biblioteca o perfil
seguirá protegida por la sesión en la API.

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
API. El servidor web debe resolver `/crear-lista` con el `index.html` de la SPA.

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
server/
  src/        API Express, autenticación, administración y migraciones
docs/         PRD, SDD, modelo de datos y análisis
tests/        pruebas del motor y de integridad del catálogo
```

El motor de reglas no importa nada de la interfaz. Es lo único que decide si
una lista es legal y es lo que está cubierto por pruebas: si esa separación se
rompe, la corrección del producto deja de ser verificable.

Las listas guardadas se persisten en MariaDB. El borrador de invitado sólo vive
en Zustand mientras la pestaña permanece cargada. JSON y seed siguen siendo
formatos portables de importación y exportación, no el almacén principal de la
cuenta ni un guardado automático del invitado.

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

Actualmente hay **141 pruebas**. La más importante es
`tests/engine/regression-manual.test.ts`: reproduce
la lista de ejemplo del reglamento §9.1 y comprueba las cifras **publicadas por
el fabricante** — 1670 minerales, 185 de gas, 8/8 Núcleo, 2/2 Élite, 2/3 Apoyo,
1/1 Héroe, 0/1 Aéreo. Es el único punto donde una fuente externa confirma a la
vez que los datos y las reglas son correctos.

La cobertura actual no incluye todavía pruebas E2E ni integración completa de
las rutas de autenticación, autorización y listas. Esa ausencia está registrada
en la auditoría y en `docs/07-PENDIENTE.md`.
