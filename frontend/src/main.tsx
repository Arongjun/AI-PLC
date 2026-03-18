import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Polyfill for crypto.randomUUID in non-secure contexts (http)
if (!window.crypto.randomUUID) {
  window.crypto.randomUUID = () => {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
      (
        +c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
      ).toString(16)
    ) as any;
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
