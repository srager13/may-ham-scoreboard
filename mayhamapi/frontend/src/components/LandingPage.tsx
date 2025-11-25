import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users, BarChart3, ChevronRight, Star } from 'lucide-react';
import { AuthModal, useAuth } from './Auth';

const LandingPage = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLoginClick = () => {
    if (isAuthenticated) {
      navigate('/leaderboard');
    } else {
      setShowAuthModal(true);
    }
  };

  // If user is already logged in, redirect them
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/leaderboard');
    }
  }, [isAuthenticated, navigate]);

  const features = [
    {
      icon: Trophy,
      title: 'Tournament Management',
      description: 'Create and manage Ryder Cup style tournaments with team-based scoring.',
    },
    {
      icon: BarChart3,
      title: 'Live Scoring',
      description: 'Real-time score updates with match play and stroke play formats.',
    },
    {
      icon: Users,
      title: 'Team Competition',
      description: 'Organize players into teams and track collective performance.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start mb-6">
                  <Trophy className="h-16 w-16 text-green-600 mr-4" />
                  <div>
                    <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                      <span className="block">May Ham Cup</span>
                      <span className="block text-green-600">Scoreboard</span>
                    </h1>
                  </div>
                </div>
                
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  The ultimate golf tournament management system. Track scores, manage teams, 
                  and follow live tournament action in real-time.
                </p>
                
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <button
                      onClick={handleLoginClick}
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 md:py-4 md:text-lg md:px-10 transition-colors"
                    >
                      {isAuthenticated ? 'View Leaderboard' : 'Get Started'}
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <button
                      onClick={() => navigate('/leaderboard')}
                      className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 md:py-4 md:text-lg md:px-10 transition-colors"
                    >
                      View Public Leaderboard
                    </button>
                  </div>
                </div>

                {/* Tournament Status Badge */}
                <div className="mt-8 flex items-center justify-center lg:justify-start">
                  <div className="flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    <Star className="h-4 w-4 mr-2" />
                    Tournament Active
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        
        {/* Decorative background */}
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <div className="h-56 w-full sm:h-72 md:h-96 lg:w-full lg:h-full bg-gradient-to-br from-green-400 via-green-500 to-green-600 flex items-center justify-center">
            <div className="text-center text-white">
              <Trophy className="h-32 w-32 mx-auto mb-4 opacity-20" />
              <div className="text-4xl font-bold opacity-30">2025</div>
              <div className="text-xl opacity-30">Tournament Season</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-green-600 font-semibold tracking-wide uppercase">
              Features
            </h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need for tournament golf
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              Professional-grade tournament management with real-time scoring, team management, and comprehensive reporting.
            </p>
          </div>

          <div className="mt-10">
            <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="relative">
                    <dt>
                      <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                        <Icon className="h-6 w-6" />
                      </div>
                      <p className="ml-16 text-lg leading-6 font-medium text-gray-900">
                        {feature.title}
                      </p>
                    </dt>
                    <dd className="mt-2 ml-16 text-base text-gray-500">
                      {feature.description}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-green-700">
        <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            <span className="block">Ready to start scoring?</span>
          </h2>
          <p className="mt-4 text-lg leading-6 text-green-200">
            Join the tournament and start tracking your golf scores today.
          </p>
          <button
            onClick={handleLoginClick}
            className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-green-600 bg-white hover:bg-green-50 sm:w-auto transition-colors"
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Sign Up Now'}
            <ChevronRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          navigate('/leaderboard');
        }}
      />
    </div>
  );
};

export default LandingPage;