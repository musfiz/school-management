/**
 * Engine-behavior resolution for dynamic exam term types.
 *
 * `exam_terms.termType` stores a master `code` from `exam_term_types`
 * (e.g. HALF_YEARLY); the 3 engine behaviors (SUB_EXAM_CT | TERMINAL |
 * CUMULATIVE_ANNUAL) drive all calculation logic (CC-06 / CC-11). Custom
 * types declare which behavior they inherit, so adding "Model Test" never
 * requires a code change.
 *
 * Legacy rows created before the master table keep working: an unknown code
 * that matches a legacy behavior falls back to itself; anything else throws.
 */
export const ENGINE_BEHAVIORS = ['SUB_EXAM_CT', 'TERMINAL', 'CUMULATIVE_ANNUAL'] as const;
export type EngineBehavior = (typeof ENGINE_BEHAVIORS)[number];

export function isEngineBehavior(value: string): value is EngineBehavior {
  return (ENGINE_BEHAVIORS as readonly string[]).includes(value);
}

export function resolveEngineBehavior(
  termTypeCode: string,
  master: { code: string; engineBehavior: string } | null | undefined,
): EngineBehavior {
  if (master) {
    if (!isEngineBehavior(master.engineBehavior)) {
      throw new Error(`Term type "${master.code}" has unknown engine behavior "${master.engineBehavior}"`);
    }
    return master.engineBehavior;
  }
  if (isEngineBehavior(termTypeCode)) return termTypeCode;
  throw new Error(
    `Unknown term type "${termTypeCode}" — create it under Sessions & Classes → Term Types first`,
  );
}
