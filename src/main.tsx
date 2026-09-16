import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { idbStore } from './storage/save';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={idbStore()} />
  </StrictMode>,
);
