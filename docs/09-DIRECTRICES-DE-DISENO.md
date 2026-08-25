# Directrices de diseño — aplicación StarCraft TMG

Versión 1 · 6 de agosto de 2026 · Documento creado antes de modificar la interfaz de producción.

## 1. Objetivo

Trasladar a la aplicación React el lenguaje visual de la carpeta [`design`](../design/)
sin cambiar su alcance funcional. El trabajo es una sustitución de presentación:
no añade capacidades, no elimina controles, no altera reglas del juego y no cambia
los contratos con la API ni la persistencia.

## 2. Fuentes de verdad y precedencia

Cuando dos referencias difieran, se aplicará este orden:

1. **Comportamiento vigente, datos reales y pruebas de la aplicación.** Determinan
   qué controles, estados, rutas y acciones deben existir.
2. **Los cuatro ficheros `.dc.html`.** Son la referencia visual principal para
   composición, jerarquía, densidad, tipografía, color y estados representados.
3. **Los tokens específicos declarados dentro de cada `.dc.html`.** Tienen
   precedencia sobre el sistema genérico Nocturne.
4. **El README y los tokens de Nocturne.** Se usan para extender de forma
   conservadora el diseño a pantallas o estados sin maqueta.
5. **Las capturas de `design/uploads`.** Son material histórico y de contexto, no
   una especificación que deba copiarse píxel a píxel.

Referencias principales:

| Referencia | Superficie de la aplicación |
|---|---|
| [`Inicio de sesión.dc.html`](../design/Inicio%20de%20sesión.dc.html) | Acceso y panel de invitado |
| [`Biblioteca.dc.html`](../design/Biblioteca.dc.html) | Mis listas y listas públicas |
| [`Creador de listas.dc.html`](../design/Creador%20de%20listas.dc.html) | Constructor y sus cuatro pasos |
| [`Soporte.dc.html`](../design/Soporte.dc.html) | Formulario de contacto |

La aplicación no cargará en producción `support.js`, `image-slot.js`,
`_ds_bundle.js` ni el CSS global exportado por Nocturne. Son infraestructura de
la maqueta y su inclusión duplicaría lógica o introduciría funciones de autoría.
El diseño se traducirá a componentes React y CSS propios del proyecto.

## 3. Contrato de conservación funcional

### 3.1 Límites técnicos

- No modificar `src/engine`, `src/catalog`, `src/store`, `src/auth` ni `server`
  salvo que una comprobación demuestre que un cambio puramente presentacional lo
  necesita. No se espera que ocurra.
- No cambiar esquemas, endpoints, payloads, permisos, sesiones, reglas de
  validación ni datos del catálogo.
- Conservar los manejadores, propiedades y estado existentes; los cambios de JSX
  se limitarán a clases, envoltorios semánticos y elementos necesarios para el
  layout.
- No incorporar dependencias de ejecución para reproducir la maqueta.
- No sustituir datos reales por los nombres, correos, listas o cifras de ejemplo
  de los HTML.

### 3.2 Funciones que deben permanecer visibles y operativas

- Acceso, registro, Google real, mostrar contraseña, recuperación, verificación,
  reenvío, aceptación de términos y todos sus estados de carga y error.
- Constructor público en `/crear-lista`, continuidad del borrador al iniciar
  sesión y límites del modo invitado.
- Nombre, raza, escala, minerales, visibilidad, guardado remoto, seed,
  importación/exportación JSON e impresión/PDF.
- Cuatro pasos del constructor, errores por paso, barra de recursos, cartas,
  copias no `UNIQUE`, previsualización, unidades, composiciones, mejoras,
  nominación `SPECIALIST`, orden, unidades de referencia, misiones, despliegues,
  validación, libro mayor y hoja imprimible.
- Confirmaciones al descartar cambios y aviso `beforeunload`.
- Mis listas: filtros, todas las ordenaciones actuales, abrir, ver, cambiar
  visibilidad y borrar.
- Listas públicas: búsqueda, filtros, todas las ordenaciones actuales, ver,
  clonar, dar o retirar like y consultar el detalle de solo lectura.
- Inicio, perfil, preferencias, contraseña, Google, borrado de cuenta,
  superadministración, contacto y términos.
- Estados vacíos, carga, error, bloqueo, pendiente, confirmación y notificaciones.
- Navegación y comportamiento responsive actuales, incluida la navegación móvil
  y la barra de recursos sin tapar el contenido.

No se añadirán elementos que solo aparezcan como ejemplo en la maqueta. En
particular, no se añadirá una ordenación por coste, una cuenta Google simulada ni
un botón redundante de crear lista en el directorio público. El límite real del
mensaje de soporte seguirá siendo 10 000 caracteres, no los 2 000 del prototipo.

## 4. Sistema visual de producción

### 4.1 Color base

Los tokens de la aplicación se normalizarán alrededor de esta paleta:

| Rol | Valor de referencia | Uso |
|---|---|---|
| Fondo | `#11131f` | Página y grandes vacíos |
| Superficie | `#191d2c` | Paneles y formularios |
| Superficie elevada | `#1f2434` | Tarjetas y controles secundarios |
| Campo | `#121521` | Inputs, selects y áreas internas |
| Barra | `#141826` | Recursos, pestañas y franjas técnicas |
| Cabecera | `linear-gradient(#1c2033, #171b29)` | Navegación principal |
| Línea | `rgba(233, 233, 237, .13)` | Bordes y separadores |
| Texto | `#eceaf1` | Contenido principal |
| Texto secundario | `rgba(236, 234, 241, .62)` | Ayudas y metadatos |
| Texto tenue | `rgba(236, 234, 241, .44)` | Etiquetas y datos auxiliares |
| Éxito/recurso | OKLCH, tono `165–175` | Validez y recursos disponibles |
| Advertencia | Ámbar | `UNIQUE`, avisos y desajustes |
| Error/peligro | OKLCH, tono `22` | Errores y acciones destructivas |

No se usarán negro o blanco puros en la interfaz oscura. La hoja imprimible
conservará deliberadamente su superficie clara y su CSS de impresión aislado.

### 4.2 Acento por contexto

El acento se expresa mediante borde, texto, marcador y tinte tenue; no mediante
grandes superficies saturadas.

| Contexto | Tono | Croma base |
|---|---:|---:|
| Acceso | 255 | 0.125 |
| Zerg | 340 | 0.170 |
| Terran | 245 | 0.145 |
| Protoss | 88 | 0.150 |

Las tres razas compartirán los mismos pasos perceptuales de luminosidad. Cambiar
de raza girará la rampa de acento sin modificar la jerarquía, el layout ni los
colores semánticos de éxito, advertencia, error y fases.

### 4.3 Tipografía

- **Inter**, pesos 300–600: cuerpo, formularios, botones, ayudas y datos.
- **Chakra Petch**, pesos 500–700: títulos, navegación, nombres de cartas y
  unidades, cifras destacadas y encabezados técnicos.
- Fallbacks de sistema obligatorios; la falta temporal de la fuente no puede
  desplazar ni bloquear controles.
- Cuerpo base: 15 px. Microtexto: no bajar de 11 px en producción.
- Títulos de página: hasta 38 px en escritorio, fluidos en móvil.
- Etiquetas de sección: 11.5–13 px, mayúsculas y tracking amplio.
- Datos numéricos: `font-variant-numeric: tabular-nums`.

### 4.4 Espaciado, tamaño y geometría

- Escala compacta basada en 4, 8, 12, 16, 18, 22 y 24 px.
- Márgenes laterales de página: 22–24 px en escritorio y 12–16 px en móvil.
- Paneles: padding de 16–24 px y radio de 12 px.
- Tarjetas: radio de 9–11 px. Controles: radio de 8 px.
- Campos y acciones principales: altura mínima de 42–46 px.
- Acciones compactas: nunca por debajo de 36 px; objetivos táctiles móviles de
  al menos 40 px.
- Píldoras de perfil, modo y estado: radio `999px`.
- Elevación general mediante borde y contraste tonal. Las sombras profundas y
  el desenfoque se reservan para acceso y modales.

### 4.5 Estados interactivos

Cada control debe conservar estados distinguibles de:

- reposo;
- hover;
- active/pressed;
- foco de teclado con contorno de 2 px del acento;
- seleccionado/actual;
- deshabilitado;
- bloqueado con motivo;
- carga o pendiente;
- error y éxito cuando proceda.

El color no será la única señal: selección, validez y error mantendrán también
borde, icono, texto o atributo semántico. Se respetará `prefers-reduced-motion`.

## 5. Patrones de componentes

### 5.1 Shell

- Cabecera oscura con logo, separador, “Listas de ejército”, navegación,
  identidad y salida.
- Navegación activa mediante borde/tinte de acento; la acción “Nueva lista” se
  distingue sin convertirse en un bloque saturado.
- Variante invitada simplificada con “Borrar lista” y la píldora “Modo invitado”.
- Footer legal común y discreto.
- En móvil se conserva el menú desplegable actual; la maqueta de escritorio no
  autoriza a eliminarlo.

### 5.2 Paneles, tarjetas y secciones

- Panel: superficie, borde tenue, radio 12 px y sin sombra pesada.
- Encabezado de sección: barra vertical sólida de 3 px en el acento.
- Tarjeta seleccionable: borde de acento, tinte interior y glow muy sutil.
- Tarjeta bloqueada: opacidad reducida sin ocultar el motivo y el remedio.
- Mensajes: borde izquierdo semántico y contenido legible.

### 5.3 Botones y formularios

- Primario: contorno de acento con relleno translúcido.
- Secundario: superficie elevada y borde tenue.
- Destructivo: borde/tinte rojo, reservado a borrar o eliminar.
- Inputs: fondo de campo, borde tenue, etiqueta superior en mayúsculas y foco de
  acento.
- Checkboxes, switches y selects conservarán controles nativos accesibles.

### 5.4 Chips y color semántico

- Raza/espacio: rampa de la raza.
- Coste y recurso por ronda: neutro legible.
- `UNIQUE`: ámbar.
- Validez: verde o rojo con símbolo y texto.
- Fases: movimiento cyan, asalto naranja, combate rosa, disparo rojo, final
  violeta; “cualquier fase” se mantiene neutra.

### 5.5 Constructor

- Barra de opciones, barra de recursos y pestañas forman una cabecera técnica
  compacta.
- En escritorio se mantiene el resumen de recursos visible durante el trabajo;
  en móvil conserva la posición que evita perder contexto sin tapar contenido.
- Pasos 1 y 2 usan catálogo a la izquierda y selección/detalle a la derecha en
  escritorio; se apilan en anchos menores.
- Misiones y despliegues usan grids fluidos; las imágenes actuales de mapas se
  conservan.
- La revisión mantiene validación separada y una previsualización clara de la
  hoja. La impresión real no hereda el chrome oscuro.

### 5.6 Biblioteca

- Ancho máximo: 1180 px.
- Título, subtítulo y acción contextual sobre filtros compactos.
- Tabla de escritorio con cabecera oscura, filas separadas y acciones alineadas.
- El overflow horizontal solo se admite dentro del contenedor de tabla. En móvil
  se conservará la adaptación actual sin ocultar acciones.

### 5.7 Acceso y soporte

- Acceso: fondo espacial azul, capas de oscurecimiento, logo centrado y dos
  paneles translúcidos de máximo 880 px. Una columna en móvil.
- El botón de Google será el oficial que ya monta la aplicación; no se imitará
  la identidad estática de la maqueta.
- Soporte: contenido de máximo 760 px, formulario en panel, dos columnas para
  asunto/correo y una columna en móvil.
- Registro, recuperación, verificación y estados auxiliares heredarán el mismo
  panel de acceso sin cambiar sus flujos.

## 6. Pantallas sin maqueta específica

Inicio, detalle público, perfil, superadministración, términos, modales, seed,
notificaciones y estados de carga/error/vacío conservarán su estructura actual.
Se les aplicarán tokens, tipografía, controles, paneles y shell comunes. No se
reorganizará información ni se inventarán acciones para “completar” el diseño.

## 7. Responsive e impresión

Los HTML no definen breakpoints completos. Por tanto:

- se conserva la estrategia responsive actual como fuente de verdad;
- se validarán 1440×900, 1024×768, 768 px, 390 px y un mínimo de 360 px;
- no habrá scroll horizontal de página; solo podrán desplazarse contenedores de
  datos que realmente lo necesiten;
- ningún elemento fijo podrá tapar controles o contenido;
- navegación, acciones, pestañas y filtros podrán envolver o apilarse;
- la salida A4 seguirá sin navegación, fondos oscuros ni controles y deberá ser
  legible en escala de grises.

## 8. Activos

Se reutilizarán desde `design/assets` el logo y los favicons, y desde
`design/uploads/pasted-1786001554183-0.png` la nave del acceso. Las imágenes de
unidades, cartas y despliegues seguirán procediendo de `public`, porque los
`image-slot` del prototipo no contienen esos activos.

Los activos se copiarán a `public` con nombres estables; `design` seguirá siendo
una referencia, no una dependencia de ejecución.

## 9. Criterio de finalización del diseño

El diseño se considerará trasladado cuando todas las superficies actuales usen
el sistema visual descrito, los cuatro HTML tengan una correspondencia clara,
las pantallas no dibujadas resulten coherentes por herencia y el conjunto supere
la matriz funcional, responsive, accesible y de impresión de la hoja de ruta,
sin diferencias en capacidades antes y después del cambio.
