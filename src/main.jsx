// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import './styles/App.css'
import { initParticles } from './utils/particles.js'

// Initialize particles once the library is loaded
function tryInitParticles(retries = 20) {
  if (typeof window.particlesJS === 'function') {
    initParticles();
  } else if (retries > 0) {
    setTimeout(() => tryInitParticles(retries - 1), 200);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => tryInitParticles());
} else {
  tryInitParticles();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)