import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './screens/App.jsx'
import { AuthProvider } from './auth.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

// Register the service worker (installable PWA + offline app shell). Production
// only — a SW under `vite dev` interferes with HMR. Best-effort; failures are ignored.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Google AdSense — opt-in network probe (see CLAUDE.md "Ads experiment").
// Inert unless VITE_ADSENSE_CLIENT is set; loads Google's real ad script from
// their CDN so we can observe whether the campus wifi proxy intercepts it,
// the same class of problem that forced the ML models to be self-hosted.
const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT
if (adsenseClient) {
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`
  document.head.appendChild(s)
}
