import { createInterface } from "node:readline"
import { stdin, stdout } from "node:process"
import { pathToFileURL } from "node:url"

import {
  FirstActExplorer,
  type ExplorerFrame,
} from "./model/explorer.ts"

export type TerminalResult = Readonly<{
  output: string
  exit: boolean
  frame: ExplorerFrame
}>

const HELP = `Commands:
  tick                         resolve one complete shared Act
  was                          return to the recorded prior Act
  enter <face 0..5>            enter and rebase one complete child whole
  out                          return to the containing whole
  move <face 0..5>             move one Face at the current grain and Act
  depth <0..4>                 expand the recursive relation query
  relations                    list the 19 containing-grain relations
  select <x,y,z>               select one relation and explain why it exists
  ledger                       list the current tick ledger
  why                          show the selected causal explanation
  frame                        print the complete JSON frame
  status                       show Act, grain, address, field and frontier
  help                         show commands
  quit                         exit`

function status(frame: ExplorerFrame): string {
  return [
    `Act ${frame.observer.act}`,
    `grain ${frame.observer.relativeGrain}`,
    `address ${frame.observer.spatialAddress}`,
    `whole ${frame.observer.relativeWholePath.join(" / ") || "observer origin"}`,
    `WAS ${frame.chronology.was.length}`,
    `IS ${frame.chronology.is.length}`,
    `query ${frame.recursiveQuery.eventCount} events / `
      + `${frame.recursiveQuery.relationCount} relations / `
      + `${frame.recursiveQuery.frontierCount} expandable frontier`,
  ].join(" · ")
}

function relationList(frame: ExplorerFrame): string {
  return frame.wholeProjection.entries
    .map(
      (entry) =>
        `${entry.normalizedAddress.padStart(7)}  `
        + `${String(entry.arrivalCount).padStart(2)} arrivals  ${entry.result}`,
    )
    .join("\n")
}

function ledgerList(frame: ExplorerFrame): string {
  if (!frame.currentLedger) return "No tick ledger exists before the first resolution."
  return frame.currentLedger.entries
    .map(
      (entry) =>
        `${entry.address.padStart(9)}  `
        + `${String(entry.arrivalCount).padStart(2)} arrivals  `
        + `WAS ${entry.wasDifferent ? "DIFFERENT" : "SAME"}  `
        + `→ ${entry.result}`,
    )
    .join("\n")
}

function why(frame: ExplorerFrame): string {
  const explanation = frame.explanation
  if (!explanation) return "Select a projection relation first."
  return [
    explanation.title,
    `result: ${explanation.result}`,
    `status: ${explanation.status}`,
    `ancestry: ${explanation.ancestryStatuses.join(" → ")}`,
    `external comparison: ${
      explanation.externalComparisonAllowed ? "ALLOWED" : "BLOCKED"
    }`,
    ...explanation.because.map((reason) => `because: ${reason}`),
  ].join("\n")
}

function numberArgument(value: string | undefined, command: string): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${command} requires an integer`)
  }
  return result
}

export function executeCommand(
  explorer: FirstActExplorer,
  input: string,
): TerminalResult {
  const [command = "", argument] = input.trim().split(/\s+/, 2)
  let frame = explorer.frame()
  let output: string
  let exit = false

  try {
    switch (command.toLowerCase()) {
      case "":
      case "status":
        output = status(frame)
        break
      case "tick":
        frame = explorer.resolveOneTick()
        output = status(frame)
        break
      case "was":
        frame = explorer.returnToWas()
        output = status(frame)
        break
      case "enter":
        frame = explorer.enterWhole(numberArgument(argument, "enter"))
        output = status(frame)
        break
      case "out":
        frame = explorer.returnOutward()
        output = status(frame)
        break
      case "move":
        frame = explorer.moveSpatially(numberArgument(argument, "move"))
        output = status(frame)
        break
      case "depth":
        frame = explorer.setQueryDepth(numberArgument(argument, "depth"))
        output = status(frame)
        break
      case "relations":
        output = relationList(frame)
        break
      case "select":
        if (!argument) throw new Error("select requires x,y,z")
        frame = explorer.selectProjectionRelation(argument)
        output = why(frame)
        break
      case "ledger":
        output = ledgerList(frame)
        break
      case "why":
        output = why(frame)
        break
      case "frame":
        output = JSON.stringify(frame, null, 2)
        break
      case "help":
        output = HELP
        break
      case "quit":
      case "exit":
        output = "First Act explorer closed."
        exit = true
        break
      default:
        output = `Unknown command: ${command}\n\n${HELP}`
    }
  } catch (error) {
    output = `Error: ${error instanceof Error ? error.message : String(error)}`
  }

  return Object.freeze({ output, exit, frame })
}

export function main(): void {
  const explorer = new FirstActExplorer()
  const terminal = createInterface({
    input: stdin,
    output: stdout,
    prompt: "first-act> ",
  })
  stdout.write(
    "FIRST ACT — interactive Difference / Resolution explorer\n"
    + "Type help for commands. Finite frontiers remain expandable.\n\n",
  )
  stdout.write(`${status(explorer.frame())}\n`)
  terminal.prompt()
  terminal.on("line", (line) => {
    const result = executeCommand(explorer, line)
    stdout.write(`${result.output}\n`)
    if (result.exit) terminal.close()
    else terminal.prompt()
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
