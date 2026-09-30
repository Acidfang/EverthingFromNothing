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
  const canDo = clean(intake.ability)
    ? `You can do: ${clean(intake.ability)}`
    : "What you can safely do remains open."
  const selectedHelp = clean(intake.help)
    ? clean(intake.help)
    : "No paid work selected. Guidance remains free."
  return Object.freeze({
    address: fixAddress(intake),
    intake: Object.freeze({ ...intake }),
    canDo,
    selectedHelp,
    guidancePrice: "FREE" as const,
    requestedWorkPrice: clean(intake.cost) || "QUOTE ONLY AFTER REQUEST" as const,
  })
}

