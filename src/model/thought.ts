export type ThoughtRecord = Readonly<{
  content: string
  firstResolvedAt: number
  lastResolvedAt: number
  resolutions: number
}>

export type ThoughtState = Readonly<{
  moment: number
  records: readonly ThoughtRecord[]
}>

export type ThoughtResolution = Readonly<{
  was: ThoughtState
  is: ThoughtState
  content: string
  wasPresent: boolean
  isPresent: true
  firstDifference: boolean
  recurrence: number
}>

export function emptyThoughtState(): ThoughtState {
  return Object.freeze({ moment: 0, records: Object.freeze([]) })
}

export function resolveThought(
  state: ThoughtState,
  requestedContent: string,
): ThoughtResolution {
  const content = requestedContent.trim().replace(/\s+/g, " ")
  if (content.length === 0) throw new Error("A thought requires a represented Difference")
  const existing = state.records.find((record) => record.content === content)
  const nextMoment = state.moment + 1
  const updated: ThoughtRecord = Object.freeze({
    content,
    firstResolvedAt: existing?.firstResolvedAt ?? nextMoment,
    lastResolvedAt: nextMoment,
    resolutions: (existing?.resolutions ?? 0) + 1,
  })
  const records = existing
    ? state.records.map((record) => record.content === content ? updated : record)
    : [...state.records, updated]
  const is = Object.freeze({
    moment: nextMoment,
    records: Object.freeze(records),
  })
  return Object.freeze({
    was: state,
    is,
    content,
    wasPresent: existing !== undefined,
    isPresent: true,
    firstDifference: existing === undefined,
    recurrence: updated.resolutions,
  })
}
