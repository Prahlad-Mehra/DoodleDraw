package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

type Pos struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type SceneNode struct {
	ID       string `json:"id"`
	StartPos Pos    `json:"startPos"`
	EndPos   Pos    `json:"endPos"`
	Shape    string `json:"shape"`
}

type SocketMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type outgoingMessage struct {
	Type    string `json:"type"`
	Payload any    `json:"payload,omitempty"`
}

type welcomePayload struct {
	ClientID string            `json:"clientId"`
	RoomID   string            `json:"roomId"`
	Scene    []SceneNode       `json:"scene"`
	Locks    map[string]string `json:"locks"`
}

type shapePayload struct {
	Shape     SceneNode `json:"shape"`
	Committed bool      `json:"committed,omitempty"`
}

type shapeDeletePayload struct {
	ShapeID string `json:"shapeId"`
}

type lockPayload struct {
	ShapeID string `json:"shapeId"`
	OwnerID string `json:"ownerId,omitempty"`
}

type errorPayload struct {
	Message string `json:"message"`
}

type inboundMessage struct {
	client  *client
	message SocketMessage
}

type RoomManager struct {
	mu    sync.Mutex
	rooms map[string]*Hub
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Hub),
	}
}

func (m *RoomManager) Get(roomID string) *Hub {
	roomID = strings.TrimSpace(roomID)
	if roomID == "" {
		roomID = "default"
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if room, ok := m.rooms[roomID]; ok {
		return room
	}

	room := NewHub(roomID)
	m.rooms[roomID] = room
	go room.Run()
	return room
}

type Hub struct {
	roomID string

	clients     map[*client]bool
	scene       map[string]SceneNode
	shapeOwners map[string]string
	committed   map[string]bool
	locks       map[string]string
	register    chan *client
	unregister  chan *client
	inbound     chan inboundMessage
}

func NewHub(roomID string) *Hub {
	return &Hub{
		roomID:      roomID,
		clients:     make(map[*client]bool),
		scene:       make(map[string]SceneNode),
		shapeOwners: make(map[string]string),
		committed:   make(map[string]bool),
		locks:       make(map[string]string),
		register:    make(chan *client),
		unregister:  make(chan *client),
		inbound:     make(chan inboundMessage),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.clients[c] = true
			h.sendTo(c, "welcome", welcomePayload{
				ClientID: c.id,
				RoomID:   h.roomID,
				Scene:    h.sceneSnapshot(),
				Locks:    h.locksSnapshot(),
			})

		case c := <-h.unregister:
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				h.releaseClientLocks(c)
				close(c.send)
			}

		case event := <-h.inbound:
			h.handleMessage(event.client, event.message)
		}
	}
}

func (h *Hub) handleMessage(c *client, message SocketMessage) {
	switch message.Type {
	case "shape:upsert":
		var payload shapePayload
		if !decodePayload(c, message.Payload, &payload) {
			return
		}
		h.upsertShape(c, payload.Shape, payload.Committed)

	case "shape:delete":
		var payload shapeDeletePayload
		if !decodePayload(c, message.Payload, &payload) {
			return
		}
		h.deleteShape(c, payload.ShapeID)

	case "lock:request":
		var payload lockPayload
		if !decodePayload(c, message.Payload, &payload) {
			return
		}
		h.requestLock(c, payload.ShapeID)

	case "lock:release":
		var payload lockPayload
		if !decodePayload(c, message.Payload, &payload) {
			return
		}
		h.releaseLock(c, payload.ShapeID)

	default:
		h.sendError(c, fmt.Sprintf("unknown message type %q", message.Type))
	}
}

func (h *Hub) upsertShape(c *client, shape SceneNode, committed bool) {
	if !isValidShape(shape) {
		h.sendError(c, "invalid shape payload")
		return
	}

	_, exists := h.scene[shape.ID]
	lockOwner, locked := h.locks[shape.ID]
	owner := h.shapeOwners[shape.ID]

	if locked && lockOwner != c.id {
		h.sendError(c, "shape is locked by another client")
		return
	}

	if !exists {
		if !strings.HasPrefix(shape.ID, c.id+":") {
			h.sendError(c, "new shape id must be owned by the creating client")
			return
		}
		h.shapeOwners[shape.ID] = c.id
	} else if !locked && (owner != c.id || h.committed[shape.ID]) {
		h.sendError(c, "shape update requires lock ownership")
		return
	}

	h.scene[shape.ID] = shape
	if locked || committed {
		h.committed[shape.ID] = true
	}
	h.broadcast("shape:upsert", shapePayload{Shape: shape, Committed: h.committed[shape.ID]})
}

func (h *Hub) deleteShape(c *client, shapeID string) {
	if strings.TrimSpace(shapeID) == "" {
		h.sendError(c, "shapeId is required")
		return
	}

	if owner, locked := h.locks[shapeID]; locked && owner != c.id {
		h.sendError(c, "shape is locked by another client")
		return
	}

	owner := h.shapeOwners[shapeID]
	if owner != "" && owner != c.id && h.locks[shapeID] != c.id {
		h.sendError(c, "shape delete requires lock ownership")
		return
	}

	delete(h.scene, shapeID)
	delete(h.shapeOwners, shapeID)
	delete(h.committed, shapeID)
	delete(h.locks, shapeID)
	h.broadcast("shape:delete", shapeDeletePayload{ShapeID: shapeID})
}

func (h *Hub) requestLock(c *client, shapeID string) {
	if strings.TrimSpace(shapeID) == "" {
		h.sendError(c, "shapeId is required")
		return
	}
	if _, exists := h.scene[shapeID]; !exists {
		h.sendError(c, "shape does not exist")
		return
	}
	if !h.committed[shapeID] {
		h.sendTo(c, "lock:denied", lockPayload{ShapeID: shapeID, OwnerID: h.shapeOwners[shapeID]})
		return
	}

	if owner, locked := h.locks[shapeID]; locked && owner != c.id {
		h.sendTo(c, "lock:denied", lockPayload{ShapeID: shapeID, OwnerID: owner})
		return
	}

	h.locks[shapeID] = c.id
	h.broadcast("lock:granted", lockPayload{ShapeID: shapeID, OwnerID: c.id})
}

func (h *Hub) releaseLock(c *client, shapeID string) {
	if owner, locked := h.locks[shapeID]; locked && owner == c.id {
		delete(h.locks, shapeID)
		h.broadcast("lock:release", lockPayload{ShapeID: shapeID, OwnerID: c.id})
	}
}

func (h *Hub) releaseClientLocks(c *client) {
	for shapeID, owner := range h.locks {
		if owner == c.id {
			delete(h.locks, shapeID)
			h.broadcast("lock:release", lockPayload{ShapeID: shapeID, OwnerID: c.id})
		}
	}
}

func (h *Hub) sceneSnapshot() []SceneNode {
	scene := make([]SceneNode, 0, len(h.scene))
	for _, shape := range h.scene {
		scene = append(scene, shape)
	}
	return scene
}

func (h *Hub) locksSnapshot() map[string]string {
	locks := make(map[string]string, len(h.locks))
	for shapeID, owner := range h.locks {
		locks[shapeID] = owner
	}
	return locks
}

func (h *Hub) broadcast(messageType string, payload any) {
	message := encodeMessage(messageType, payload)
	for c := range h.clients {
		select {
		case c.send <- message:
		default:
			delete(h.clients, c)
			h.releaseClientLocks(c)
			close(c.send)
		}
	}
}

func (h *Hub) sendTo(c *client, messageType string, payload any) {
	c.send <- encodeMessage(messageType, payload)
}

func (h *Hub) sendError(c *client, message string) {
	h.sendTo(c, "error", errorPayload{Message: message})
}

func encodeMessage(messageType string, payload any) []byte {
	message, err := json.Marshal(outgoingMessage{
		Type:    messageType,
		Payload: payload,
	})
	if err != nil {
		return []byte(`{"type":"error","payload":{"message":"failed to encode message"}}`)
	}
	return message
}

func decodePayload(c *client, payload json.RawMessage, target any) bool {
	if err := json.Unmarshal(payload, target); err != nil {
		c.hub.sendError(c, "invalid message payload")
		return false
	}
	return true
}

func isValidShape(shape SceneNode) bool {
	if strings.TrimSpace(shape.ID) == "" {
		return false
	}

	switch shape.Shape {
	case "rect", "oval", "arrow", "line":
		return true
	default:
		return false
	}
}
