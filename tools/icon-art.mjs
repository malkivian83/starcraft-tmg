/*
 * Arte del icono de la aplicación: silueta cenital de un insecto alienígena
 * (facción enjambre) sobre el azul noche del tema. Se define una sola vez
 * aquí y se consume desde `generate-icons.mjs` tanto para los PNG como para
 * los SVG, de modo que favicon, icono de PWA e icono de iOS no puedan
 * divergir.
 *
 * Sistema de coordenadas: lienzo de 512×512 con el eje de simetría en x=256.
 * Cada pieza se describe solo en la mitad derecha y se refleja al construir
 * el trazado: así el bicho es simétrico por construcción y no aparece una
 * costura de antialias sobre el eje.
 *
 * Todos los puntos se mantienen dentro de un radio de ~190 respecto del
 * centro, que es la zona segura de los iconos `maskable`: Android los recorta
 * en círculo y lo que sobresalga se pierde.
 */

export const CANVAS = 512;
const AXIS = CANVAS / 2;

export const COLORS = {
  // Mismo azul noche que `theme_color` del manifiesto y `<meta name="theme-color">`.
  background: '#11131f',
  // Acento de la facción enjambre en la app: oklch(0.7 0.17 340).
  body: '#e16fbf',
};

// ---------------------------------------------------------------------------
// Utilidades de trazado
// ---------------------------------------------------------------------------

const mirrorPoint = ([x, y]) => [CANVAS - x, y];

/**
 * Cuerpo simétrico: recibe la mitad derecha (del eje al eje, en el sentido de
 * las agujas del reloj) y devuelve el contorno cerrado completo.
 *
 * Un cúbico A →(c1,c2)→ B recorrido al revés es B →(c2,c1)→ A, así que basta
 * con invertir el orden de los segmentos, intercambiar los controles y
 * reflejar las x.
 */
function symmetricBody(start, segments) {
  const anchors = [start];
  for (const segment of segments) anchors.push(segment.slice(-2));

  const parts = [`M ${start[0]} ${start[1]}`];
  for (const [command, ...values] of segments) parts.push(`${command} ${values.join(' ')}`);

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const [command, ...values] = segments[i];
    const [fromX, fromY] = anchors[i];
    if (command === 'C') {
      const [c1x, c1y, c2x, c2y] = values;
      parts.push(
        `C ${CANVAS - c2x} ${c2y} ${CANVAS - c1x} ${c1y} ${CANVAS - fromX} ${fromY}`,
      );
    } else if (command === 'L') {
      parts.push(`L ${CANVAS - fromX} ${fromY}`);
    } else {
      throw new Error(`Comando sin reflejo definido: ${command}`);
    }
  }
  return `${parts.join(' ')} Z`;
}

/**
 * Apéndice (pata, mandíbula, aguijón) a partir de su línea media: engorda la
 * polilínea a cada lado según el radio indicado en cada vértice. Un radio 0
 * al final deja la punta afilada, que es lo que da el aire de quitina.
 *
 * La normal de cada vértice se promedia entre los dos tramos que lo tocan;
 * no es un mitrado exacto, pero a estos grosores la diferencia no se ve.
 */
function appendix(points, radii) {
  const normals = points.map((point, i) => {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const [dx, dy] = [next[0] - previous[0], next[1] - previous[1]];
    const length = Math.hypot(dx, dy) || 1;
    return [-dy / length, dx / length];
  });

  const side = (sign) =>
    points.map(([x, y], i) => [
      x + normals[i][0] * radii[i] * sign,
      y + normals[i][1] * radii[i] * sign,
    ]);

  const outline = [...side(1), ...side(-1).reverse()];
  return `M ${outline
    .map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' L ')} Z`;
}

// ---------------------------------------------------------------------------
// Piezas del insecto
// ---------------------------------------------------------------------------

/*
 * Abdomen: gota acabada en punta con dos púas por lado. Las púas rompen el
 * contorno liso, que a tamaño grande parecía una mancha, y son lo que da el
 * aire de quitina del enjambre.
 */
const ABDOMEN = symmetricBody(
  [AXIS, 252],
  [
    ['C', 288, 258, 322, 296, 328, 336],
    ['L', 358, 356],
    ['L', 316, 366],
    ['L', 334, 404],
    ['L', 292, 408],
    ['C', 280, 424, 268, 432, AXIS, 450],
  ],
);

/* Tórax: placa angular de la que salen las seis patas. */
const THORAX = symmetricBody(
  [AXIS, 168],
  [
    ['L', 302, 186],
    ['L', 318, 232],
    ['L', 296, 268],
    ['L', AXIS, 282],
  ],
);

/* Cabeza: cápsula corta, separada del tórax por un cuello estrecho. */
const HEAD = symmetricBody(
  [AXIS, 116],
  [
    ['C', 282, 124, 296, 142, 294, 164],
    ['C', 292, 182, 278, 192, AXIS, 196],
  ],
);

/* Mandíbula derecha: se abre hacia fuera y cierra con la punta hacia el eje. */
const MANDIBLE = [
  [284, 158],
  [330, 126],
  [338, 90],
  [306, 72],
];
// La punta no baja a 0: a 32 px un extremo infinitamente fino desaparece.
const MANDIBLE_RADII = [24, 18, 12, 4];

/*
 * Patas derechas, de delante hacia atrás. Cada una es fémur y tibia: el
 * codo hacia fuera y el tarso hacia abajo, como en un insecto real. El
 * arranque queda bajo el tórax, que lo tapa.
 */
const LEGS = [
  { points: [[268, 190], [366, 132], [412, 164]], radii: [21, 14, 4] },
  { points: [[270, 232], [398, 222], [438, 270]], radii: [21, 14, 4] },
  { points: [[270, 266], [388, 296], [410, 360]], radii: [21, 14, 4] },
];

const mirrored = (points) => points.map(mirrorPoint);

/*
 * Orden de pintado: primero los apéndices y luego el cuerpo, que tapa sus
 * arranques. Las piezas del mismo color se superponen sin costura porque el
 * compuesto de dos opacos idénticos vuelve a dar el mismo color.
 */
export const SHAPES = [
  ...LEGS.flatMap(({ points, radii }) => [
    { d: appendix(points, radii), fill: COLORS.body },
    { d: appendix(mirrored(points), radii), fill: COLORS.body },
  ]),
  { d: appendix(MANDIBLE, MANDIBLE_RADII), fill: COLORS.body },
  { d: appendix(mirrored(MANDIBLE), MANDIBLE_RADII), fill: COLORS.body },
  { d: ABDOMEN, fill: COLORS.body },
  { d: THORAX, fill: COLORS.body },
  { d: HEAD, fill: COLORS.body },
];
