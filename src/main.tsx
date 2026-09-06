import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const el = document.getElementById('root');
if (!el) throw new Error('#root not found');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the service worker in production only, so dev never serves a
// cached bundle back at you.
declare const __ARTIFACT__: boolean;

if ('serviceWorker' in navigator && import.meta.env.PROD && !__ARTIFACT__) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is a progressive enhancement; ignore failures */
    });
  });
}
