import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, Key, Eye, EyeOff, ArrowRight, CheckCircle2, Zap, ArrowLeft, HelpCircle } from 'lucide-react';
import axios from 'axios';

export default function LoginPage({ isLocked = false }) {
  const { login, quickUnlockPin, signup, logout, verifyPin, loading, user } = useAuth();
  
  const savedEmail = localStorage.getItem('securevault_last_email') || user?.email || '';

  // Primary Tabs: 'login' | 'register' | 'forgot'
  const [mainTab, setMainTab] = useState('login');
  
  // Login Sub-Mode: 'password' | 'pin' - Default to 'pin' if saved email exists
  const [loginMode, setLoginMode] = useState(savedEmail ? 'pin' : 'password');
  
  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // OTP Reset states
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [forgotType, setForgotType] = useState('password'); // 'password' | 'pin'
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Unlock handler when vault is locked (token exists, isUnlocked is false)
  const handleLockedUnlock = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!pin || pin.length !== 4) {
      setError('Please enter your 4-digit PIN.');
      return;
    }
    const ok = await verifyPin(pin);
    if (!ok) {
      setError('Incorrect 4-digit PIN. Please try again.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (mainTab === 'login') {
      if (loginMode === 'password') {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.message);
        }
      } else {
        if (!pin || pin.length !== 4) {
          setError('Please enter your 4-digit Smart PIN.');
          return;
        }
        const res = await quickUnlockPin(email, pin);
        if (!res.success) {
          setError(res.message);
        }
      }
    } else if (mainTab === 'register') {
      if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
        setError('Smart PIN must be exactly 4 numeric digits.');
        return;
      }
      const res = await signup(email, password, pin || '0000');
      if (!res.success) {
        setError(res.message);
      }
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      if (res.data.success) {
        setOtpSent(true);
        setMessage(res.data.message);
        if (res.data.dev_otp) {
          setMessage(`OTP sent! (Dev Mode Code: ${res.data.dev_otp})`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await axios.post('/api/auth/reset-password', { email, otp, newPassword });
      if (res.data.success) {
        setMessage(res.data.message);
        setTimeout(() => {
          setMainTab('login');
          setOtpSent(false);
          setOtp('');
          setNewPassword('');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  const openForgot = (type) => {
    setForgotType(type);
    setMainTab('forgot');
    setError('');
    setMessage('');
  };

  // ----------------------------------------------------
  // VAULT LOCKED VIEW (Token present, requires PIN to unlock)
  // ----------------------------------------------------
  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        
        {/* Ambient background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Main Lock Container */}
        <div className="w-full max-w-md z-10">
          
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-glow-cyan mb-4">
              <Lock className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-400">
              Vault Locked
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Enter your 4-digit Smart PIN to unlock your vault
            </p>
          </div>

          <div className="glass-panel p-8 rounded-3xl shadow-2xl border border-gray-800/80">
            {/* Account Chip */}
            <div className="mb-6 p-3.5 rounded-2xl bg-gray-950/80 border border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm border border-cyan-500/30">
                  {(user?.email || savedEmail)[0]?.toUpperCase()}
                </div>
                <div className="truncate max-w-[200px]">
                  <p className="text-[11px] text-gray-400 uppercase font-semibold">Active Account</p>
                  <p className="text-xs font-semibold text-white truncate">{user?.email || savedEmail}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-xs text-gray-400 hover:text-rose-400 font-medium transition-colors"
                title="Switch Account / Logout"
              >
                Logout
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                {error}
              </div>
            )}

            <form onSubmit={handleLockedUnlock} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                  <Key className="w-4 h-4" /> 4-Digit Smart PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full glass-input py-4 px-4 rounded-2xl text-cyan-300 font-mono text-3xl tracking-[0.6em] text-center focus:outline-none transition-all shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <span>Unlocking...</span>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-cyan-300" />
                    <span>Unlock Vault</span>
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-cyan-500" />
            <span>AES-256-GCM Zero-Knowledge Encrypted</span>
          </div>

        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // REGULAR LOGIN / REGISTER VIEW
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Ambient background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Auth Container */}
      <div className="w-full max-w-md z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-glow-cyan mb-4">
            <Shield className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-400">
            SecureVault
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Zero-Knowledge Encrypted Cloud Storage
          </p>
        </div>

        {/* Phase 1: Main Top Tabs (LOGIN vs REGISTER) */}
        {mainTab !== 'forgot' && (
          <div className="flex bg-gray-900/80 p-1.5 rounded-2xl mb-6 border border-gray-800 text-sm font-semibold">
            <button
              onClick={() => { setMainTab('login'); setError(''); setMessage(''); }}
              className={`flex-1 py-3 rounded-xl transition-all ${
                mainTab === 'login'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setMainTab('register'); setError(''); setMessage(''); }}
              className={`flex-1 py-3 rounded-xl transition-all ${
                mainTab === 'register'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Auth Card */}
        <div className="glass-panel p-8 rounded-3xl shadow-2xl border border-gray-800/80">
          
          {/* Notifications */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
              {error}
            </div>
          )}
          {message && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              {message}
            </div>
          )}

          {/* PHASE 2: LOGIN PHASE (Sub-split into Password & Smart PIN) */}
          {mainTab === 'login' && (
            <div className="space-y-6">
              
              {/* Sub-toggle: Password vs Smart PIN */}
              <div className="flex bg-gray-950/80 p-1 rounded-xl border border-gray-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => { setLoginMode('pin'); setError(''); }}
                  className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    loginMode === 'pin'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                      : 'text-cyan-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" /> Smart PIN Login
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode('password'); setError(''); }}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    loginMode === 'password'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Password Login
                </button>
              </div>

              {/* MODE A: LOGIN WITH SMART PIN */}
              {loginMode === 'pin' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {savedEmail ? (
                    <div className="p-3.5 rounded-2xl bg-gray-950/80 border border-gray-800 flex items-center justify-between">
                      <div className="flex items-center gap-3 truncate">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/30 shrink-0">
                          {savedEmail[0]?.toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-[10px] text-cyan-400 font-semibold uppercase">Returning User</p>
                          <p className="text-xs font-semibold text-white truncate">{email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('securevault_last_email');
                          setEmail('');
                          setLoginMode('password');
                        }}
                        className="text-[11px] text-gray-400 hover:text-cyan-400 shrink-0 ml-2 underline"
                      >
                        Switch Email
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        Registered Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="user@vault.com"
                          className="w-full glass-input pl-12 pr-4 py-3 rounded-2xl text-white placeholder-gray-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Key className="w-4 h-4" /> 4-Digit Smart PIN
                      </label>
                      {/* FORGOT PIN OPTION */}
                      <button
                        type="button"
                        onClick={() => openForgot('pin')}
                        className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <HelpCircle className="w-3 h-3" /> Forgot PIN?
                      </button>
                    </div>

                    <input
                      type="password"
                      maxLength={4}
                      required
                      autoFocus
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full glass-input py-3.5 px-4 rounded-2xl text-cyan-300 font-mono text-2xl tracking-[0.5em] text-center focus:outline-none transition-all shadow-inner"
                    />
                    <p className="text-[11px] text-gray-500 mt-1 text-center">
                      Quick unlock your encrypted vault without entering your full password.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {loading ? (
                      <span>Verifying PIN...</span>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 text-cyan-300" />
                        <span>Quick Unlock with Smart PIN</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MODE B: LOGIN WITH PASSWORD */}
              {loginMode === 'password' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@vault.com"
                        className="w-full glass-input pl-12 pr-4 py-3 rounded-2xl text-white placeholder-gray-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Password
                      </label>
                      {/* FORGOT PASSWORD OPTION */}
                      <button
                        type="button"
                        onClick={() => openForgot('password')}
                        className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <HelpCircle className="w-3 h-3" /> Forgot Password?
                      </button>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full glass-input pl-12 pr-12 py-3 rounded-2xl text-white placeholder-gray-500 focus:outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                  >
                    {loading ? (
                      <span>Authenticating...</span>
                    ) : (
                      <>
                        <span>Access SecureVault</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              )}

            </div>
          )}

          {/* PHASE 2: REGISTER PHASE */}
          {mainTab === 'register' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@vault.com"
                    className="w-full glass-input pl-12 pr-4 py-3 rounded-2xl text-white placeholder-gray-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full glass-input pl-12 pr-12 py-3 rounded-2xl text-white placeholder-gray-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Key className="w-4 h-4" /> Set Smart 4-Digit PIN (Optional)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 1234"
                  className="w-full glass-input px-4 py-3 rounded-2xl text-white placeholder-gray-500 font-mono tracking-widest text-center focus:outline-none transition-all"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Enables quick vault unlocking without entering your full password.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <span>Create Secure Account</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD / PIN OTP RESET VIEW */}
          {mainTab === 'forgot' && (
            <div className="space-y-4">
              <button
                onClick={() => { setMainTab('login'); setError(''); setMessage(''); }}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mb-2 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </button>

              <h3 className="text-lg font-bold text-white mb-1">
                {forgotType === 'pin' ? 'Reset Smart PIN / Password' : 'Reset Password'}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                We will send a 6-digit security code (OTP) to your email to verify and reset your account authentication credentials.
              </p>

              {!otpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@vault.com"
                        className="w-full glass-input pl-12 pr-4 py-3 rounded-2xl text-white placeholder-gray-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-glow-cyan hover:opacity-95 transition-all flex items-center justify-center gap-2"
                  >
                    Send 6-Digit OTP Code
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">
                      Enter 6-Digit OTP Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full glass-input px-4 py-3 rounded-2xl text-white text-center font-mono text-xl tracking-widest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full glass-input px-4 py-3 rounded-2xl text-white placeholder-gray-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-glow-cyan hover:opacity-95 transition-all"
                  >
                    Reset Password
                  </button>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Footer Security Badge */}
        <div className="mt-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <Shield className="w-4 h-4 text-cyan-500" />
          <span>AES-256-GCM Zero-Knowledge Encrypted</span>
        </div>

      </div>
    </div>
  );
}
