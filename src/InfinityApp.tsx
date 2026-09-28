import { CANONICAL_SEED, OPEN_DIFFERENCES } from "./model/canonicalSeed"
import "./infinity.css"

export function InfinityApp(){
  const seed=CANONICAL_SEED
  return <main className="infinity-map">
    <section className="infinity-field" aria-label="Notodus canonical seed">
      <div className="infinity-readout" aria-live="polite">
        <div>FAMILY/NOTODUS · CANONICAL SEED · ZERO</div>
        <div>{seed.tetrahedrons} tetrahedrons · WAS / IS / NEXT · PROCEED · sequential follow/lock · twist + turn</div>
        <div>address + return required · Difference remains open · same operation at every address</div>
        <div>OPEN DIFFERENCES: {OPEN_DIFFERENCES.join(" · ")}</div>
      </div>
    </section>
  </main>
}
