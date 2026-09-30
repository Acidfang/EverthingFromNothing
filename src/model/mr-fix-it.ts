export type MrFixItMode = "PUBLIC" | "ARRAY"

export type FixIntake = Readonly<{
  intent: string
  skill: string
  risk: string
  worries: string
  ability: string
  equipment: string
  cost: string
  help: string
}>

export const MR_FIX_IT_FLOW = Object.freeze([
  "INTENT",
  "SKILL",
  "RISK",
  "WORRIES",
  "ABILITY",
  "EQUIPMENT",
  "COST",
  "CAN_DO",
  "SELECTED_HELP",
] as const)

const clean = (value: string) => value.trim()

export function fixAddress(intake: FixIntake): string {
  const source = clean(intake.intent).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "open"
  return `PUBLIC/MR-FIX-IT/${source}`
}

export function deriveFixProjection(intake: FixIntake) {
  const reportedAbility = clean(intake.ability)
    ? `You said you can: ${clean(intake.ability)}`
    : "Your ability has not been established."
  const selectedHelp = clean(intake.help)
    ? clean(intake.help)
    : "No paid work selected. Guidance remains free."
  return Object.freeze({
    address: fixAddress(intake),
    intake: Object.freeze({ ...intake }),
    reportedAbility,
    selectedHelp,
    guidancePrice: "FREE" as const,
    statedBudget: clean(intake.cost) || "NOT PROVIDED",
    requestedWorkPrice: "UNRESOLVED — NO QUOTE PRODUCED" as const,
  })
}

