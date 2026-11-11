import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './style.css';

const root = document.getElementById('root');
if (!root) throw new Error('缺少应用挂载点');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
