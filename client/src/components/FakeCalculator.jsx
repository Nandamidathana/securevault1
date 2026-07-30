import React, { useState } from 'react';
import { Lock, Eye, RefreshCw } from 'lucide-react';

export default function FakeCalculator({ onUnlockVault, onGoToLogin }) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [lastOp, setLastOp] = useState(null);

  const handleDigit = (digit) => {
    if (display === '0' || display === 'Error') {
      setDisplay(digit);
    } else {
      if (display.length < 12) {
        setDisplay(display + digit);
      }
    }
  };

  const handleOperator = (op) => {
    setEquation(display + ' ' + op + ' ');
    setLastOp(op);
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setLastOp(null);
  };

  const handleEquals = async () => {
    // Secret Unlock Check: Is the entered display string a 4-digit PIN?
    const cleanDisplay = display.trim();

    if (cleanDisplay.length === 4 && /^\d{4}$/.test(cleanDisplay)) {
      // Attempt secret PIN unlock
      const isSuccess = await onUnlockVault(cleanDisplay);
      if (isSuccess) {
        return; // Vault dashboard will open!
      }
    }

    // Wrong PIN or regular calculation: Perform standard realistic calculation
    try {
      if (!equation && !lastOp) {
        return;
      }
      const num1 = parseFloat(equation);
      const num2 = parseFloat(display);
      let result = 0;

      if (lastOp === '+') result = num1 + num2;
      else if (lastOp === '-') result = num1 - num2;
      else if (lastOp === '×' || lastOp === '*') result = num1 * num2;
      else if (lastOp === '÷' || lastOp === '/') result = num2 !== 0 ? num1 / num2 : 0;
      else result = num2;

      setDisplay(String(Number(result.toFixed(6))));
      setEquation('');
    } catch (err) {
      setDisplay('0');
      setEquation('');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center p-4 selection:bg-none">
      <div className="w-full max-w-sm glass-panel p-6 rounded-3xl shadow-2xl border border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Scientific Calculator
          </div>
          <button
            onClick={onGoToLogin}
            className="text-xs text-gray-400 hover:text-cyan-400 flex items-center gap-1 transition-colors px-2 py-1 rounded bg-gray-800/40"
            title="Go to Direct Website Login"
          >
            <Lock className="w-3 h-3" /> Login Direct
          </button>
        </div>

        {/* Display Screen */}
        <div className="bg-[#080B11] p-5 rounded-2xl mb-6 text-right border border-gray-800/80 shadow-inner">
          <div className="text-xs font-mono text-gray-500 min-h-[1.25rem] mb-1 overflow-hidden">
            {equation}
          </div>
          <div className="text-3xl font-mono text-white tracking-wider truncate">
            {display}
          </div>
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-3">
          <button onClick={handleClear} className="py-4 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 rounded-2xl font-semibold text-lg transition-all active:scale-95">
            AC
          </button>
          <button onClick={() => setDisplay(prev => String(parseFloat(prev) * -1))} className="py-4 bg-gray-800/70 text-gray-300 hover:bg-gray-700 rounded-2xl font-semibold text-lg transition-all active:scale-95">
            +/-
          </button>
          <button onClick={() => setDisplay(prev => String(parseFloat(prev) / 100))} className="py-4 bg-gray-800/70 text-gray-300 hover:bg-gray-700 rounded-2xl font-semibold text-lg transition-all active:scale-95">
            %
          </button>
          <button onClick={() => handleOperator('÷')} className="py-4 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-2xl font-semibold text-xl transition-all active:scale-95">
            ÷
          </button>

          <button onClick={() => handleDigit('7')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">7</button>
          <button onClick={() => handleDigit('8')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">8</button>
          <button onClick={() => handleDigit('9')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">9</button>
          <button onClick={() => handleOperator('×')} className="py-4 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-2xl font-semibold text-xl transition-all active:scale-95">×</button>

          <button onClick={() => handleDigit('4')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">4</button>
          <button onClick={() => handleDigit('5')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">5</button>
          <button onClick={() => handleDigit('6')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">6</button>
          <button onClick={() => handleOperator('-')} className="py-4 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-2xl font-semibold text-xl transition-all active:scale-95">-</button>

          <button onClick={() => handleDigit('1')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">1</button>
          <button onClick={() => handleDigit('2')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">2</button>
          <button onClick={() => handleDigit('3')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">3</button>
          <button onClick={() => handleOperator('+')} className="py-4 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-2xl font-semibold text-xl transition-all active:scale-95">+</button>

          <button onClick={() => handleDigit('0')} className="col-span-2 py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">0</button>
          <button onClick={() => !display.includes('.') && setDisplay(display + '.')} className="py-4 bg-gray-800/50 text-white hover:bg-gray-700/60 rounded-2xl font-medium text-xl transition-all active:scale-95">.</button>
          
          {/* EQUALS BUTTON (Triggers secret PIN unlock) */}
          <button onClick={handleEquals} className="py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 rounded-2xl font-bold text-2xl transition-all active:scale-95 shadow-glow-cyan">
            =
          </button>
        </div>

        {/* Footer Hint */}
        <p className="mt-6 text-center text-xs text-gray-400/80">
          Standard Calculator App
        </p>
      </div>
    </div>
  );
}
