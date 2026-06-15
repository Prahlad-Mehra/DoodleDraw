package main

import (
	"encoding/json"
	"testing"
	"time"
)

type testMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

func TestRoomManagerReusesRooms(t *testing.T) {
	manager := NewRoomManager()

	first := manager.Get("design-room")
	second := manager.Get("design-room")

	if first != second {
		t.Fatal("expected room manager to reuse an existing room")
	}
}

func TestHubSendsWelcomeSnapshotOnRegister(t *testing.T) {
	hub := NewHub("snapshot-room")
	shape := testShape("client-1:0")
	hub.scene[shape.ID] = shape
	hub.shapeOwners[shape.ID] = "client-1"
	hub.committed[shape.ID] = true
	hub.locks[shape.ID] = "client-1"
	go hub.Run()

	client := testClient("client-2", hub)
	hub.register <- client

	message := readMessage(t, client)
	if message.Type != "welcome" {
		t.Fatalf("expected welcome message, got %q", message.Type)
	}

	var payload welcomePayload
	decodeTestPayload(t, message, &payload)

	if payload.ClientID != "client-2" || payload.RoomID != "snapshot-room" {
		t.Fatalf("unexpected welcome payload: %+v", payload)
	}
	if len(payload.Scene) != 1 || payload.Scene[0].ID != shape.ID {
		t.Fatalf("expected scene snapshot with shape %q, got %+v", shape.ID, payload.Scene)
	}
	if payload.Locks[shape.ID] != "client-1" {
		t.Fatalf("expected lock snapshot for %q", shape.ID)
	}
}

func TestHubDeniesLockWhenShapeAlreadyLocked(t *testing.T) {
	hub := runningHubWithShape("lock-room")
	first := registerTestClient(t, hub, "client-1")
	second := registerTestClient(t, hub, "client-2")

	sendHubMessage(t, hub, first, "lock:request", lockPayload{ShapeID: "client-1:0"})
	expectMessageType(t, first, "lock:granted")
	expectMessageType(t, second, "lock:granted")

	sendHubMessage(t, hub, second, "lock:request", lockPayload{ShapeID: "client-1:0"})
	message := expectMessageType(t, second, "lock:denied")

	var payload lockPayload
	decodeTestPayload(t, message, &payload)
	if payload.OwnerID != "client-1" {
		t.Fatalf("expected denied lock owner to be client-1, got %q", payload.OwnerID)
	}
}

func TestHubReleasesLocksWhenClientDisconnects(t *testing.T) {
	hub := runningHubWithShape("disconnect-room")
	first := registerTestClient(t, hub, "client-1")
	second := registerTestClient(t, hub, "client-2")

	sendHubMessage(t, hub, first, "lock:request", lockPayload{ShapeID: "client-1:0"})
	expectMessageType(t, first, "lock:granted")
	expectMessageType(t, second, "lock:granted")

	hub.unregister <- first
	message := expectMessageType(t, second, "lock:release")

	var payload lockPayload
	decodeTestPayload(t, message, &payload)
	if payload.ShapeID != "client-1:0" {
		t.Fatalf("expected released lock for client-1:0, got %q", payload.ShapeID)
	}
}

func TestHubAllowsDraftShapeUpdatesUntilCommit(t *testing.T) {
	hub := NewHub("draft-room")
	go hub.Run()
	owner := registerTestClient(t, hub, "client-1")
	other := registerTestClient(t, hub, "client-2")

	draftShape := testShape("client-1:0")
	sendHubMessage(t, hub, owner, "shape:upsert", shapePayload{Shape: draftShape})
	expectMessageType(t, owner, "shape:upsert")
	expectMessageType(t, other, "shape:upsert")

	sendHubMessage(t, hub, other, "lock:request", lockPayload{ShapeID: "client-1:0"})
	expectMessageType(t, other, "lock:denied")

	draftShape.EndPos.X = 120
	sendHubMessage(t, hub, owner, "shape:upsert", shapePayload{Shape: draftShape})
	expectMessageType(t, owner, "shape:upsert")
	expectMessageType(t, other, "shape:upsert")

	draftShape.EndPos.X = 160
	sendHubMessage(t, hub, owner, "shape:upsert", shapePayload{
		Shape:     draftShape,
		Committed: true,
	})
	expectMessageType(t, owner, "shape:upsert")
	expectMessageType(t, other, "shape:upsert")

	draftShape.EndPos.X = 200
	sendHubMessage(t, hub, owner, "shape:upsert", shapePayload{Shape: draftShape})
	expectMessageType(t, owner, "error")
}

func TestHubRejectsExistingShapeUpdateWithoutLock(t *testing.T) {
	hub := runningHubWithShape("update-room")
	owner := registerTestClient(t, hub, "client-1")
	other := registerTestClient(t, hub, "client-2")

	updatedShape := testShape("client-1:0")
	updatedShape.EndPos.X = 200

	sendHubMessage(t, hub, other, "shape:upsert", shapePayload{Shape: updatedShape})
	expectMessageType(t, other, "error")

	sendHubMessage(t, hub, owner, "shape:upsert", shapePayload{Shape: updatedShape})
	expectMessageType(t, owner, "error")

	sendHubMessage(t, hub, owner, "lock:request", lockPayload{ShapeID: "client-1:0"})
	expectMessageType(t, owner, "lock:granted")
	expectMessageType(t, other, "lock:granted")

	sendHubMessage(t, hub, owner, "shape:upsert", shapePayload{Shape: updatedShape})
	expectMessageType(t, owner, "shape:upsert")
	expectMessageType(t, other, "shape:upsert")
}

func runningHubWithShape(roomID string) *Hub {
	hub := NewHub(roomID)
	shape := testShape("client-1:0")
	hub.scene[shape.ID] = shape
	hub.shapeOwners[shape.ID] = "client-1"
	hub.committed[shape.ID] = true
	go hub.Run()
	return hub
}

func registerTestClient(t *testing.T, hub *Hub, id string) *client {
	t.Helper()

	client := testClient(id, hub)
	hub.register <- client
	expectMessageType(t, client, "welcome")
	return client
}

func testClient(id string, hub *Hub) *client {
	return &client{
		id:   id,
		send: make(chan []byte, 16),
		hub:  hub,
	}
}

func testShape(id string) SceneNode {
	return SceneNode{
		ID:       id,
		StartPos: Pos{X: 10, Y: 20},
		EndPos:   Pos{X: 80, Y: 120},
		Shape:    "rect",
	}
}

func sendHubMessage(t *testing.T, hub *Hub, sender *client, messageType string, payload any) {
	t.Helper()

	rawPayload, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}

	hub.inbound <- inboundMessage{
		client: sender,
		message: SocketMessage{
			Type:    messageType,
			Payload: rawPayload,
		},
	}
}

func readMessage(t *testing.T, client *client) testMessage {
	t.Helper()

	select {
	case rawMessage := <-client.send:
		var message testMessage
		if err := json.Unmarshal(rawMessage, &message); err != nil {
			t.Fatalf("failed to unmarshal message %q: %v", string(rawMessage), err)
		}
		return message
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for websocket message")
		return testMessage{}
	}
}

func expectMessageType(t *testing.T, client *client, messageType string) testMessage {
	t.Helper()

	message := readMessage(t, client)
	if message.Type != messageType {
		t.Fatalf("expected message type %q, got %q", messageType, message.Type)
	}
	return message
}

func decodeTestPayload(t *testing.T, message testMessage, target any) {
	t.Helper()

	if err := json.Unmarshal(message.Payload, target); err != nil {
		t.Fatalf("failed to decode %q payload: %v", message.Type, err)
	}
}
