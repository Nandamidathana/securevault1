import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VaultProvider } from './context/VaultContext';
import LoginPage from './pages/LoginPage';
import VaultDashboard from './components/VaultDashboard';
import Files from './pages/Files';

function AppRoutes() {
  const { token, isUnlocked } = useAuth();

  if (!token) {
    return <LoginPage />;
  }

  if (!isUnlocked) {
    return <LoginPage isLocked={true} />;
  }

  return (
    <VaultProvider>
      <Routes>
        <Route path="/" element={<VaultDashboard />} />
        <Route path="/files" element={<Files />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </VaultProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
