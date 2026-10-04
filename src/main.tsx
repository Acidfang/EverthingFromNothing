import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { EIModelLayer } from "./EIModelLayer.tsx"
import "./styles.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EIModelLayer open />
  </StrictMode>,
)
