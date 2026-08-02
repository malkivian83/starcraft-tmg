# Modelo de datos — Constructor de listas de ejército

Versión 1.0 · Esquema del catálogo y de las listas guardadas

---

## 1. Principios

1. **Catálogo y lista son cosas distintas.** El catálogo es contenido del juego, de solo lectura, versionado y compartido. La lista es un documento del usuario que **referencia** al catálogo por identificador, nunca lo copia.
2. **Nada de datos derivados persistidos.** Costes totales, espacios usados y validez se calculan siempre. Guardarlos permitiría que un fichero editado a mano mintiera sobre su propia legalidad.
3. **Identificadores estables y legibles.** `zerg.unit.hydralisk`, no `u_0042`. Si un identificador cambia, es un cambio mayor de catálogo.
3b. **Todo elemento referenciable lleva además un `seedId` numérico permanente.** Es lo que permite codificar una lista en una cadena corta (§5 del SDD). Se asigna una vez y **no se reordena, no se reutiliza y no se deriva del orden del fichero**.
4. **El catálogo es la única fuente de verdad de las reglas de contenido.** El motor no contiene ningún dato de unidades.

## 2. Separación entre carta y entrada reclutable

Es la decisión estructural del modelo, derivada del hallazgo H2.

El reglamento lista entradas como `RAPTOR (ZERGLING)`, `KERRIGAN SWARM RAPTOR (ZERGLING)` y `SWARMLING (ZERGLING)`. Las tres usan la **carta de unidad Zergling** — mismo perfil de movimiento, heridas, armas base — pero son entradas de ejército **distintas**: etiquetas distintas (y por tanto elegibilidad distinta), costes distintos y opciones de composición distintas.

Por eso:

- **`UnitCard`** — el perfil de juego. Lo que está impreso en la carta.
- **`UnitEntry`** — lo que se puede reclutar. Apunta a una `UnitCard` y aporta etiquetas, tipo de espacio, composiciones y mejoras con sus costes.

Una `UnitCard` puede tener varias `UnitEntry`. La lista del usuario referencia `UnitEntry`, nunca `UnitCard`.

Modelarlo al revés — una sola entidad con costes opcionales por variante — obliga a rehacer el catálogo entero al llegar a Terran, que tiene el mismo patrón (`RAYNOR'S RAIDERS (MARINE)`).

## 3. Entidades del catálogo

### 3.1 `Catalog`

```ts
interface Catalog {
  schemaVersion: string;        // versión del formato, p.ej. "1.0.0"
  contentVersion: string;       // versión del contenido del juego, p.ej. "2026.05.1.0"
  sourceRef: string;            // "StarCraft-TMG_EN.pdf v1.0, May 2026"
  scales: EngagementScale[];
  races: Race[];
  factionCards: FactionCard[];
  tacticalCards: TacticalCard[];
  creepCards: CreepCard[];      // solo Zerg; ver §3.6
  unitCards: UnitCard[];
  unitEntries: UnitEntry[];
  keywords: Keyword[];          // glosario de palabras clave de reglas
}

interface ScenarioCatalog {     // fichero aparte: común a las tres razas
  schemaVersion: string;
  contentVersion: string;
  missionCards: MissionCard[];
  deploymentCards: DeploymentCard[];
}
```

`schemaVersion` y `contentVersion` son independientes: una errata que cambia un coste sube `contentVersion`; añadir un campo nuevo sube `schemaVersion`.

### 3.2 Tipos base

```ts
type Race = 'ZERG' | 'TERRAN' | 'PROTOSS';

type SlotType = 'CORE' | 'ELITE' | 'SUPPORT' | 'AIR' | 'HERO';

type ResourceType = 'CP' | 'BM' | 'PE';   // recurso por ronda de la carta de facción

type FactionTag = string;  // "ZERG", "KERRIGAN'S SWARM", "TERRAN", "RAYNOR'S RAIDERS"

type SlotPool = Partial<Record<SlotType, number>>;   // { CORE: 3, ELITE: 1 }

interface Localized {           // solo para texto EXPLICATIVO
  es: string;
  en: string;                   // original conservado como respaldo
}

type ProperName = string;       // nombres propios: SIEMPRE en inglés, sin traducir
```

### Regla de idioma en el modelo

Se distinguen dos tipos de cadena, y la distinción es estructural, no cosmética:

- **`ProperName`** — nombres de unidades, armas, habilidades, cartas y palabras clave. Se guardan en inglés y **no se traducen nunca**. Un solo valor, sin objeto de idiomas.
- **`Localized`** — textos que explican algo: efectos de habilidades, descripciones, mensajes. Se guardan en español (`es`) conservando el original (`en`) por si hay dudas de traducción.

Que el tipo lo imponga evita el error más probable de la fase de transcripción: traducir un nombre por inercia al ir traduciendo su texto. Si alguien intenta poner un objeto `{es, en}` donde va un `ProperName`, no compila.

`SlotPool` es parcial a propósito: una carta que no otorga espacios (`SUPPLY: -`) es `{}`, no un objeto con cinco ceros.

### 3.3 `EngagementScale`

```ts
interface EngagementScale {
  id: 'skirmish' | 'standard' | 'grand_offensive';
  name: Localized;
  mineralLimit: number | null;   // null en Gran Ofensiva: lo fija el usuario
  mineralMinimum: number;        // 2001 en Gran Ofensiva, 0 en el resto
  vespeneRatio: number;          // 0.10 en todas las escalas actuales
  battlefield: string;           // "36\" × 54\""
}
```

El gas es un **ratio**, no un valor fijo: el reglamento lo define como el 10 % de los minerales. Codificar 200 para Estándar rompería Gran Ofensiva.

### 3.4 `FactionCard`

```ts
interface FactionCard {
  id: string;                    // "zerg.faction.kerrigans_swarm"
  race: Race;
  name: Localized;
  tags: FactionTag[];            // etiquetas que definen la elegibilidad
  startingSlots: SlotPool;
  resource: ResourceType;
  resourcePerRound: number;      // "BM: 1"
  abilities: Ability[];
  unique: true;                  // siempre una sola carta de facción
  imageRef?: string;
}
```

### 3.5 `TacticalCard`

```ts
interface TacticalCard {
  id: string;                    // "zerg.tactical.spawning_pool"
  race: Race;
  name: Localized;
  tags: FactionTag[];
  vespeneCost: number;
  slotsGranted: SlotPool;        // {} si la carta no otorga espacios
  unique: boolean;               // UNIQUE impreso en la carta
  resource?: ResourceType;
  resourcePerRound?: number;
  abilities: Ability[];
  imageRef?: string;
}
```

`unique: false` significa que la carta puede incluirse varias veces. `Barracks` y `Barracks (Proxy)` son cartas **distintas**, no dos copias de la misma.

### 3.6 `CreepCard` (solo Zerg)

```ts
interface CreepCard {
  id: string;                    // "zerg.creep.malignant_creep"
  race: 'ZERG';
  name: ProperName;              // "Malignant Creep"
  vespeneCost: number;           // 0 en Accelerating Creep, 10 en Malignant Creep
  abilities: Ability[];
  imageRef?: string;
}
```

Tipo propio, no una carta táctica con una marca. Los motivos:

1. Está impreso como `CREEP CARD`, un tipo de carta distinto de `TACTICAL CARD`.
2. **No otorga espacios de ejército**, mientras que la razón de ser de una carta táctica es otorgarlos.
3. Su cardinalidad es **exactamente 1** (obligatorio), frente a *0..n* de las tácticas.

Ambas cartas de facción Zerg incluyen la habilidad `ZERG CREEP`:

> *During Army Building, select exactly one Creep Card and add it to their Army List, paying its listed cost (if any).*

Modelarlo como carta táctica «especial» obligaría a llenar el motor de excepciones. Como entidad propia, la regla R11 es una comprobación de una línea.

Se paga con gas vespeno, igual que las tácticas, y computa en el límite de gas.

### 3.7 `UnitCard`

```ts
interface UnitCard {
  id: string;                    // "zerg.card.zergling"
  race: Race;
  name: Localized;
  baseSize: number;              // tamaño de peana en mm
  profile: {
    size: number;
    hitPoints: string;           // "4/7" — se guarda tal cual está impreso
    evade: string;               // "5+"
    armour: string;              // "5+"
    speed: number;
  };
  weapons: Weapon[];
  abilities: Ability[];
  supplyProfile: SupplyBand[];   // tabla modelos → suministro de la carta
  imageRefFront?: string;
  imageRefBack?: string;
}

interface SupplyBand {
  minModels: number;
  maxModels: number;
  supply: number;                // 1-3 → 0, 4-6 → 1, 7-9 → 2
}
```

Las características de dados (`5+`, `4/7`) se guardan como texto. Convertirlas a número perdería información y no aporta nada: la app no tira dados.

```ts
interface Weapon {
  name: Localized;
  phase: 'ASSAULT' | 'COMBAT' | 'MOVEMENT' | 'ANY';
  range: string;                 // "12", "E" (engagement)
  target: string;                // "Ground", "All"
  rateOfAttack: string;
  hit: string;                   // "3+"
  surgeType: string | null;      // "Light", "Armoured", null
  surgeDice: string | null;      // "D3", "D6", null
  damage: string;
  keywords: string[];            // ["LONG RANGE (18\")", "SPECIALIST"]
}

interface Ability {
  name: Localized;
  phase: 'MOVEMENT' | 'ASSAULT' | 'COMBAT' | 'ANY';
  type: 'ACTIVE' | 'PASSIVE' | 'REACTION';
  cost: number | 'X' | null;     // coste en CP/BM/PE; X si es variable
  text: Localized;
  fromUpgrade: boolean;          // si solo está disponible con una mejora
}
```

### 3.8 `UnitEntry` — el corazón del modelo

```ts
interface UnitEntry {
  id: string;                    // "zerg.entry.swarmling"
  cardId: string;                // "zerg.card.zergling"
  race: Race;
  name: Localized;               // "Swarmling (Zergling)"
  tags: FactionTag[];            // determina la elegibilidad
  slotType: SlotType;
  combatRole: Localized;
  summoned: boolean;             // true → no reclutable, no ocupa espacios
  compositions: Composition[];
  upgrades: UpgradeOption[];
}

interface Composition {
  id: string;                    // "6" o "6_models"
  models: number;
  mineralCost: number;
  supplyValue: number;           // espacios que ocupa, del apéndice §12.10
}
```

`supplyValue` se guarda **en la composición**, no se deriva de `supplyProfile`. El apéndice de puntos lo indica explícitamente por opción; duplicar la lógica de bandas sería una fuente de discrepancias.

`summoned: true` (Roachling, Point Defence Drone, Pylon) implica sin `compositions` de coste: no se incluyen en la lista (§9.1.9). Se catalogan porque el usuario querrá consultarlas.

### 3.9 `MissionCard` y `DeploymentCard`

Van en un catálogo aparte porque **son idénticas en las tres razas** (hallazgo M1). Empaquetarlas con cada raza las duplicaría por tres, con el riesgo de que las copias se desincronicen.

```ts
interface MissionCard {
  id: string;                    // "mission.gather_the_resources.standard"
  name: ProperName;              // "Gather the Resources"
  scale: 'skirmish' | 'standard' | 'grand_offensive';
  startingSupply: number;        // 6 en Standard, 3 en Skirmish
  supplyEscalation: number;      // +2 / +1 por ronda
  gameLength: number;            // rondas, normalmente 5
  missionParameters: Localized;
  scoringConditions: Localized;
  additionalConditions: Localized;
  instantWinLead: number | null; // 10 en Standard, 8 en Skirmish
  imageRef?: string;
}

interface DeploymentCard {
  id: string;                    // "deployment.char_plains"
  name: ProperName;              // "Char Plains"
  scale: 'skirmish' | 'standard' | 'grand_offensive';
  battlefield: { width: number; height: number };   // en pulgadas
  imageRef: string;              // OBLIGATORIO: el diagrama es la carta
  notes?: Localized;
}
```

Dos decisiones a destacar:

**La variante de escala forma parte de la identidad de la misión.** `Gather the Resources` en Standard y en Skirmish son **cartas distintas**, con id propio, no una carta con dos juegos de valores. Es el mismo patrón que las variantes de cepa en las unidades (§2), y se resuelve igual por el mismo motivo: modelarlo como campos opcionales llena el motor de condicionales.

**`imageRef` es obligatorio en `DeploymentCard`.** Las coordenadas de los marcadores 1–5 son un diagrama sobre rejilla, no una lista de números (hallazgo M4). Transcribirlas a datos sería lento, propenso a error y produciría algo peor que la imagen original. Una carta de despliegue sin su imagen no sirve de nada, así que el tipo lo exige.

### 3.10 `UpgradeOption`

```ts
interface UpgradeOption {
  id: string;                    // "zerg.upgrade.adrenal_glands"
  name: Localized;
  specialist: boolean;           // palabra clave SPECIALIST
  replacesWeapon: string | null; // "C-14 Rifle" si es "↑ FOR C-14 Rifle"
  costByComposition: Record<string, number>;   // { "6": 20, "9": 30 }
  grantsWeapons: Weapon[];
  grantsAbilities: Ability[];
  text?: Localized;
}
```

`costByComposition` implementa el hallazgo H3. Una mejora no disponible para una composición sencillamente no aparece como clave — es la forma de representar el `-` de las tablas del manual.

La fase de una mejora se conserva en la habilidad o arma que concede
(`grantsAbilities[].phase` o `grantsWeapons[].phase`). La interfaz y la hoja
PDF la muestran siempre; para una mejora puramente pasiva se usa la fase que
figura en la hoja P2P, incluidos los casos de **Cualquier fase**.

La presentación no puede separar el valor de su unidad: un coste de habilidad
debe mostrarse como `1 CP`, `2 PE`, `1 BM` o `X CP`, nunca como un número suelto.
El coste de una mejora siempre se muestra como minerales (`+20 min.`) y se
obtiene de `costByComposition` para la composición seleccionada. Las armas de
mejora usan exactamente la misma tabla que las armas base, incluidos alcance,
objetivo, RdA, impacto, surge, daño y palabras clave.

## 4. Entidades de la lista del usuario

```ts
interface ArmyList {
  id: string;                    // uuid
  name: string;
  createdAt: string;             // ISO 8601
  updatedAt: string;
  catalogContentVersion: string; // con qué versión se construyó
  schemaVersion: string;

  scaleId: string;
  mineralLimit: number;          // resuelto; en Gran Ofensiva lo fija el usuario
  factionCardId: string;
  tacticalCardIds: string[];     // con repeticiones si la carta no es UNIQUE
  creepCardId: string | null;    // Zerg: obligatorio exactamente uno (R11)
  entries: ListEntry[];

  // Escenarios que el jugador lleva al draft (§9.2)
  missionCardIds: string[];      // exactamente 2, distintas (R12)
  deploymentCardIds: string[];   // exactamente 2, distintas (R12)

  notes?: string;
}

interface ListEntry {
  instanceId: string;            // uuid; permite dos unidades idénticas
  unitEntryId: string;
  compositionId: string;
  upgrades: AppliedUpgrade[];
  customLabel?: string;          // "Escuadra Alfa"
  reference: boolean;            // true en unidades invocadas: no computa
}

interface AppliedUpgrade {
  upgradeId: string;
  modelIndex: number | null;     // null en mejoras estándar; índice en ESPECIALISTA
}
```

Nada de costes ni totales en la lista guardada. Todo se recalcula al cargar, contra el catálogo.

`instanceId` es imprescindible: el ejemplo del manual incluye dos unidades de Marines de 9 modelos con equipamiento potencialmente distinto. Sin identificador de instancia serían indistinguibles.

`modelIndex` nomina el modelo que porta una mejora SPECIALIST, tal como exige §9.1.7.

`reference: true` marca las unidades invocadas (`Roachling`, `Omega Worm`, `Point Defence Drone`, `Pylon`). Se añaden para tener sus stats a mano en la app y en la impresión, pero **no cuestan minerales ni ocupan espacios de ejército** (§9.1.9). Es una bandera explícita en lugar de deducirlo de `summoned` en el catálogo: así el motor filtra por un solo campo y la hoja impresa puede separarlas visualmente en un bloque de «unidades invocadas (referencia)», que es lo que evita que alguien las confunda con parte de la lista.

## 5. Resultado de la validación

No se persiste. Es el valor devuelto por el motor.

```ts
interface ValidationResult {
  legal: boolean;
  errors: ValidationIssue[];     // impiden que la lista sea legal
  warnings: ValidationIssue[];   // legal, pero conviene revisar
  summary: {
    mineralsSpent: number;
    mineralLimit: number;
    vespeneSpent: number;         // tácticas + creep card
    vespeneLimit: number;
    resourceType: ResourceType;   // CP, BM o PE según la raza
    resourcePerRound: number;     // suma de facción + todas las tácticas
    totalSupply: number;          // suma de supplyValue de las unidades
    slots: Record<SlotType, SlotLedger>;
  };
}

interface SlotLedger {
  used: number;
  total: number;
  grantedBy: { cardId: string; amount: number }[];   // qué carta aporta cuánto
  consumedBy: { instanceId: string; amount: number }[];
}

interface ValidationIssue {
  rule: string;                  // "R4"
  ruleRef: string;               // "§9.1.5"
  message: Localized;
  entryInstanceId?: string;      // a qué elemento afecta
  remedy?: Localized;            // qué hacer para resolverlo
}
```

`SlotLedger` no se limita a contar. Registra **qué carta aporta cada espacio y qué unidad lo consume**, lo que permite responder «¿por qué no me caben más Hydralisks?» señalando la carta que falta, en lugar de dejar al usuario haciendo cuentas. Es la carencia D4 detectada en la app de referencia.

`resourcePerRound` acumula el recurso de la carta de facción y el de **todas** las cartas tácticas (`+1 CP`, `+2 CP`, `+1 BM`). No hay límite, así que no es una restricción, pero es un indicador que el jugador consulta al decidir qué cartas comprar.

`totalSupply` es la suma de los valores de suministro de las unidades. Es distinto de los espacios ocupados —aunque se calcule del mismo número— porque interviene en el juego para controlar y disputar marcadores de misión, no solo en la construcción.

`remedy` no es un adorno. Un error que dice «no quedan espacios de Élite» sin decir «compra una Guarida de Hydraliscos» obliga al usuario a volver al PDF, que es justo lo que la app debe evitar.

## 6. Ejemplo — lista del reglamento §9.1

Reproducida con el modelo, para verificarlo antes de escribir código:

```json
{
  "name": "Raynor's Raiders — ejemplo del manual",
  "catalogContentVersion": "2026.05.1.0",
  "scaleId": "standard",
  "mineralLimit": 2000,
  "factionCardId": "terran.faction.raynors_raiders",
  "tacticalCardIds": [
    "terran.tactical.barracks",
    "terran.tactical.barracks_proxy",
    "terran.tactical.factory",
    "terran.tactical.orbital_command",
    "terran.tactical.academy",
    "terran.tactical.engineering_bay"
  ],
  "entries": [
    { "instanceId": "a1", "unitEntryId": "terran.entry.marine",   "compositionId": "9", "upgrades": [] },
    { "instanceId": "a2", "unitEntryId": "terran.entry.marine",   "compositionId": "9", "upgrades": [] },
    { "instanceId": "a3", "unitEntryId": "terran.entry.marine",   "compositionId": "6",
      "upgrades": [ { "upgradeId": "terran.upgrade.agg_12", "modelIndex": 0 } ] },
    { "instanceId": "a4", "unitEntryId": "terran.entry.marauder", "compositionId": "4",
      "upgrades": [ { "upgradeId": "terran.upgrade.kinetic_foam", "modelIndex": null } ] },
    { "instanceId": "a5", "unitEntryId": "terran.entry.marauder", "compositionId": "2", "upgrades": [] },
    { "instanceId": "a6", "unitEntryId": "terran.entry.jim_raynor","compositionId": "1", "upgrades": [] },
    { "instanceId": "a7", "unitEntryId": "terran.entry.medic",    "compositionId": "3", "upgrades": [] },
    { "instanceId": "a8", "unitEntryId": "terran.entry.medic",    "compositionId": "3", "upgrades": [] },
    { "instanceId": "a9", "unitEntryId": "terran.entry.goliath",  "compositionId": "1", "upgrades": [] }
  ]
}
```

Resultado esperado del motor:
- Minerales en unidades: 210+210+160+280+150+250+110+110+190 = **1 670** ✓ (coincide con el manual)
- Gas: 25+40+35+25+35+25 = **185** de 200 ✓ (coincide con el manual)
- Espacios: 8/8 Núcleo, 1/1 Héroe, 2/3 Apoyo, 0/1 Aéreo, 2/2 Élite ✓ (coincide con el manual)
- Avisos esperados: 15 de gas sin gastar, 1 espacio de Apoyo y 1 Aéreo sin usar, 330 minerales sin gastar.

**Este ejemplo es el caso de regresión principal del proyecto.** Si el motor no lo reproduce cifra por cifra, hay un error en los datos o en las reglas.

## 7. Versionado del catálogo

| Cambio | Efecto |
|---|---|
| Corrección de un coste (errata) | Sube `contentVersion`. Las listas guardadas con versión anterior se recalculan y se avisa si dejan de ser legales |
| Nueva unidad o carta | Sube `contentVersion`. Sin impacto en listas existentes |
| Eliminación o cambio de un `id` | Cambio mayor. Requiere migración explícita |
| Campo nuevo en el esquema | Sube `schemaVersion`. Compatible hacia atrás |

Una lista nunca se modifica en silencio al cambiar el catálogo. Si el cambio la afecta, se informa al usuario y decide él.

## 8. Validación del catálogo

Antes de publicar, un script debe comprobar:

1. Conformidad con el JSON Schema generado a partir de estas interfaces.
2. Integridad referencial: todo `cardId` de una `UnitEntry` existe; todo `upgradeId` es único dentro de su entrada.
3. **Cruce reglamento ↔ cartas**: toda entrada del apéndice §12.10 tiene su carta, y toda carta tiene su entrada. Los huérfanos en cualquiera de los dos sentidos se reportan como error.
3b. **Integridad de `seedId`**: único dentro de su tipo, presente en todo elemento referenciable, y sin reutilizar ninguno perteneciente a un elemento eliminado en versiones anteriores. Se mantiene un registro histórico de números retirados. Sin esta comprobación, un seed antiguo decodificaría unidades equivocadas sin dar error.
4. Toda carta táctica del apéndice §12.11 existe con su coste.
5. Todo texto `Localized` tiene `es` y `en` no vacíos.
6. Coherencia entre `supplyProfile` de la carta y los `supplyValue` de las composiciones.

El punto 3 es el que atrapa el fallo más probable de todo el proyecto: una unidad transcrita del PDF de cartas cuyo coste nunca se cruzó con el reglamento.
