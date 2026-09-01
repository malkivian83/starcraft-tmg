import type { SupportedLocale } from '@/i18n/types';

type LocalizedText = Record<SupportedLocale, string>;

export interface ChangelogEntry {
  version: string;
  date: string;
  title: LocalizedText;
  changes: LocalizedText[];
}

/**
 * Historial visible para quienes usan la aplicación.
 *
 * La primera entrada debe coincidir siempre con la versión de package.json.
 * El contenido evita detalles internos y explica únicamente cambios que una
 * persona puede ver o utilizar.
 */
export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = [
  {
    version: '2.01',
    date: '2026-09-01',
    title: {
      es: 'FAQ oficial y consulta de cartas',
      en: 'Official FAQ and card previews',
    },
    changes: [
      {
        es: 'La nueva sección FAQ reúne en español las 68 aclaraciones oficiales e incluye acceso al PDF original en inglés.',
        en: 'The new FAQ section includes all 68 official clarifications and provides access to the original English PDF.',
      },
      {
        es: 'Las pantallas de selección incluyen una lupa para consultar la carta original en inglés.',
        en: 'Selection screens now include a magnifier to view the original English card.',
      },
      {
        es: 'Las unidades muestran el anverso y el reverso en el orden correcto, y las tácticas conservan debajo su detalle localizado.',
        en: 'Units show their front and back in the correct order, while tactical cards keep their localized detail below.',
      },
    ],
  },
  {
    version: '1.06',
    date: '2026-08-25',
    title: {
      es: 'Partidas y navegación más claras',
      en: 'Clearer games and navigation',
    },
    changes: [
      {
        es: 'Las partidas guardadas muestran de un vistazo los jugadores, las razas, el marcador, la misión y la ronda actual.',
        en: 'Saved games now show players, races, score, mission, and current round at a glance.',
      },
      {
        es: 'Las listas asociadas a una partida se pueden abrir directamente desde su tarjeta.',
        en: 'Lists linked to a game can now be opened directly from its card.',
      },
      {
        es: 'La navegación se ha renovado para que sea más clara en ordenador, portátil y móvil, también dentro de Mis partidas al iniciar sesión.',
        en: 'Navigation has been refreshed to be clearer on desktop, laptop, and mobile, including My games after signing in.',
      },
      {
        es: 'La sección de ayuda ahora se llama Contacto y el pie incluye este resumen de novedades.',
        en: 'The help section is now called Contact, and the footer includes this summary of what is new.',
      },
      {
        es: 'La configuración de una nueva partida presenta ahora la misión y los jugadores de forma más clara y cómoda en móvil.',
        en: 'New game setup now presents the mission and players more clearly, with a layout designed for mobile too.',
      },
      {
        es: 'Al crear una partida puedes consultar mapas de ejemplo adaptados al formato Estándar o Escaramuza y ampliarlos para preparar la mesa.',
        en: 'When creating a game, you can browse example maps for Standard or Skirmish and enlarge them while setting up the table.',
      },
    ],
  },
  {
    version: '1.04',
    date: '2026-08-23',
    title: {
      es: 'Creación de listas más flexible',
      en: 'More flexible list building',
    },
    changes: [
      {
        es: 'Puedes reclutar unidades aunque todavía te falten espacios y completar después las cartas tácticas necesarias.',
        en: 'You can recruit units before all required slots are available and add the needed tactical cards afterwards.',
      },
      {
        es: 'Al revisar una lista, un resumen reúne los problemas pendientes y explica cómo resolverlos.',
        en: 'When reviewing a list, a summary gathers outstanding issues and explains how to resolve them.',
      },
    ],
  },
  {
    version: '1.03',
    date: '2026-08-23',
    title: {
      es: 'Listas listas para compartir',
      en: 'Lists ready to share',
    },
    changes: [
      {
        es: 'El texto copiado de una lista tiene un formato más claro para compartirlo por WhatsApp u otras aplicaciones.',
        en: 'Copied list text now has a clearer format for sharing through WhatsApp or other apps.',
      },
    ],
  },
];
