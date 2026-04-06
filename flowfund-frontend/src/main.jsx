import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// StrictMode double-mounts in dev; react-plaid-link removes its script on unmount and
// re-injects it, which triggers Plaid's "embedded more than once" warning.
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
