import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ToastStack from './components/ToastStack';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { startOfflineSync } from './lib/offlineSync';

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
});
startOfflineSync();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <ToastStack />
    </BrowserRouter>
  </React.StrictMode>
);
