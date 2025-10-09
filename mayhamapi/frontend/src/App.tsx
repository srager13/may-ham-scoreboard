import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Trophy, Users, BarChart3, Settings } from 'lucide-react';
import AdminPortal from './components/AdminPortal';
import ScoreInterface from './components/ScoreInterface';
import { AuthProvider, AuthModal, LoginButton, useAuth } from './components/Auth';

// Temporary placeholder for Leaderboard
const Leaderboard = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Leaderboard</h1>
    <p>Leaderboard component is being updated. Please use the Admin Portal to create tournaments.</p>
  </div>
);

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

function AppContent() {
  const location = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const navigation = [
    { name: 'Leaderboard', href: '/', icon: Trophy },
    { name: 'Score Entry', href: '/score', icon: BarChart3 },
    { name: 'Admin Portal', href: '/admin', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Trophy className="h-8 w-8 text-green-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">
                  Mayham Golf
                </span>
              </div>
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

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Leaderboard />} />
          <Route 
            path="/score" 
            element={
              <ProtectedRoute>
                <ScoreInterface />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminPortal />
              </ProtectedRoute>
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;