# Constructor de listas de ejército · StarCraft: The Miniatures Game

Aplicación web para construir, validar, guardar e imprimir listas de ejército.
Funciona en escritorio y móvil desde una URL, e instalable como PWA para usarla
sin conexión.

## Puesta en marcha

```bash
npm install 
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

## Desarrollo con cuentas de usuario

El registro necesita la API y MariaDB de XAMPP. Copia `.env.example` a `.env`,
define un `SESSION_SECRET` largo e inicia el servicio **MySQL** desde el panel
de XAMPP. Después crea una base de datos y un usuario de aplicación (o usa los
ya configurados en tu `.env`) y aplica el esquema:

```bash
npm run db:migrate
npm run dev:server
```

La interfaz sigue arrancando con `npm run dev`. En desarrollo, los enlaces de
verificación de correo se muestran también en la pantalla tras registrarse.
Para producción se debe configurar un proveedor SMTP y una base de datos
MariaDB accesible por el backend desplegado.

La compilación deja en `dist/` un sitio **estático**: no hay servidor ni base de
datos. Se sube tal cual a cualquier hosting.

## Despliegue en hosting propio

1. `npm run build`
2. Sube el contenido de `dist/` a la raíz pública de tu hosting.
3. Configura el servidor para que **todas las rutas devuelvan `index.html`**
   (es una aplicación de una sola página).

Con Apache, un `.htaccess` en la raíz:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

Con Nginx:

```nginx
location / { try_files $uri $uri/ /index.html; }
```

**HTTPS es obligatorio** para que funcionen la PWA y el modo sin conexión: los
service workers no se registran sobre HTTP salvo en `localhost`.

## Estructura

```
src/
  engine/     motor de reglas: TypeScript puro, sin React ni navegador
    seed/     códec de seed para compartir listas por código
  catalog/    esquemas Zod y datos JSON del catálogo
  store/      estado de la lista y persistencia en IndexedDB
  ui/         interfaz React
docs/         PRD, SDD, modelo de datos y análisis
tests/        pruebas del motor y de integridad del catálogo
```

El motor de reglas no importa nada de la interfaz. Es lo único que decide si
una lista es legal y es lo que está cubierto por pruebas: si esa separación se
rompe, la corrección del producto deja de ser verificable.

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

La prueba más importante es `tests/engine/regression-manual.test.ts`: reproduce
la lista de ejemplo del reglamento §9.1 y comprueba las cifras **publicadas por
el fabricante** — 1670 minerales, 185 de gas, 8/8 Núcleo, 2/2 Élite, 2/3 Apoyo,
1/1 Héroe, 0/1 Aéreo. Es el único punto donde una fuente externa confirma a la
vez que los datos y las reglas son correctos.
