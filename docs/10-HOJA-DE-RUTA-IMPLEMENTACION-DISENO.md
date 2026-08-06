# Hoja de ruta — implementación del diseño HTML

Versión 1 · 6 de agosto de 2026 · Depende de
[`09-DIRECTRICES-DE-DISENO.md`](09-DIRECTRICES-DE-DISENO.md).

## 1. Resultado esperado

La aplicación conservará exactamente su alcance funcional y adoptará el sistema
visual de `design`: fondos y superficies Nocturne adaptados al producto,
tipografía Inter/Chakra Petch, acento por raza, controles de contorno, paneles
compactos, biblioteca, acceso espacial y constructor de cuatro pasos.

La migración se ejecutará por capas. Cada fase debe compilar y conservar los
flujos existentes antes de comenzar la siguiente.

## 2. Estado inicial

- [x] Inventario de los cuatro HTML y sus recursos.
- [x] Inventario de vistas y comportamientos existentes.
- [x] Matriz de correspondencia diseño → componentes React.
- [x] Directrices y contrato de conservación funcional.
- [x] Implementación visual.

La ejecución se cerró el 6 de agosto de 2026 con las 16 suites y sus 154
pruebas en verde, además de las compilaciones de cliente/PWA y servidor. La
carpeta `design` se mantiene intacta como referencia y los cambios realizados
se limitan a estructura presentacional, estilos, tipografías y activos visuales.

## 3. Matriz de cobertura

| Diseño | Implementación principal | Cobertura adicional obligatoria |
|---|---|---|
| Inicio de sesión | `AuthGate.tsx` | Registro, recuperación, verificación, carga, errores y términos |
| Biblioteca | `SavedListsPage`, `PublicListsPage`, `ListTable` | Inicio, vacío/carga/error y detalle público |
| Creador | `App`, `ResourceBar`, cuatro `Step*`, `PrintSheet` | Cuenta, visibilidad, seed, modales, toast y estados especiales |
| Soporte | `SupportPage` y ruta independiente | Anónimo, pending, éxito y error |
| Sin maqueta | Home, perfil, superadmin, legal y modales | Herencia conservadora del sistema visual |

## 4. Fases de implementación

### Fase 0 — Baseline y guardarraíles

Objetivo: fijar qué no puede cambiar.

- Registrar el estado del árbol de trabajo y no tocar cambios ajenos.
- Ejecutar pruebas, typecheck y build antes de la migración.
- Preparar una lista manual de recorridos críticos: invitado, cuenta, constructor,
  listas, detalle público, perfil, soporte y administración.
- Identificar selectores y componentes que afectan a impresión.

Salida:

- Baseline verde o incidencias previas documentadas.
- Lista funcional de regresión cerrada.

### Fase 1 — Fundamentos y activos

Objetivo: crear el lenguaje visual sin cambiar layout de páginas.

- Introducir tokens de fondo, superficies, texto, línea, radios, espaciado,
  sombras, estados y rampas de Zerg/Terran/Protoss.
- Configurar Inter y Chakra Petch con fallbacks.
- Copiar logo, favicons y fondo espacial a `public` con nombres estables.
- Adaptar estilos base de body, enlaces, botones, campos, foco, paneles, chips,
  mensajes y modales.
- Mantener aislados `print.css` y la hoja clara.

Puerta de salida:

- La aplicación compila.
- Ningún control desaparece.
- Las tres razas cambian solo su acento.
- Foco, disabled, error y éxito siguen siendo distinguibles.

### Fase 2 — Shell, acceso y navegación

Objetivo: reproducir los marcos compartidos del diseño.

- Cabecera autenticada: logo, producto, navegación, perfil y salida.
- Cabecera invitada, aviso de persistencia y modo invitado.
- Footer legal común y variante de soporte independiente.
- Login espacial con dos paneles; adaptar registro y estados auxiliares al mismo
  shell sin modificar sus formularios.
- Conservar botón oficial de Google y todas las validaciones reales.
- Mantener menú móvil y acceso visible a cerrar sesión.

Puerta de salida:

- Acceso, registro, recuperación, verificación y constructor invitado funcionan.
- Navegación por teclado y móvil conserva todos los destinos.
- No hay datos ficticios del prototipo.

### Fase 3 — Constructor y sus cuatro pasos

Objetivo: trasladar la superficie de mayor riesgo de forma incremental.

1. Toolbar, visibilidad, acciones, recursos y pestañas.
2. Cartas de mando: facción, Creep, tácticas, copias, preview y cartas activas.
3. Reclutamiento: catálogo, composición, perfil, armas, habilidades, mejoras,
   `SPECIALIST`, orden, borrado y unidades de referencia.
4. Misiones y despliegues con filtros de escala y mapas actuales.
5. Revisión: libro mayor, mensajes, impresión y previsualización.
6. Seed, modal de carta, toast, vacíos, bloqueos y remedios no dibujados.

Puerta de salida:

- Los tests de invitado, orden y store siguen verdes.
- La lista conserva datos al cambiar de paso y al reordenar.
- Guardar, seed, importar, exportar e imprimir conservan sus capacidades por modo.
- La barra de recursos no tapa contenido en móvil.

### Fase 4 — Biblioteca, inicio y detalle público

Objetivo: aplicar la maqueta de biblioteca a todas las superficies de listas.

- Mis listas y listas públicas: encabezado, filtros, contador, tabla, estados y
  acciones.
- Conservar ordenaciones actuales; no añadir “Coste”.
- Inicio: extender paneles y tarjetas sin alterar su jerarquía o contenido.
- Detalle público: shell coherente, hoja, volver, like, clonar e imprimir.
- Validar acciones con nombres largos, cero resultados, carga y error.

Puerta de salida:

- Abrir, publicar/privatizar, borrar, ver, clonar y likes funcionan.
- Filtros y ordenaciones producen el mismo resultado que antes.
- Solo el contenedor de datos puede desplazarse horizontalmente.

### Fase 5 — Soporte, cuenta, legal y administración

Objetivo: completar las pantallas de menor correspondencia directa.

- Soporte autenticado y anónimo siguiendo la maqueta, con límite real de 10 000.
- Perfil, avatar, raza, credenciales, Google y zona peligrosa.
- Términos dentro de una superficie legible del mismo sistema.
- Superadministración: pestañas, usuarios, SMTP, correo y tickets sin reorganizar
  ni ocultar acciones.
- Estados de carga, vacío, pendiente, éxito y error coherentes.

Puerta de salida:

- Formularios conservan labels, constraints, mensajes y submit real.
- Operaciones sensibles y administrativas mantienen las mismas condiciones.

### Fase 6 — Responsive, accesibilidad e impresión

Objetivo: cerrar los huecos que los HTML no especifican.

- Validar 1440×900, 1024×768, 768 px, 390 px y 360 px.
- Revisar envoltura de cabecera, menú móvil, toolbar, pestañas, tablas, perfiles,
  tarjetas, modales y footer.
- Verificar foco visible, orden de tabulación, nombres accesibles, contraste y
  `prefers-reduced-motion` sin añadir nuevos flujos.
- Validar preview y salida A4, incluyendo listas inválidas y perfiles largos.

Puerta de salida:

- Sin solapes ni scroll horizontal de página.
- Todos los controles actuales siguen visibles y alcanzables.
- La impresión no contiene chrome, fondos oscuros ni elementos `no-print`.

### Fase 7 — Regresión y entrega

Objetivo: demostrar equivalencia funcional y coherencia visual.

- Ejecutar `npm test`, `npm run typecheck`, `npm run build` y
  `npm run build:server` cuando proceda.
- Repetir la lista manual de recorridos críticos.
- Revisar diff para detectar lógica, textos, datos o dependencias no autorizados.
- Documentar cualquier desviación preexistente sin ampliar el alcance.

Salida final:

- Diseño aplicado a toda la aplicación.
- Suite y builds verdes, o incidencias preexistentes diferenciadas.
- Cero funciones añadidas y cero funciones eliminadas.

## 5. Matriz de aceptación funcional

| Área | Comprobaciones mínimas |
|---|---|
| Invitado | `/crear-lista`, cuatro pasos, seed, JSON, imprimir, reclamar borrador, sin guardado remoto |
| Cuenta | acceso/registro/Google/verificación/recuperación, restaurar borrador y salir |
| Edición | confirmaciones, raza, escala, recursos, cartas, copias, unidades, mejoras, escenarios y validación |
| Persistencia | guardar/cargar, revisión remota, visibilidad, borrar y conflicto informado |
| Comunidad | buscar, filtrar, ordenar, ver, clonar, like y retirar like |
| Cuenta/admin | perfil, avatar, preferencia, contraseña, Google, baja, usuarios, SMTP, logs y tickets |
| Soporte/legal | envío anónimo/autenticado, términos, pending, éxito y error |
| Impresión | preview desde cualquier paso, lista inválida marcada, orden y perfiles conservados |

## 6. Matriz de aceptación visual

- Shell autenticado, invitado y anónimo coherentes con sus HTML de referencia.
- Inter para cuerpo y Chakra Petch para jerarquía técnica.
- Fondos, superficies, líneas, radios y densidad según las directrices.
- Zerg magenta, Terran azul y Protoss amarillo sin cambiar colores semánticos.
- Botones primarios de contorno/tinte y secundarios oscuros.
- Paneles sin sombras pesadas; acceso y modales son las excepciones.
- Estados hover, pressed, focus, selected, disabled, blocked, pending, error,
  warning, success, loading y empty reconocibles.
- Constructor revisado en las cuatro pestañas, tres razas y dos modos de acceso.
- Biblioteca revisada con datos, filtros activos, vacío, carga y error.
- Acceso revisado en login, registro, recuperación y verificación.
- Soporte revisado anónimo/autenticado, validación y feedback.
- Hoja A4 legible en pantalla, impresión y escala de grises.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Copiar lógica ficticia del prototipo | Traducir solo presentación; comportamiento React actual primero |
| CSS global del export pisa la app | No importarlo; crear tokens y estilos propios |
| Pantallas no diseñadas quedan incoherentes | Herencia conservadora de componentes y tokens compartidos |
| Regresión móvil | Mantener estrategia actual y validar cinco anchos |
| Regresión de impresión | Aislar `print.css` y comprobar A4 en cada fase relevante |
| Microtexto/contraste insuficiente | Suelo de 11 px y contraste verificado para texto normal |
| Dependencia de CDN o runtime de diseño | Bundle actual y fallbacks; cero scripts del prototipo |
| Cambio funcional accidental | Gates por fase, tests y revisión final del diff |

## 8. Regla para decisiones durante la implementación

Si una maqueta contradice una función real, se conserva la función y se adapta su
presentación al patrón visual más cercano. Si una pantalla no está dibujada, se
mantiene su estructura. Solo se solicitará una decisión adicional cuando no
exista un patrón visual equivalente y dos soluciones alteren de forma material
la experiencia; no se usará esa ausencia para añadir funciones.
