import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmationModal({
  isOpen,
  title = "Confirmation Required",
  message = "Are you sure you want to continue?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = true,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md glass-panel p-6 rounded-3xl border border-gray-800 shadow-2xl relative text-center">
        
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
          isDanger
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          <AlertTriangle className="w-7 h-7" />
        </div>

        {/* Modal Header */}
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        
        {/* Message */}
        <p className="text-sm text-gray-300 mb-6 px-2">
          {message}
        </p>
        
        <p className="text-xs font-mono text-cyan-400 mb-6 bg-cyan-500/10 py-1.5 px-3 rounded-full inline-block border border-cyan-500/20">
          “Are you sure you want to continue?”
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold glass-card text-gray-300 hover:text-white transition-all flex-1"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all flex-1 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-glow-cyan'
            }`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
}
