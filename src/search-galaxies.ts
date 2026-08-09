import {
  searchGeneratedGalaxyCandidates,
  resolveGalaxyCandidateInward,
  traceGalaxyCandidateLineage,
} from "./model/galaxy-search.ts"

const maxLevel = Number(process.argv[2] ?? 8)
const result = searchGeneratedGalaxyCandidates(maxLevel)
const lineage = traceGalaxyCandidateLineage(64)
const inward = resolveGalaxyCandidateInward(maxLevel, 4)

console.log(JSON.stringify({ result, lineage, inward }, null, 2))
