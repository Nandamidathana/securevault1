import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VaultProvider } from './context/VaultContext';

// React.lazy for code-splitting and frontend performance optimization
const LoginPage = lazy(() => import('./pages/LoginPage'));
const VaultDashboard = lazy(() => import('./components/VaultDashboard'));
const Files = lazy(() => import('./pages/Files'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));

// Loading Fallback Component
function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
      <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
      <p className="text-sm font-medium tracking-wide text-slate-300">Loading SecureVault...</p>
    </div>
  );
}

function AppRoutes() {
  const { token, isUnlocked } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Verification Route accessible publicly */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/api/auth/verify-email" element={<VerifyEmail />} />

        {/* Authenticated Vault Dashboard */}
        {token && isUnlocked ? (
          <Route
            path="/*"
            element={
              <VaultProvider>
                <Routes>
                  <Route path="/" element={<VaultDashboard />} />
                  <Route path="/files" element={<Files />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </VaultProvider>
            }
          />
        ) : (
          <Route
            path="*"
            element={<LoginPage isLocked={Boolean(token && !isUnlocked)} />}
          />
        )}
      </Routes>
    </Suspense>
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
