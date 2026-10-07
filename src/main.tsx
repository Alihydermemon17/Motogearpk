import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { CustomerStateProvider } from './app/CustomerState';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><CustomerStateProvider><App /></CustomerStateProvider></StrictMode>,
);
