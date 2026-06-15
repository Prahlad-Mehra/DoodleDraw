package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

var (
	writeWait    = 10 * time.Second
	pongWait     = 60 * time.Second
	pingPeriod   = (pongWait * 9) / 10
	maxMessageSz = int64(1 << 20)
	clientSeq    uint64
)

type client struct {
	id   string
	conn *websocket.Conn
	send chan []byte
	hub  *Hub
}

func nextClientID() string {
	id := atomic.AddUint64(&clientSeq, 1)
	return "client-" + strconv.FormatUint(id, 10)
}

func SocketHandler(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "internal serve error", http.StatusInternalServerError)
		log.Println("[ERROR]", err)
		return
	}
	//log about new connection
	log.Println("[LOG] New websocket connection!")
	//cretae the new client and register to its hub
	client := &client{
		id:   nextClientID(),
		conn: conn,
		send: make(chan []byte, 256),
		hub:  hub,
	}
	hub.register <- client

	//spin-up the readPump and writePump goroutines for this client
	go client.readPump()
	go client.writePump()
}

func (c *client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSz)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})
	for {
		_, payload, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		var message SocketMessage
		if err := json.Unmarshal(payload, &message); err != nil {
			c.hub.sendError(c, "invalid json message")
			continue
		}
		c.hub.inbound <- inboundMessage{client: c, message: message}
	}
}

func (c *client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
