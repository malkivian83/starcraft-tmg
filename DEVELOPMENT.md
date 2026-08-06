# Guía de desarrollo

Esta guía describe cómo contribuir al constructor de listas de ejército de
_StarCraft: The Miniatures Game_. El objetivo es mantener las reglas del juego,
el catálogo y la interfaz claramente separados y verificables.

## Requisitos

- Node.js 20 o posterior para desarrollo; Node.js 22 para reproducir el
  despliegue, actualmente acoplado a `/opt/plesk/node/22`.
- npm, incluido con Node.js.
- MariaDB para los flujos de cuenta, listas y administración.

## Puesta en marcha

```bash
npm install  
```

Copia `.env.example` a `.env`, crea la base de datos y arranca, en terminales
separadas:

```bash
npm run db:migrate
npm run dev:server
npm run dev
```

Vite mostrará la URL local de desarrollo. Para probar una compilación de
producción:

```bash
npm run build
npm run preview
```

## Comprobaciones antes de entregar cambios

Ejecuta estas comprobaciones antes de abrir un pull request o integrar cambios:

```bash
npm run typecheck
npm test
npm run build
```

Para validar únicamente la coherencia del catálogo:

```bash
npm run verify:catalog
```

Mientras se desarrolla, puede usarse `npm run test:watch` para ejecutar las
pruebas al guardar cambios.

## Arquitectura y límites

```text
src/engine/   Reglas, validación y cálculos; TypeScript puro.
src/catalog/  Esquemas Zod y datos JSON del contenido del juego.
src/store/    Estado de sesión y de la lista en edición.
src/auth/     Clientes HTTP de autenticación y listas remotas.
src/ui/       Componentes React, cuenta, listas, estilos e impresión.
server/src/   API Express, repositorios MariaDB, correo y migraciones.
tests/        Pruebas de reglas e integridad del catálogo.
docs/         Especificaciones y material de referencia.
```

- `src/engine` no debe importar React, el navegador ni componentes de UI.
- El catálogo es la única fuente de verdad sobre unidades, costes y contenido.
  No dupliques esos datos dentro del motor o de la interfaz.
- Los valores derivados —costes, espacios usados y legalidad— se calculan; no
  se persisten en las listas.
- El cliente nunca decide la identidad del propietario de una lista; la API la
  deriva de la sesión y filtra todas las consultas por `owner_id`.
- Mantén los identificadores y `seedId` existentes: son referencias estables
  para listas guardadas y códigos compartibles.

## Cambios de catálogo y reglas

Al modificar archivos de `src/catalog/data/`:

1. Conserva los IDs y `seedId` ya publicados; no los reasignes ni reutilices.
2. Valida el catálogo con `npm run verify:catalog`.
3. Añade o ajusta una prueba que cubra la regla o los datos cambiados.
4. Incrementa la versión de contenido cuando el cambio altere contenido de
   juego, como costes o disponibilidad.
5. Documenta la fuente de la regla cuando proceda. Los PDFs de referencia están
   en `docs/`.

La prueba `tests/engine/regression-manual.test.ts` reproduce el ejemplo del
reglamento; cualquier cambio que la afecte debe revisarse con especial cuidado.

## Estilo de código

- Usa TypeScript estricto y nombres claros; evita abreviaturas crípticas.
- Prefiere funciones pequeñas, deterministas y fáciles de probar.
- Evita `any`; modela los datos con tipos y esquemas existentes.
- No introduzcas lógica de reglas en componentes React: delega en el motor.
- Añade comentarios para explicar decisiones o reglas no obvias, no para
  repetir lo que ya expresa el código.

## Pruebas

- Todo cambio de comportamiento debe incluir una prueba de regresión.
- Las reglas puras se prueban en `tests/engine/`.
- Las garantías estructurales de datos se prueban en `tests/catalog/`.
- Prueba explícitamente los límites: máximos, mínimos, incompatibilidades y
  combinaciones legales e ilegales.

El inventario del 4 de agosto de 2026 contiene 140 pruebas, todas correctas.
Incluye pruebas de capacidades y renderizado estático del modo invitado y una
regresión HTTP para las rutas anónimas de listas, pero todavía no cubre flujos
E2E completos ni integración de registro, verificación, recuperación,
autorización por propietario y administración. Cualquier cambio en esas áreas
debe añadir esa cobertura antes de considerarse listo para producción.
El inventario del 3 de agosto de 2026 contiene 141 pruebas, todas correctas,
pero todavía no cubre componentes ni flujos E2E. Tampoco hay integración
completa para registro, verificación, recuperación, autorización por
propietario y administración. Cualquier cambio en esas áreas debe añadir esa
cobertura antes de considerarse listo para producción.

## Seguridad y operaciones

- Los privilegios administrativos deben proceder de roles persistidos, no de
  comparar una dirección de correo en código.
- Los flujos sensibles deben exigir cuenta verificada y, cuando corresponda,
  reautenticación.
- Registro, acceso y recuperación necesitan límites de intentos y protección
  frente a abuso de correo.
- Las migraciones deben comprobar la adquisición del bloqueo y ser seguras al
  reintentarse tras un fallo parcial.
- Consulta [`docs/08-AUDITORIA-2026-08-03.md`](docs/08-AUDITORIA-2026-08-03.md)
  antes de trabajar en autenticación, administración o despliegue.

## Commits y pull requests

Usa mensajes de commit breves y descriptivos, preferiblemente Conventional
Commits:

```text
feat: añadir filtro de unidades Terran
fix: corregir límite de espacios de apoyo
docs: documentar el formato de seed
test: cubrir una combinación de facción inválida
```

Cada pull request debe explicar qué cambia, por qué, cómo se ha probado y, si
afecta a la interfaz, incluir capturas o una breve descripción visual. Mantén
los cambios enfocados: no mezcles refactorizaciones amplias con cambios de
reglas o contenido salvo que sean inseparables.

## Seguridad y archivos generados

- No subas secretos, tokens ni configuraciones locales.
- No edites ni incluyas `node_modules/`, `dist/`, `.vite/` o
  `tsconfig.tsbuildinfo` en los cambios.
- Verifica que los recursos de `public/` tengan licencia o procedan de las
  fuentes de referencia autorizadas del proyecto.
