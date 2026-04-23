import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/ui/tokens.css'
import './index.css'
import './styles/animations.css'
import './tutorial/TutorialStyles.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
