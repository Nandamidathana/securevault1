import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

// Configure Axios Base URL for live/production deployments
const API_URL = import.meta.env.VITE_API_URL || '';
if (API_URL) {
  axios.defaults.baseURL = API_URL;
}

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const initialToken = localStorage.getItem('securevault_token');
  const [token, setToken] = useState(initialToken || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('securevault_user') || 'null'));
  const [isUnlocked, setIsUnlocked] = useState(Boolean(initialToken));
  const [loading, setLoading] = useState(false);

  // Sync token to Axios headers
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('securevault_token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('securevault_token');
    }
  }, [token]);

  // Sync user object to local storage
  useEffect(() => {
    if (user) {
      localStorage.setItem('securevault_user', JSON.stringify(user));
      if (user.email) {
        localStorage.setItem('securevault_last_email', user.email);
      }
    } else {
      localStorage.removeItem('securevault_user');
    }
  }, [user]);

  // Auto-lock on 3 minutes idle inactivity
  useEffect(() => {
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      if (token && isUnlocked) {
        timer = setTimeout(() => {
          console.log('🔒 Auto-locking vault due to inactivity.');
          setIsUnlocked(false);
        }, 3 * 60 * 1000);
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [token, isUnlocked]);

  // Fetch current user (memoized with useCallback)
  const fetchUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  }, [token]);

  // Login handler (memoized with useCallback)
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        setIsUnlocked(true);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        isVerified: err.response?.data?.isVerified,
        message: err.response?.data?.message || 'Login failed.',
        email: err.response?.data?.email || email
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Smart PIN Quick Unlock (memoized)
  const quickUnlockPin = useCallback(async (email, pin) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/pin/quick-unlock', { email, pin });
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        setIsUnlocked(true);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        isVerified: err.response?.data?.isVerified,
        message: err.response?.data?.message || 'Smart PIN unlock failed.'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Signup handler (memoized)
  const signup = useCallback(async (email, password, pin) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/signup', { email, password, pin });
      if (res.data.success) {
        return {
          success: true,
          isVerified: false,
          message: res.data.message || 'Signup successful! Please verify your email before logging in.'
        };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Signup failed.'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Resend Verification Email (memoized)
  const resendVerification = useCallback(async (email) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/resend-verification', { email });
      return {
        success: res.data.success !== false,
        message: res.data.message || 'Verification email re-sent.'
      };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to resend verification email.'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Verify Email Token (memoized)
  const verifyEmailToken = useCallback(async (verifyToken) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/verify-email', { token: verifyToken });
      return {
        success: res.data.success !== false,
        message: res.data.message || 'Email verified successfully!'
      };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Email verification failed.'
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout (memoized)
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setIsUnlocked(false);
    localStorage.removeItem('securevault_token');
    localStorage.removeItem('securevault_user');
  }, []);

  // Verify PIN (memoized)
  const verifyPin = useCallback(async (pin) => {
    try {
      const res = await axios.post('/api/auth/pin/verify', { pin });
      if (res.data.unlocked) {
        setIsUnlocked(true);
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }, []);

  // Set PIN (memoized)
  const setPin = useCallback(async (pin) => {
    try {
      const res = await axios.post('/api/auth/pin', { pin });
      if (res.data.success) {
        await fetchUser();
        return { success: true };
      }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to update PIN' };
    }
  }, [fetchUser]);

  const value = useMemo(() => ({
    token,
    user,
    isUnlocked,
    setIsUnlocked,
    loading,
    login,
    quickUnlockPin,
    signup,
    resendVerification,
    verifyEmailToken,
    logout,
    verifyPin,
    setPin,
    fetchUser
  }), [
    token,
    user,
    isUnlocked,
    loading,
    login,
    quickUnlockPin,
    signup,
    resendVerification,
    verifyEmailToken,
    logout,
    verifyPin,
    setPin,
    fetchUser
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
