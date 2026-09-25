import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { idbStore } from './storage/save';
import './ui/styles.css';

// A new deploy takes effect on the next load; the Player is never asked to reload mid-fight.
registerSW();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={idbStore()} />
  </StrictMode>,
);
