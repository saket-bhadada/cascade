import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import ControlTower from './ControlTower.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Toaster position="top-right" reverseOrder={false} toastOptions={{ duration: 5000, style: { background: '#1e293b', color: '#e2e4f0', border: '1px solid rgba(255,255,255,0.1)' } }} />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/control-tower" element={<ControlTower />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
