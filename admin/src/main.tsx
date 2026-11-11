import './legacyStorage'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { startUpdateChecks, UpdateOnNavigate } from './autoUpdate'

startUpdateChecks()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UpdateOnNavigate />
      <App />
    </BrowserRouter>
  </StrictMode>,
)
