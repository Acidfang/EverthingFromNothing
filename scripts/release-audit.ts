import { access, readFile } from "node:fs/promises"
import { resolve } from "node:path"

type AuditResult = Readonly<{
  requirement: string
  status: "PASS" | "FAIL"
  evidence: string
}>

const root = resolve(import.meta.dirname, "..")

async function exists(path: string): Promise<boolean> {
  try {
    await access(resolve(root, path))
    return true
  } catch {
    return false
  }
}

async function text(path: string): Promise<string> {
  return readFile(resolve(root, path), "utf8")
}

async function audit(): Promise<readonly AuditResult[]> {
  const packageJson = JSON.parse(await text("package.json"))
  const readme = await text("README.md")
  const limitations = await text("LIMITATIONS.md")
  const schema = JSON.parse(await text("schema/explorer-frame.schema.json"))
  return Object.freeze([
    {
      requirement: "Standalone specification",
      status: (await exists("SPEC.md")) && !readme.includes("../PUBLIC-ARTIFACT-SPEC")
        ? "PASS"
        : "FAIL",
      evidence: "SPEC.md exists and README does not require the private parent workspace.",
    },
    {
      requirement: "Bound public repository",
      status:
        packageJson.repository?.url
        === "https://github.com/Acidfang/EverthingFromNothing.git"
          ? "PASS"
          : "FAIL",
      evidence: "package.json points to Acidfang/EverthingFromNothing.",
    },
    {
      requirement: "Executable model tests",
      status: packageJson.scripts?.["test:model"] ? "PASS" : "FAIL",
      evidence: "package.json exposes test:model.",
    },
    {
      requirement: "Interactive terminal",
      status:
        packageJson.scripts?.explore && (await exists("src/terminal.ts"))
          ? "PASS"
          : "FAIL",
      evidence: "package.json exposes explore and src/terminal.ts exists.",
    },
    {
      requirement: "Public frame contract",
      status:
        schema.properties?.scene
        && schema.$defs?.explanation?.properties?.status?.const === "GENERATED"
          ? "PASS"
          : "FAIL",
      evidence: "JSON Schema declares scene and generated explanation status.",
    },
    {
      requirement: "Visible limitations",
      status:
        /does not\s+establish/.test(limitations)
        && /No generated level\s+is identified/.test(limitations)
          ? "PASS"
          : "FAIL",
      evidence: "LIMITATIONS.md rejects automatic physical identification.",
    },
    {
      requirement: "Contribution provenance discipline",
      status: await exists("CONTRIBUTING.md") ? "PASS" : "FAIL",
      evidence: "CONTRIBUTING.md exists.",
    },
    {
      requirement: "GitHub invariant workflow",
      status: await exists(".github/workflows/model.yml") ? "PASS" : "FAIL",
      evidence: ".github/workflows/model.yml exists.",
    },
    {
      requirement: "Graphical explorer",
      status:
        (await exists("src/App.tsx")) && Boolean(packageJson.scripts?.build)
          ? "PASS"
          : "FAIL",
      evidence: "Requires src/App.tsx and a production build script.",
    },
    {
      requirement: "Graphical accessibility and responsive verification",
      status: await exists("qa/verified.json") ? "PASS" : "FAIL",
      evidence: "Requires retained QA evidence after browser verification.",
    },
    {
      requirement: "Author-selected license",
      status: await exists("LICENSE") ? "PASS" : "FAIL",
      evidence: "Requires a LICENSE selected by the author.",
    },
  ] satisfies readonly AuditResult[])
}

const results = await audit()
for (const result of results) {
  process.stdout.write(
    `${result.status.padEnd(4)}  ${result.requirement}\n`
      + `      ${result.evidence}\n`,
  )
}
const failures = results.filter((result) => result.status === "FAIL")
process.stdout.write(
  `\n${results.length - failures.length}/${results.length} release checks pass.\n`,
)
if (failures.length) process.exitCode = 1
