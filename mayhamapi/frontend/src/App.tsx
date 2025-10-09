import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Trophy, Users, BarChart3, Settings } from 'lucide-react';
import AdminPortal from './components/AdminPortal';
import ScoreInterface from './components/ScoreInterface';

// Temporary placeholder for Leaderboard
const Leaderboard = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Leaderboard</h1>
    <p>Leaderboard component is being updated. Please use the Admin Portal to create tournaments.</p>
  </div>
);

function App() {
  const location = useLocation();

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
          <Route path="/score" element={<ScoreInterface />} />
          <Route path="/admin" element={<AdminPortal />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;