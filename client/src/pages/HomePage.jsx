import React from 'react';
import { useAuth } from '../context/AuthContext';
import VaultDashboard from '../components/VaultDashboard';
import FakeCalculator from '../components/FakeCalculator';

export default function HomePage() {
  const { isUnlocked, stealthMode, verifyPin, toggleStealth } = useAuth();

  // If Stealth Disguise Mode is active and vault is locked, show Calculator
  if (stealthMode && !isUnlocked) {
    return (
      <FakeCalculator
        onUnlockVault={verifyPin}
        onGoToLogin={() => toggleStealth(false)}
      />
    );
  }

  // Regular direct website mode -> Vault Dashboard!
  return <VaultDashboard />;
}
