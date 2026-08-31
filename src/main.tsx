import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './ui/styles/app.css';

/**
 * The shipped bundle is an INLINE CLASSIC script, which does not defer the way a
 * module script does — it can run before <body> has been parsed. Waiting for the
 * document means the entry point does not depend on where the tag ends up.
 *
 * A missing root is shouted about rather than ignored: a silent no-op here is a
 * blank white page in front of a class, with nothing to explain it.
 */
function boot(): void {
  const container = document.getElementById('root');
  if (!container) {
    document.body.innerHTML =
      '<p style="font:16px system-ui;padding:2rem">Library Reward could not start: the page is missing its content area. Try downloading the app file again.</p>';
    return;
  }
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

/**
 * Offline support exists only in the hosted build. Registering a service worker
 * from file:// is not possible, and attempting it would throw on the Chromebook
 * where this app normally runs.
 */
function registerServiceWorker(): void {
  if (!__HOSTED_BUILD__) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline support is a bonus; the app works without it.
    });
  });
}

registerServiceWorker();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
