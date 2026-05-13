import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trophy, Mail, Lock, User, UserPlus, Eye, EyeOff, CheckCircle, X } from 'lucide-react';
import { useAuth, ApiError } from '../components/Auth';

const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = searchParams.get('next') || '/leaderboard';

  const { login, register } = useAuth();

  const [mode, setMode] = useState<'login'|'register'>('login');
  const [formData, setFormData] = useState({ email: '', name: '', password: '', handicap: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationEmail, setRegistrationEmail] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ email: '', name: '', password: '', handicap: '' });
    setError(null);
    setShowPassword(false);
    setRegistrationEmail(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
        navigate(next);
      } else {
        const handicap = formData.handicap ? parseFloat(formData.handicap) : undefined;
        await register(formData.email, formData.name, formData.password, handicap);
        setRegistrationEmail(formData.email);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (registrationEmail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Trophy className="h-8 w-8 mr-3" />
                <h2 className="text-xl font-bold">Account Created!</h2>
              </div>
              <button onClick={() => { navigate(next); resetForm(); }} className="text-green-100 hover:text-white">
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
              onClick={() => { navigate(next); resetForm(); }}
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 mr-3" />
            <div>
              <h2 className="text-xl font-bold">{mode === 'login' ? 'Welcome Back' : 'Join Tournament'}</h2>
              <p className="text-green-100 text-sm">{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="email" name="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" placeholder="Enter your email" />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input type="text" name="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" placeholder="Enter your full name" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} name="password" required minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </div>
              {mode === 'register' && <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>}
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Golf Handicap (Optional)</label>
                <input type="number" name="handicap" step="0.1" min="0" max="36" value={formData.handicap} onChange={(e) => setFormData({ ...formData, handicap: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500" placeholder="e.g. 12.5" />
                <p className="text-xs text-gray-500 mt-1">Your official golf handicap index</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center">
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> : null}
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); resetForm(); }} className="text-green-600 hover:text-green-700 text-sm font-medium block w-full">{mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}</button>
            {mode === 'login' && (
              <button type="button" onClick={() => navigate('/reset-password')} className="text-gray-500 hover:text-gray-700 text-sm">Forgot password?</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
