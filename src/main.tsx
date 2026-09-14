import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles.css';
import './profile.css';
import './refinement.css';
import './gameLaunchBridge';
import App from './App';
import { ProductionBoundary, RouteEffects } from './productionShell';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ProductionBoundary>
        <RouteEffects />
        <App />
      </ProductionBoundary>
    </HashRouter>
  </StrictMode>
);
