// ============================================
// WebSocket Service
// ============================================

type WSEventType = 
  | 'score_updated'
  | 'match_completed'
  | 'leaderboard_updated'
  | 'match_started'
  | 'hole_completed'
  | 'tournament_updated';

interface WSMessage {
  type: WSEventType;
  payload: any;
  timestamp: string;
}

interface ScoreUpdatedPayload {
  match_id: string;
  hole_number: number;
  hole_result: {
    hole_number: number;
    team1_score: number;
    team2_score: number;
    winner_team_id: string | null;
    team1_points: number;
    team2_points: number;
    scores: Array<{ user_id: string; name: string; strokes: number }>;
  };
  match_status: {
    team1_total_points: number;
    team2_total_points: number;
    holes_completed: number;
  };
}

interface MatchCompletedPayload {
  match_id: string;
  winner_team_id: string | null;
  final_score: {
    team1_points: number;
    team2_points: number;
  };
}

interface LeaderboardUpdatedPayload {
  tournament_id: string;
  team_standings: any[];
  individual_standings: any[];
}

type WSEventHandler = (payload: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<WSEventType, Set<WSEventHandler>> = new Map();
  private tournamentId: string | null = null;
  private isIntentionallyClosed = false;

  connect(tournamentId: string, token: string) {
    this.tournamentId = tournamentId;
    this.isIntentionallyClosed = false;
    
    const wsUrl = `wss://your-api.com/ws/tournaments/${tournamentId}?token=${token}`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log(`WebSocket connected to tournament ${tournamentId}`);
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        if (!this.isIntentionallyClosed) {
          this.attemptReconnect();
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      if (this.tournamentId) {
        // In production, you'd retrieve the token from storage
        const token = localStorage.getItem('auth_token') || '';
        this.connect(this.tournamentId, token);
      }
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  private handleMessage(message: WSMessage) {
    console.log('Received WebSocket message:', message.type);
    
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.payload);
        } catch (error) {
          console.error(`Error in event handler for ${message.type}:`, error);
        }
      });
    }
  }

  on(eventType: WSEventType, handler: WSEventHandler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  off(eventType: WSEventType, handler: WSEventHandler) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.eventHandlers.clear();
  }

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' {
    if (!this.ws) return 'disconnected';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      default:
        return 'disconnected';
    }
  }
}

export const wsService = new WebSocketService();

// ============================================
// React Hook for WebSocket
// ============================================

import { useEffect, useState, useCallback, useRef } from 'react';

interface UseWebSocketOptions {
  tournamentId: string;
  token: string;
  autoConnect?: boolean;
}

export const useWebSocket = (options: UseWebSocketOptions) => {
  const { tournamentId, token, autoConnect = true } = options;
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const eventHandlersRef = useRef<Map<WSEventType, WSEventHandler>>(new Map());

  useEffect(() => {
    if (autoConnect) {
      wsService.connect(tournamentId, token);
      const checkStatus = setInterval(() => {
        setConnectionStatus(wsService.getConnectionStatus());
      }, 1000);

      return () => {
        clearInterval(checkStatus);
        // Clean up all event handlers
        eventHandlersRef.current.forEach((handler, eventType) => {
          wsService.off(eventType, handler);
        });
        wsService.disconnect();
      };
    }
  }, [tournamentId, token, autoConnect]);

  const on = useCallback((eventType: WSEventType, handler: WSEventHandler) => {
    // Wrap the handler to also update lastMessage
    const wrappedHandler = (payload: any) => {
      setLastMessage({ type: eventType, payload, timestamp: new Date().toISOString() });
      handler(payload);
    };
    
    eventHandlersRef.current.set(eventType, wrappedHandler);
    wsService.on(eventType, wrappedHandler);
  }, []);

  const off = useCallback((eventType: WSEventType) => {
    const handler = eventHandlersRef.current.get(eventType);
    if (handler) {
      wsService.off(eventType, handler);
      eventHandlersRef.current.delete(eventType);
    }
  }, []);

  const send = useCallback((message: any) => {
    wsService.send(message);
  }, []);

  return {
    connectionStatus,
    lastMessage,
    on,
    off,
    send,
  };
};

// ============================================
// Updated Match Screen with WebSocket
// ============================================

import React from 'react';

interface MatchScreenWithWSProps {
  matchId: string;
  tournamentId: string;
}

export const MatchScreenWithWebSocket: React.FC<MatchScreenWithWSProps> = ({ 
  matchId, 
  tournamentId 
}) => {
  const [match, setMatch] = useState<any>(null);
  const [players, setPlayers] = useState<any>(null);
  const [holeResults, setHoleResults] = useState<any[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Get auth token (in production, from auth context or storage)
  const token = 'your-jwt-token';

  const { connectionStatus, on, off } = useWebSocket({
    tournamentId,
    token,
    autoConnect: true,
  });

  useEffect(() => {
    loadMatchData();

    // Subscribe to WebSocket events
    const handleScoreUpdate = (payload: ScoreUpdatedPayload) => {
      if (payload.match_id === matchId) {
        // Update hole results
        setHoleResults(prev => {
          const filtered = prev.filter(r => r.hole_number !== payload.hole_result.hole_number);
          return [...filtered, payload.hole_result].sort((a, b) => a.hole_number - b.hole_number);
        });

        // Update match points
        setMatch((prev: any) => prev ? {
          ...prev,
          team1_points: payload.match_status.team1_total_points,
          team2_points: payload.match_status.team2_total_points,
        } : null);

        // Show notification if score was entered by another user
        showNotificationBriefly(`Hole ${payload.hole_result.hole_number} score updated`);
      }
    };

    const handleMatchCompleted = (payload: MatchCompletedPayload) => {
      if (payload.match_id === matchId) {
        setMatch((prev: any) => prev ? {
          ...prev,
          status: 'completed',
          team1_points: payload.final_score.team1_points,
          team2_points: payload.final_score.team2_points,
        } : null);
        
        showNotificationBriefly('Match completed!');
      }
    };

    on('score_updated', handleScoreUpdate);
    on('match_completed', handleMatchCompleted);

    return () => {
      off('score_updated');
      off('match_completed');
    };
  }, [matchId, on, off]);

  const loadMatchData = async () => {
    // Load initial match data from API
    // ... (same as before)
  };

  const showNotificationBriefly = (message: string) => {
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  if (!match || !players) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Connection Status Indicator */}
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        padding: '8px 12px',
        borderRadius: '20px',
        backgroundColor: connectionStatus === 'connected' ? '#10b981' : '#ef4444',
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 1000,
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 'white',
          animation: connectionStatus === 'connected' ? 'pulse 2s infinite' : 'none',
        }}></div>
        {connectionStatus === 'connected' ? 'Live' : 'Connecting...'}
      </div>

      {/* Score Update Notification */}
      {showNotification && (
        <div style={{
          position: 'fixed',
          top: 60,
          right: 10,
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: '#3b82f6',
          color: 'white',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          animation: 'slideIn 0.3s ease-out',
        }}>
          {notificationMessage}
        </div>
      )}

      {/* Rest of the match screen component */}
      <div>
        {/* ... existing match screen UI ... */}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

// ============================================
// Updated Leaderboard with WebSocket
// ============================================

interface LeaderboardWithWSProps {
  tournamentId: string;
}

export const LeaderboardWithWebSocket: React.FC<LeaderboardWithWSProps> = ({ tournamentId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updateAnimation, setUpdateAnimation] = useState(false);

  const token = 'your-jwt-token';

  const { connectionStatus, on, off } = useWebSocket({
    tournamentId,
    token,
    autoConnect: true,
  });

  useEffect(() => {
    loadLeaderboard();

    // Subscribe to leaderboard updates
    const handleLeaderboardUpdate = (payload: LeaderboardUpdatedPayload) => {
      if (payload.tournament_id === tournamentId) {
        setData((prev: any) => ({
          ...prev,
          team_standings: payload.team_standings,
          individual_standings: payload.individual_standings,
        }));

        // Trigger update animation
        setUpdateAnimation(true);
        setTimeout(() => setUpdateAnimation(false), 1000);
      }
    };

    const handleScoreUpdate = (payload: ScoreUpdatedPayload) => {
      // Update live matches if they exist
      setData((prev: any) => {
        if (!prev?.live_matches) return prev;
        
        const updatedMatches = prev.live_matches.map((m: any) => {
          if (m.id === payload.match_id) {
            return {
              ...m,
              current_hole: payload.hole_result.hole_number,
              last_update: 'Just now',
            };
          }
          return m;
        });

        return { ...prev, live_matches: updatedMatches };
      });
    };

    const handleMatchCompleted = (payload: MatchCompletedPayload) => {
      // Remove completed match from live matches
      setData((prev: any) => {
        if (!prev?.live_matches) return prev;
        
        return {
          ...prev,
          live_matches: prev.live_matches.filter((m: any) => m.id !== payload.match_id),
        };
      });
    };

    on('leaderboard_updated', handleLeaderboardUpdate);
    on('score_updated', handleScoreUpdate);
    on('match_completed', handleMatchCompleted);

    return () => {
      off('leaderboard_updated');
      off('score_updated');
      off('match_completed');
    };
  }, [tournamentId, on, off]);

  const loadLeaderboard = async () => {
    // Load initial leaderboard data
    // ... (same as before)
  };

  if (loading) {
    return <div>Loading leaderboard...</div>;
  }

  return (
    <div>
      {/* Connection Status Badge */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        padding: '12px 16px',
        borderRadius: '24px',
        backgroundColor: connectionStatus === 'connected' ? '#10b981' : '#f59e0b',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 1000,
      }}>
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: 'white',
          animation: connectionStatus === 'connected' ? 'pulse 2s infinite' : 'none',
        }}></div>
        {connectionStatus === 'connected' ? 'Real-time updates active' : 'Reconnecting...'}
      </div>

      {/* Update Flash Animation */}
      {updateAnimation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: '#3b82f6',
          animation: 'progressBar 1s ease-out',
          zIndex: 1000,
        }}></div>
      )}

      {/* Existing leaderboard UI */}
      <div>
        {/* ... leaderboard content ... */}
      </div>

      <style>{`
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};

// ============================================
// Go Backend WebSocket Handler Example
// ============================================

/*
package websocket

import (
    "encoding/json"
    "log"
    "sync"
    "time"

    "github.com/gorilla/websocket"
)

type Client struct {
    ID           string
    TournamentID string
    Conn         *websocket.Conn
    Send         chan []byte
}

type Hub struct {
    clients    map[string]*Client
    broadcast  chan Message
    register   chan *Client
    unregister chan *Client
    mu         sync.RWMutex
}

type Message struct {
    Type      string      `json:"type"`
    Payload   interface{} `json:"payload"`
    Timestamp time.Time   `json:"timestamp"`
}

func NewHub() *Hub {
    return &Hub{
        clients:    make(map[string]*Client),
        broadcast:  make(chan Message),
        register:   make(chan *Client),
        unregister: make(chan *Client),
    }
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.mu.Lock()
            h.clients[client.ID] = client
            h.mu.Unlock()
            log.Printf("Client %s registered for tournament %s", client.ID, client.TournamentID)

        case client := <-h.unregister:
            h.mu.Lock()
            if _, ok := h.clients[client.ID]; ok {
                delete(h.clients, client.ID)
                close(client.Send)
            }
            h.mu.Unlock()
            log.Printf("Client %s unregistered", client.ID)

        case message := <-h.broadcast:
            h.mu.RLock()
            for _, client := range h.clients {
                select {
                case client.Send <- h.marshalMessage(message):
                default:
                    h.mu.RUnlock()
                    h.mu.Lock()
                    close(client.Send)
                    delete(h.clients, client.ID)
                    h.mu.Unlock()
                    h.mu.RLock()
                }
            }
            h.mu.RUnlock()
        }
    }
}

func (h *Hub) marshalMessage(msg Message) []byte {
    data, _ := json.Marshal(msg)
    return data
}

func (h *Hub) BroadcastToTournament(tournamentID string, msgType string, payload interface{}) {
    msg := Message{
        Type:      msgType,
        Payload:   payload,
        Timestamp: time.Now(),
    }

    h.mu.RLock()
    defer h.mu.RUnlock()

    for _, client := range h.clients {
        if client.TournamentID == tournamentID {
            select {
            case client.Send <- h.marshalMessage(msg):
            default:
                // Client send buffer is full, skip
            }
        }
    }
}

// In your Gin handler
func (h *Hub) HandleWebSocket(c *gin.Context) {
    tournamentID := c.Param("tournament_id")
    token := c.Query("token")

    // Validate token and get user
    // ...

    conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
    if err != nil {
        log.Println("WebSocket upgrade error:", err)
        return
    }

    client := &Client{
        ID:           generateClientID(),
        TournamentID: tournamentID,
        Conn:         conn,
        Send:         make(chan []byte, 256),
    }

    h.register <- client

    go client.writePump()
    go client.readPump(h)
}

func (c *Client) readPump(h *Hub) {
    defer func() {
        h.unregister <- c
        c.Conn.Close()
    }()

    c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    c.Conn.SetPongHandler(func(string) error {
        c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        return nil
    })

    for {
        _, _, err := c.Conn.ReadMessage()
        if err != nil {
            break
        }
    }
}

func (c *Client) writePump() {
    ticker := time.NewTicker(54 * time.Second)
    defer func() {
        ticker.Stop()
        c.Conn.Close()
    }()

    for {
        select {
        case message, ok := <-c.Send:
            if !ok {
                c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }

            c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
                return
            }

        case <-ticker.C:
            c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }
        }
    }
}

// When a score is submitted, broadcast the update
func (s *ScoringService) SubmitHoleScores(matchID string, holeNumber int, scores []HoleScore) error {
    // ... save scores to database ...

    // Broadcast update
    payload := ScoreUpdatedPayload{
        MatchID:    matchID,
        HoleNumber: holeNumber,
        HoleResult: result,
        MatchStatus: status,
    }

    s.wsHub.BroadcastToTournament(tournamentID, "score_updated", payload)

    return nil
}
*/

export default {
  wsService,
  useWebSocket,
  MatchScreenWithWebSocket,
  LeaderboardWithWebSocket,
};