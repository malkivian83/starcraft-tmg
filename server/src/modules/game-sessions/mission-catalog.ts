import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { HttpError } from '../../lib/errors.js';

const localizedSchema = z.object({ es: z.string(), en: z.string() });
const missionSchema = z.object({
  id: z.string(),
  name: z.string(),
  scale: z.enum(['skirmish', 'standard', 'grand_offensive']),
  startingSupply: z.number().int().nonnegative(),
  supplyEscalation: z.number().int().nonnegative(),
  gameLength: z.number().int().positive(),
  missionParameters: localizedSchema,
  scoringConditions: localizedSchema,
  additionalConditions: localizedSchema,
  instantWinLead: z.number().int().positive().nullable(),
});

type Mission = z.infer<typeof missionSchema>;
let missions: Map<string, Mission> | null = null;

function loadMissions(): Map<string, Mission> {
  if (missions) return missions;
  const file = resolve(process.cwd(), 'src/catalog/data/scenarios.json');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { missionCards?: unknown };
  const parsed = z.array(missionSchema).parse(raw.missionCards);
  missions = new Map(parsed.map((mission) => [mission.id, mission]));
  return missions;
}

export function missionById(id: string): Mission {
  const mission = loadMissions().get(id);
  if (!mission) throw new HttpError(400, 'INVALID_MISSION', 'La misión seleccionada no existe.');
  return mission;
}
