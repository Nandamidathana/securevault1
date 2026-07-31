import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { verifyEmailToken } = useAuth();

  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. Missing token.');
      return;
    }

    let isMounted = true;
    async function doVerify() {
      const res = await verifyEmailToken(token);
      if (isMounted) {
        if (res.success) {
          setStatus('success');
          setMessage(res.message || 'Your email address has been verified successfully!');
        } else {
          setStatus('error');
          setMessage(res.message || 'Verification failed or link expired.');
        }
      }
    }

    doVerify();

    return () => {
      isMounted = false;
    };
  }, [token, verifyEmailToken]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
        
        {/* Decorative Background Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            SecureVault
          </span>
        </div>

        {/* Status Spinner / Icon */}
        {status === 'verifying' && (
          <div className="py-8 flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Verifying Email...</h2>
            <p className="text-slate-400 text-sm">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">Email Verified!</h2>
            <p className="text-slate-300 text-sm mb-8 leading-relaxed">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Continue to Login</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 flex flex-col items-center">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-rose-400" />
            </div>
            <h2 className="text-2xl font-bold text-rose-400 mb-2">Verification Failed</h2>
            <p className="text-slate-300 text-sm mb-8 leading-relaxed">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3.5 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <span>Back to Login</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
