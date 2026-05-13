import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { Trophy, Users, BarChart3, Settings, AlertCircle, Shield, Menu, X, CheckCircle } from 'lucide-react';
import Leaderboard from './components/Leaderboard';
import TournamentSetup from './components/TournamentSetup';
import ScoreInterface from './components/ScoreInterface';
import LandingPage from './components/LandingPage';
import Groups from './components/Groups';
import AdminPortal from './components/AdminPortal';
import TournamentInfo from './components/TournamentInfo';
import Scorecards from './components/Scorecards';
import { AuthProvider, AuthModal, LoginButton, useAuth, EmailVerificationBanner, ForgotPasswordPage } from './components/Auth';
import { TournamentProvider } from './components/TournamentContext';
import ErrorBoundary from './components/ErrorBoundary';
import { apiClient, ApiError } from './services/api';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please sign in to access this feature.</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
          >
            Sign In
          </button>
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Admin Route Component
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please sign in to access this feature.</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
          >
            Sign In
          </button>
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        </div>
      </div>
    );
  }

  if (!user?.is_admin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600 mb-4">You do not have permission to access this page.</p>
          <Link
            to="/"
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 inline-block"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// API Error Notification
const ApiErrorNotification = () => {
  const { apiError } = useAuth();
  
  if (!apiError) return null;
  
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            <strong>API Connection Issue:</strong> {apiError}
          </p>
        </div>
      </div>
    </div>
  );
};

// Groups wrapper to get current user
const GroupsWrapper: React.FC = () => {
  const { user } = useAuth();
  return <Groups user={user} />;
};

// Email verification landing page — handles /verify-email?token=xxx
const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in this link.');
      return;
    }

    apiClient.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified. You can now enjoy all features of Mayham Golf!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Verification failed. The link may have expired or already been used.');
      });
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white rounded-lg shadow-md w-full max-w-md mx-4 p-8 text-center">
        <Trophy className="h-12 w-12 text-green-600 mx-auto mb-4" />
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Email Verified!</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
            >
              Go to App
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
            >
              Go to App
            </button>
          </>
        )}
      </div>
    </div>
  );
};

  function AppContent() {
    const location = useLocation();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user } = useAuth();
    const isLandingPage = location.pathname === '/';

    // Open the auth modal when the API reports an unauthorized (403) response
    useEffect(() => {
      const handler = (e: Event) => {
        setShowAuthModal(true);
      };
      window.addEventListener('api:unauthorized', handler as EventListener);
      return () => window.removeEventListener('api:unauthorized', handler as EventListener);
    }, []);

  const navigation = [
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Score Entry', href: '/score', icon: BarChart3 },
    { name: 'Scorecards', href: '/scorecards', icon: BarChart3 },
    { name: 'Tournament Info', href: '/tournamentinfo', icon: Trophy },
    { name: 'Groups', href: '/groups', icon: Users },
    { name: 'Tournament Setup', href: '/tournamentsetup', icon: Settings },
  ];

  // Add admin link if user is admin
  if (user?.is_admin) {
    navigation.push({ name: 'Admin', href: '/admin', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Conditionally show navigation - not for landing page */}
      {!isLandingPage && (
        <>
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <Link to="/" className="flex-shrink-0 flex items-center hover:opacity-80 transition-opacity">
                    <Trophy className="h-8 w-8 text-green-600" />
                    <span className="ml-2 text-xl font-bold text-gray-900">
                      Mayham Golf
                    </span>
                  </Link>
                  <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                    {navigation.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`${
                            isActive
                              ? 'border-green-500 text-gray-900'
                              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                          } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                        >
                          <Icon className="h-4 w-4 mr-1" />
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
                
                {/* Auth Section and Mobile Menu Button */}
                <div className="flex items-center space-x-2">
                  <LoginButton onOpenAuth={() => setShowAuthModal(true)} />
                  {/* Mobile menu button */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="sm:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
                    aria-label="Toggle menu"
                  >
                    {mobileMenuOpen ? (
                      <X className="h-6 w-6" />
                    ) : (
                      <Menu className="h-6 w-6" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile menu drawer */}
            {/* Overlay */}
            {mobileMenuOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
            )}
            
            {/* Sliding drawer */}
            <div
              className={`fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out sm:hidden ${
                mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              <div className="flex flex-col h-full">
                {/* Drawer header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center">
                    <Trophy className="h-6 w-6 text-green-600" />
                    <span className="ml-2 text-lg font-bold text-gray-900">Menu</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                {/* Navigation links */}
                <nav className="flex-1 overflow-y-auto py-4">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`${
                          isActive
                            ? 'bg-green-50 border-green-500 text-green-700'
                            : 'border-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                        } flex items-center px-4 py-3 border-l-4 text-base font-medium transition-colors`}
                      >
                        <Icon className="h-5 w-5 mr-3" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          </nav>

          {/* API Error Notification */}
          <ApiErrorNotification />

          {/* Email verification banner (shown when logged in but unverified) */}
          <EmailVerificationBanner />
        </>
      )}

      {/* Main content - conditional wrapper */}
      <main className={isLandingPage ? "" : "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ForgotPasswordPage />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route 
            path="/score" 
            element={
              <ProtectedRoute>
                <ScoreInterface />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/groups" 
            element={
              <ProtectedRoute>
                <GroupsWrapper />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tournamentsetup" 
            element={
              <ProtectedRoute>
                <TournamentSetup />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tournamentinfo"
            element={
              <ProtectedRoute>
                {/* Lazy-loaded tournament info module */}
                <React.Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
                  <TournamentInfo />
                </React.Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/scorecards"
            element={
              <ProtectedRoute>
                <Scorecards />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminPortal />
              </AdminRoute>
            } 
          />
        </Routes>
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TournamentProvider>
          <AppContent />
        </TournamentProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
