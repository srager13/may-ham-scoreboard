import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Trophy, Users, BarChart3, Settings, AlertCircle, Shield } from 'lucide-react';
import Leaderboard from './components/Leaderboard';
import TournamentSetup from './components/TournamentSetup';
import ScoreInterface from './components/ScoreInterface';
import LandingPage from './components/LandingPage';
import Groups from './components/Groups';
import AdminPortal from './components/AdminPortal';
import { AuthProvider, AuthModal, LoginButton, useAuth } from './components/Auth';
import { TournamentProvider } from './components/TournamentContext';
import ErrorBoundary from './components/ErrorBoundary';

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

function AppContent() {
  const location = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useAuth();
  const isLandingPage = location.pathname === '/';

  const navigation = [
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Score Entry', href: '/score', icon: BarChart3 },
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
                
                {/* Auth Section */}
                <div className="flex items-center">
                  <LoginButton onOpenAuth={() => setShowAuthModal(true)} />
                </div>
              </div>
            </div>

            {/* Mobile menu */}
            <div className="sm:hidden">
              <div className="pt-2 pb-3 space-y-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isActive
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                      } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                    >
                      <Icon className="h-4 w-4 inline mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>

          {/* API Error Notification */}
          <ApiErrorNotification />
        </>
      )}

      {/* Main content - conditional wrapper */}
      <main className={isLandingPage ? "" : "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
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
