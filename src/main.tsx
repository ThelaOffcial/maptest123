import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LoginGate } from './components/LoginGate.tsx';
import './index.css';

// Intercept and prevent unhandled rejection/error bubbles from Google Maps internal telemetry & POI RPCs
window.addEventListener('unhandledrejection', (event) => {
  const reasonStr = String(event.reason?.message || event.reason || '');
  if (
    reasonStr.includes('InitMapsJwt') ||
    reasonStr.includes('MapsJsInternalService') ||
    reasonStr.includes('gmp-internal-use')
  ) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  const msg = String(event.message || '');
  if (
    msg.includes('InitMapsJwt') ||
    msg.includes('MapsJsInternalService') ||
    msg.includes('gmp-internal-use')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoginGate>
      <App />
    </LoginGate>
  </StrictMode>,
);
