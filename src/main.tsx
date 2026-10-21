import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
// Font bundled with the app (not Google Fonts) so it's there on the first offline open.
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/700.css';
import '@fontsource/tajawal/800.css';
import './styles.css';

registerSW({ immediate: true });

// Ask the browser not to evict our IndexedDB under storage pressure. Chrome
// grants this silently for installed/engaged sites; Safari ignores it, which
// is why the app also nags about installing and backing up.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
