package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin
		// In production, you should check the origin properly
		return true
	},
}

type Client struct {
	conn         *websocket.Conn
	send         chan []byte
	hub          *Hub
	tournamentID string
	userID       string
}

type Hub struct {
	// Registered clients by tournament ID
	tournaments map[string]map[*Client]bool
	
	// Register requests from clients
	register chan *Client
	
	// Unregister requests from clients
	unregister chan *Client
	
	// Inbound messages from clients
	broadcast chan []byte
	
	// Tournament-specific broadcasts
	tournamentBroadcast chan *TournamentMessage
	
	mutex sync.RWMutex
}

type TournamentMessage struct {
	TournamentID string      `json:"tournament_id"`
	Type         string      `json:"type"`
	Data         interface{} `json:"data"`
}

type WebSocketMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

func NewHub() *Hub {
	return &Hub{
		tournaments:         make(map[string]map[*Client]bool),
		register:           make(chan *Client),
		unregister:         make(chan *Client),
		broadcast:          make(chan []byte, 256),
		tournamentBroadcast: make(chan *TournamentMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			if h.tournaments[client.tournamentID] == nil {
				h.tournaments[client.tournamentID] = make(map[*Client]bool)
			}
			h.tournaments[client.tournamentID][client] = true
			h.mutex.Unlock()
			
			log.Printf("Client registered for tournament %s", client.tournamentID)
			
			// Send welcome message
			message := WebSocketMessage{
				Type: "connected",
				Data: gin.H{
					"message":       "Connected to tournament",
					"tournament_id": client.tournamentID,
				},
			}
			data, _ := json.Marshal(message)
			select {
			case client.send <- data:
			default:
				close(client.send)
				h.removeClient(client)
			}
			
		case client := <-h.unregister:
			h.removeClient(client)
			log.Printf("Client unregistered from tournament %s", client.tournamentID)
			
		case message := <-h.broadcast:
			// Broadcast to all clients in all tournaments
			h.mutex.RLock()
			for _, clients := range h.tournaments {
				for client := range clients {
					select {
					case client.send <- message:
					default:
						close(client.send)
						h.removeClientUnsafe(client)
					}
				}
			}
			h.mutex.RUnlock()
			
		case tournamentMsg := <-h.tournamentBroadcast:
			// Broadcast to specific tournament
			h.mutex.RLock()
			if clients, exists := h.tournaments[tournamentMsg.TournamentID]; exists {
				messageData, _ := json.Marshal(WebSocketMessage{
					Type: tournamentMsg.Type,
					Data: tournamentMsg.Data,
				})
				
				for client := range clients {
					select {
					case client.send <- messageData:
					default:
						close(client.send)
						h.removeClientUnsafe(client)
					}
				}
			}
			h.mutex.RUnlock()
		}
	}
}

func (h *Hub) removeClient(client *Client) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.removeClientUnsafe(client)
}

func (h *Hub) removeClientUnsafe(client *Client) {
	if clients, exists := h.tournaments[client.tournamentID]; exists {
		if _, exists := clients[client]; exists {
			delete(clients, client)
			close(client.send)
			
			// Clean up empty tournament rooms
			if len(clients) == 0 {
				delete(h.tournaments, client.tournamentID)
			}
		}
	}
}

func (h *Hub) HandleWebSocket(c *gin.Context) {
	tournamentID := c.Param("tournament_id")
	userID := c.Query("user_id") // Get user ID from query parameter
	
	if tournamentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Tournament ID is required"})
		return
	}
	
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	
	client := &Client{
		conn:         conn,
		send:         make(chan []byte, 256),
		hub:          h,
		tournamentID: tournamentID,
		userID:       userID,
	}
	
	client.hub.register <- client
	
	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

func (h *Hub) BroadcastToTournament(tournamentID, messageType string, data interface{}) {
	message := &TournamentMessage{
		TournamentID: tournamentID,
		Type:         messageType,
		Data:         data,
	}
	
	select {
	case h.tournamentBroadcast <- message:
	default:
		log.Printf("Tournament broadcast channel is full, dropping message")
	}
}

func (h *Hub) BroadcastToAll(messageType string, data interface{}) {
	message := WebSocketMessage{
		Type: messageType,
		Data: data,
	}
	
	messageData, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling broadcast message: %v", err)
		return
	}
	
	select {
	case h.broadcast <- messageData:
	default:
		log.Printf("Broadcast channel is full, dropping message")
	}
}

// Client read pump
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		// For now, we don't process incoming messages from clients
		// In the future, you might want to handle ping/pong or other client messages
	}
}

// Client write pump
func (c *Client) writePump() {
	defer c.conn.Close()
	
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			c.conn.WriteMessage(websocket.TextMessage, message)
		}
	}
}

// GetTournamentClientCount returns the number of connected clients for a tournament
func (h *Hub) GetTournamentClientCount(tournamentID string) int {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	if clients, exists := h.tournaments[tournamentID]; exists {
		return len(clients)
	}
	return 0
}