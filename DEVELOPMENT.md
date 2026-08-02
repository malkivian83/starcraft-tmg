# Guía de desarrollo

Esta guía describe cómo contribuir al constructor de listas de ejército de
_StarCraft: The Miniatures Game_. El objetivo es mantener las reglas del juego,
el catálogo y la interfaz claramente separados y verificables.

## Requisitos

- Node.js 20 o posterior (se recomienda una versión LTS).
- npm, incluido con Node.js.

## Puesta en marcha

```bash
npm install
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
src/store/    Estado de la lista y persistencia local.
src/ui/       Componentes React, estilos e impresión.
tests/        Pruebas de reglas e integridad del catálogo.
docs/         Especificaciones y material de referencia.
```

- `src/engine` no debe importar React, el navegador ni componentes de UI.
- El catálogo es la única fuente de verdad sobre unidades, costes y contenido.
  No dupliques esos datos dentro del motor o de la interfaz.
- Los valores derivados —costes, espacios usados y legalidad— se calculan; no
  se persisten en las listas.
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
