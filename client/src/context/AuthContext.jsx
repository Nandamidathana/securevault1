import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Configure Axios Base URL for Vercel -> Render production deployment
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

  // Set default auth headers for axios
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('securevault_token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('securevault_token');
    }
  }, [token]);

  // Save user profile & email
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

  // Inactivity auto-lock timer (3 minutes idle lock)
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

  // Fetch current user
  const fetchUser = async () => {
    if (!token) return;
    try {
      const res = await axios.get('/api/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  // Login
  const login = async (email, password) => {
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
        message: err.response?.data?.message || 'Login failed.'
      };
    } finally {
      setLoading(false);
    }
  };

  // Smart PIN Quick Unlock
  const quickUnlockPin = async (email, pin) => {
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
        message: err.response?.data?.message || 'Smart PIN unlock failed.'
      };
    } finally {
      setLoading(false);
    }
  };

  // Signup
  const signup = async (email, password, pin) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/signup', { email, password, pin });
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        setIsUnlocked(true);
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'Signup failed.'
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = () => {
    setToken(null);
    setUser(null);
    setIsUnlocked(false);
    localStorage.removeItem('securevault_token');
    localStorage.removeItem('securevault_user');
  };

  // Verify PIN
  const verifyPin = async (pin) => {
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
  };

  // Set PIN
  const setPin = async (pin) => {
    try {
      const res = await axios.post('/api/auth/pin', { pin });
      if (res.data.success) {
        await fetchUser();
        return { success: true };
      }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to update PIN' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isUnlocked,
        setIsUnlocked,
        loading,
        login,
        quickUnlockPin,
        signup,
        logout,
        verifyPin,
        setPin,
        fetchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
