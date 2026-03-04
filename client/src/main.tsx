import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { store } from './store/store';
import './index.css';

// Apply saved theme on initial load (before React renders)
(() => {
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (saved === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) document.documentElement.classList.add('dark');
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              background: '#1e293b',
              color: '#f8fafc',
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
