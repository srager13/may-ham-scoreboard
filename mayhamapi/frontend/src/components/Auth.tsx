import React, { useState, useContext, createContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, UserPlus, LogIn, Eye, EyeOff, Trophy, X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiClient, ApiError, User as ApiUser } from '../services/api';
import { useTournament } from './TournamentContext';

// Authentication Context
interface AuthContextType {
  user: ApiUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, handicap?: number) => Promise<void>;
  logout: () => void;
  resendVerification: () => Promise<void>;
  loading: boolean;
  apiError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const currentUser = await apiClient.getCurrentUser();
          setUser(currentUser);
          setApiError(null);
        } catch (error) {
          console.warn('Auth check failed:', error);
          // Token is invalid or API is unavailable, clear it
          localStorage.removeItem('auth_token');
          apiClient.clearToken();
          
          // Check if this is an API connectivity issue
          if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Network'))) {
            setApiError('Backend API is not available. Some features may not work.');
          }
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.login({ email, password });
      setUser(response.user);
      setApiError(null);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Network'))) {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  };

  const register = async (email: string, name: string, password: string, handicap?: number) => {
    try {
      const response = await apiClient.register({ email, name, password, handicap });
      setUser(response.user);
      setApiError(null);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Network'))) {
        throw new Error('Cannot connect to server. Please check if the backend is running.');
      }
      throw error;
    }
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
  };

  const resendVerification = async () => {
    await apiClient.resendVerificationEmail();
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    resendVerification,
    loading,
    apiError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Login/Register Component
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login', onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    handicap: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationEmail, setRegistrationEmail] = useState<string | null>(null);
  
  const { login, register } = useAuth();

  const resetForm = () => {
    setFormData({ email: '', name: '', password: '', handicap: '' });
    setError(null);
    setShowPassword(false);
    setRegistrationEmail(null);
  };

  const handleModeSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        onClose();
        resetForm();
        if (onSuccess) onSuccess();
      } else {
        const handicap = formData.handicap ? parseFloat(formData.handicap) : undefined;
        await register(formData.email, formData.name, formData.password, handicap);
        // Show the "check your email" confirmation instead of closing immediately.
        setRegistrationEmail(formData.email);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!isOpen) return null;

  // Post-registration confirmation screen
  if (registrationEmail) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Trophy className="h-8 w-8 mr-3" />
                <h2 className="text-xl font-bold">Account Created!</h2>
              </div>
              <button onClick={() => { onClose(); resetForm(); }} className="text-green-100 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div className="p-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Check your inbox</h3>
            <p className="text-gray-600 mb-2">
              We sent a verification link to:
            </p>
            <p className="font-medium text-gray-900 mb-4">{registrationEmail}</p>
            <p className="text-sm text-gray-500 mb-6">
              Click the link in the email to verify your address. The link expires in 24 hours.
              You can still use the app while unverified.
            </p>
            <button
              onClick={() => { onClose(); resetForm(); }}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
            >
              Continue to App
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 mr-3" />
              <div>
                <h2 className="text-xl font-bold">
                  {mode === 'login' ? 'Welcome Back' : 'Join Tournament'}
                </h2>
                <p className="text-green-100 text-sm">
                  {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-green-100 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {/* Name (Register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
              )}
            </div>

            {/* Handicap (Register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Golf Handicap (Optional)
                </label>
                <input
                  type="number"
                  name="handicap"
                  step="0.1"
                  min="0"
                  max="36"
                  value={formData.handicap}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  placeholder="e.g. 12.5"
                />
                <p className="text-xs text-gray-500 mt-1">Your official golf handicap index</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <>
                  {mode === 'login' ? (
                    <LogIn className="h-5 w-5 mr-2" />
                  ) : (
                    <UserPlus className="h-5 w-5 mr-2" />
                  )}
                </>
              )}
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Mode Switch */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => handleModeSwitch(mode === 'login' ? 'register' : 'login')}
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              {mode === 'login' 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// User Profile Display Component
const UserProfile: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { tournaments, selectedTournamentId, setSelectedTournamentId } = useTournament();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();

  if (!isAuthenticated || !user) return null;

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
    navigate('/');
  };

  const handleTournamentChange = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    // Don't close dropdown to allow easier switching
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
      >
        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-medium">
          {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <span className="hidden md:block font-medium">{user.name || user.email}</span>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{user.name || user.email}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
            {user.handicap && (
              <p className="text-xs text-gray-500">Handicap: {user.handicap}</p>
            )}
          </div>
          
          {/* Tournament Selection */}
          {tournaments.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                <Trophy className="h-3 w-3 inline mr-1" />
                Active Tournament
              </label>
              <select
                value={selectedTournamentId || ''}
                onChange={(e) => handleTournamentChange(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-green-500 focus:border-green-500"
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
};

// Login Button Component
interface LoginButtonProps {
  onOpenAuth: () => void;
}

const LoginButton: React.FC<LoginButtonProps> = ({ onOpenAuth }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <UserProfile />;
  }

  return (
    <button
      onClick={onOpenAuth}
      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2"
    >
      <LogIn className="h-4 w-4" />
      <span>Sign In</span>
    </button>
  );
};

// Banner shown to logged-in users whose email isn't verified yet
const EmailVerificationBanner: React.FC = () => {
  const { user, resendVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  if (!user || user.email_verified) return null;

  const handleResend = async () => {
    setSending(true);
    setSendError(null);
    try {
      await resendVerification();
      setSent(true);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : 'Failed to resend email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center gap-2">
        <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
        <span className="text-sm text-yellow-800">
          Please verify your email address ({user.email}).
        </span>
        {sent ? (
          <span className="text-sm text-green-700 font-medium">Verification email sent!</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-sm text-yellow-700 underline hover:text-yellow-900 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Resend email'}
          </button>
        )}
        {sendError && <span className="text-sm text-red-600">{sendError}</span>}
      </div>
    </div>
  );
};

export { AuthModal, LoginButton, UserProfile, EmailVerificationBanner };
