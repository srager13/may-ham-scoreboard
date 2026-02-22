import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient, Tournament } from '../services/api';
import { useAuth } from './Auth';

interface TournamentContextType {
  tournaments: Tournament[];
  selectedTournamentId: string | null;
  selectedTournament: Tournament | null;
  setSelectedTournamentId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refreshTournaments: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
};

interface TournamentProviderProps {
  children: ReactNode;
}

export const TournamentProvider: React.FC<TournamentProviderProps> = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentIdState] = useState<string | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tournaments on mount and when authentication state changes
  useEffect(() => {
    if (!authLoading) {
      refreshTournaments();
    }
  }, [isAuthenticated, authLoading]);

  // Load selected tournament from localStorage on mount
  useEffect(() => {
    const savedTournamentId = localStorage.getItem('selectedTournamentId');
    if (savedTournamentId) {
      setSelectedTournamentIdState(savedTournamentId);
    }
  }, []);

  // Update selected tournament when ID changes
  useEffect(() => {
    if (selectedTournamentId && tournaments.length > 0) {
      const tournament = tournaments.find(t => t.id === selectedTournamentId);
      setSelectedTournament(tournament || null);
      
      // Save to localStorage
      localStorage.setItem('selectedTournamentId', selectedTournamentId);
    } else {
      setSelectedTournament(null);
    }
  }, [selectedTournamentId, tournaments]);

  const refreshTournaments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tournamentList = await apiClient.getUserTournaments();
      setTournaments(tournamentList);
      
      // Auto-select first tournament if none selected
      if (tournamentList.length > 0 && !selectedTournamentId) {
        setSelectedTournamentIdState(tournamentList[0].id);
      } else if (tournamentList.length === 0) {
        setError('You are not a member of any tournaments.');
      }
    } catch (err) {
      console.error('Error loading tournaments:', err);
      setError('Failed to load tournaments. Please make sure you are logged in.');
    } finally {
      setLoading(false);
    }
  };

  const setSelectedTournamentId = (id: string) => {
    setSelectedTournamentIdState(id);
  };

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        selectedTournamentId,
        selectedTournament,
        setSelectedTournamentId,
        loading,
        error,
        refreshTournaments,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
};
