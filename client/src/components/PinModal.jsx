import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Key, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function PinModal({ isOpen, onClose }) {
  const { verifyPin, setPin } = useAuth();
  const [mode, setMode] = useState('unlock'); // 'unlock' | 'change'
  const [pin, setPinInput] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (pin.length !== 4) {
      setError('PIN must be 4 digits.');
      return;
    }

    const ok = await verifyPin(pin);
    if (ok) {
      onClose();
    } else {
      setError('Incorrect secret PIN.');
    }
  };

  const handleChangePinSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (pin.length !== 4) {
      setError('New PIN must be 4 digits.');
      return;
    }

    const res = await setPin(pin);
    if (res.success) {
      setSuccessMsg('Secret PIN updated successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1500);
    } else {
      setError(res.message || 'Failed to update PIN.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-sm glass-panel p-6 rounded-3xl border border-gray-800 shadow-2xl text-center">
        
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
          <Key className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-white mb-1">
          {mode === 'unlock' ? 'Vault Authentication' : 'Change Secret PIN'}
        </h3>
        <p className="text-xs text-gray-400 mb-6">
          {mode === 'unlock' ? 'Enter your 4-digit PIN to access Personal Data' : 'Set a new 4-digit PIN for vault authorization'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5 justify-center">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5 justify-center">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        <form onSubmit={mode === 'unlock' ? handleUnlockSubmit : handleChangePinSubmit} className="space-y-4">
          <input
            type="password"
            maxLength={4}
            autoFocus
            value={pin}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            className="w-full py-3.5 px-4 text-center font-mono text-2xl tracking-[0.5em] glass-input rounded-2xl text-cyan-400 focus:outline-none"
          />

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-glow-cyan hover:opacity-95 transition-all text-sm"
          >
            {mode === 'unlock' ? 'Unlock Vault' : 'Save New PIN'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-800/80 flex justify-between text-xs text-gray-400">
          <button
            onClick={() => { setMode(mode === 'unlock' ? 'change' : 'unlock'); setPinInput(''); setError(''); }}
            className="hover:text-cyan-400 transition-colors"
          >
            {mode === 'unlock' ? 'Update Secret PIN' : 'Back to Unlock'}
          </button>
          <button onClick={onClose} className="hover:text-gray-200 transition-colors">
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
