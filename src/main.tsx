import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { EIModelLayer } from "./EIModelLayer.tsx"
import { MobileFracture } from "./MobileFracture.tsx"
import "./styles.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get('view')==='fracture'?<MobileFracture/>:<EIModelLayer open />}
  </StrictMode>,
)
