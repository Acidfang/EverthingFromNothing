import { FirstActExplorer, type ExplorerFrame } from "./model/explorer.ts"
import { pathToFileURL } from "node:url"

export type CliOptions = Readonly<{
  ticks: number
  inward: readonly number[]
  queryDepth: number
  selectProjection: string | null
  compact: boolean
}>

function integer(value: string | undefined, name: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be a safe integer`)
  return parsed
}

export function parseArguments(arguments_: readonly string[]): CliOptions {
  let ticks = 0
  let queryDepth = 1
  let selectProjection: string | null = null
  let compact = false
  const inward: number[] = []
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument === "--ticks") {
      ticks = integer(arguments_[++index], "--ticks")
      if (ticks < 0 || ticks > 64) throw new Error("--ticks must be between 0 and 64")
    } else if (argument === "--enter-face") {
      const face = integer(arguments_[++index], "--enter-face")
      if (face < 0 || face > 5) throw new Error("--enter-face must be between 0 and 5")
      inward.push(face)
    } else if (argument === "--depth") {
      queryDepth = integer(arguments_[++index], "--depth")
      if (queryDepth < 0 || queryDepth > 4) throw new Error("--depth must be between 0 and 4")
    } else if (argument === "--select-projection") {
      selectProjection = arguments_[++index] ?? null
      if (!selectProjection) throw new Error("--select-projection requires x,y,z")
    } else if (argument === "--compact") {
      compact = true
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  return Object.freeze({
    ticks,
    inward: Object.freeze(inward),
    queryDepth,
    selectProjection,
    compact,
  })
}

export function buildFrame(options: CliOptions): ExplorerFrame {
  const explorer = new FirstActExplorer()
  for (let tick = 0; tick < options.ticks; tick += 1) explorer.resolveOneTick()
  for (const face of options.inward) explorer.enterWhole(face)
  explorer.setQueryDepth(options.queryDepth)
  if (options.selectProjection) {
    explorer.selectProjectionRelation(options.selectProjection)
  }
  return explorer.frame()
}

export function main(arguments_: readonly string[] = process.argv.slice(2)): void {
  const options = parseArguments(arguments_)
  const frame = buildFrame(options)
  process.stdout.write(`${JSON.stringify(frame, null, options.compact ? 0 : 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    process.stderr.write(
      `first-act: ${error instanceof Error ? error.message : String(error)}\n`,
    )
    process.exitCode = 1
  }
}
