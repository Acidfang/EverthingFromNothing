import { CANONICAL_SEED } from "./canonicalSeed"
import { BINARY_MODEL, WHOLE_INVARIANT } from "./binaryRelationships"
import { COMMUNICATION_INVARIANT } from "./communication"
import { THREE_TETRAHEDRON_DRAWING } from "./three-tetrahedron-drawing"

export const LIFE_LOGIC_BINDING = Object.freeze({
  root: CANONICAL_SEED.zero,
  temporalRoles: CANONICAL_SEED.temporalRoles,
  transition: CANONICAL_SEED.transition,
  binaryRelations: BINARY_MODEL,
  whole: WHOLE_INVARIANT,
  communication: COMMUNICATION_INVARIANT,
  threeTetrahedronPresentation: THREE_TETRAHEDRON_DRAWING,
  method: Object.freeze(["FILTER","ISOLATE","RECONSTRUCT"] as const),
  recursiveGrain: true,
  sourceRetained: true,
  differenceCreatesFractureNotNewRoot: true,
  fractureReturnsToContainingWhole: true,
  nextIsAvailableNotEstablishedUntilAct: true,
  receiptReturnsToProducingAddress: true,
} as const)

export const COMPLETION_RELATION = Object.freeze({
  protocol: "DCA-ADDRESSED-FRACTURE-COMPLETION/1",
  root: LIFE_LOGIC_BINDING.root,
  source: "EXISTING_STATED_ADDRESSES",
  lifeLogic: LIFE_LOGIC_BINDING,
  invariant: "INTENT != QUEUED != EXECUTED != VERIFIED",
  relation: "STATED_ADDRESS -> DIFFERENCE/FRACTURE -> EXISTING_OWNER -> ACT -> RETURNED_EVIDENCE -> RECEIPT_ADDRESS",
  boundary: "This projection does not create a new Root, collapse WAS into IS, infer recipient feedback, or permanently finish the evolving mechanism.",
} as const)

export type CompletionState = "RETAINED"|"QUEUED"|"EXECUTED"|"VERIFIED"|"BLOCKED"|"UNRESOLVED"

export type FractureReceipt = Readonly<{
  address:string
  sourceAddress:string
  owner:string
  state:CompletionState
  evidence:readonly string[]
  blockers:readonly string[]
  unfinished:readonly string[]
}>

export const COMPLETION_FRACTURES = Object.freeze([
  Object.freeze({id:"TWO_ANSWER_LEARNING",source:["src/model/communication.ts","src/model/fieldLedger.ts"],requires:["ANSWER_A_ADDRESS","ANSWER_B_ADDRESS","DIFFERENCE","DERIVED_LEARNING_RETURN_TO_BOTH","RECOVERY_SAME_RELATION"]}),
  Object.freeze({id:"DURABLE_LEDGER_RECOVERY",source:["src/model/fieldLedger.ts"],requires:["WRITE_RECEIPT","RELOAD_OR_RESTART","SAME_OCCURRENCE_ADDRESS","DURABLE_SEND_RECEIPT","NO_DUPLICATE_SEND"]}),
  Object.freeze({id:"GUIDED_HELPFULNESS",source:["src/model/communication.ts"],requires:["CURRENT_INTENT","EVIDENCE","PROPOSED_NEXT_NOT_PERFORMED_NEXT","CORRECTION_WITHOUT_SOURCE_MUTATION"]}),
  Object.freeze({id:"RECIPIENT_FEEDBACK",source:["src/model/communication.ts"],requires:["VISIBLE_OUTPUT","RECIPIENT_RESPONSE_RECEIPT","FEEDBACK_OCCURRENCE_ADDRESS","CORRECTION_AS_NEW_DIFFERENCE"]}),
  Object.freeze({id:"VISIBLE_LIVE_STATUS",source:["src/model/communication.ts","src/model/fieldLedger.ts"],requires:["CURRENT_STATE","QUEUED_EXECUTED_VERIFIED_BLOCKED_DISTINCT","LAST_RECEIPT","VISIBLE_BLOCKER"]}),
  Object.freeze({id:"FULLSCREEN_OVERLAY",source:["EXTERNAL_WINDOWS_OWNER"],requires:["NATIVE_DISPATCH","VISIBLE_OVERLAY","FULLSCREEN_TOPMOST_CLICKTHROUGH_AS_SELECTED","POST_ACT_NATIVE_READBACK","CLAMP_CONFLICT_TIMEOUT_RECEIPT"]}),
] as const)

export function canVerify(receipt:FractureReceipt):boolean{
  return receipt.state==="VERIFIED" && receipt.evidence.length>0
}

export function normalizeCompletionState(state:CompletionState,evidence:readonly string[]):CompletionState{
  if(state==="VERIFIED" && evidence.length===0)return "EXECUTED"
  return state
}

export const COMPLETION_BOUNDARIES = Object.freeze([
  "QUEUED_ONLY cannot resolve to VERIFIED without native/recipient evidence appropriate to that fracture.",
  "Static GitHub Pages may display retained status but cannot verify a native Windows overlay.",
  "Send or delivery alone is not recipient feedback.",
  "Recovery is not verified until the same addressed occurrence survives the selected durability boundary without duplicate send.",
  "Every fracture remains a view into the same addressed field; no fracture is an independent subsystem.",
] as const)
