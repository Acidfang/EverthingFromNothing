import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.tsx"
import { InfinityApp } from "./InfinityApp.tsx"
import "./styles.css"

const isInfinity = /\/infinity\/?$/.test(window.location.pathname)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isInfinity ? <InfinityApp /> : <App />}
  </StrictMode>,
)
