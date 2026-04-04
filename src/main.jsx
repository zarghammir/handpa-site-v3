import React from "react"
import ReactDOM from "react-dom/client"
import { HelmetProvider } from "react-helmet-async"
import { ToastProvider } from "./hooks/useToast.jsx"
import { ToastContainer } from "./components/ui/Toast"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <ToastProvider>
        <App />
        <ToastContainer />
      </ToastProvider>
    </HelmetProvider>
  </React.StrictMode>
)
