import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminPortal from './AdminPortal.jsx';
import './styles.css';

const isAdminPath = window.location.pathname.endsWith('/admin') || new URLSearchParams(window.location.search).get('admin') === '1';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isAdminPath ? <AdminPortal /> : <App />}</React.StrictMode>
);
