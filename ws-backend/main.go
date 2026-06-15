package main

import (
	"fmt"
	"log"
	"net/http"
	"net/url"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     checkOrigin,
}

func greet(w http.ResponseWriter, r *http.Request) {
	log.Println("[LOG] new requset came")
	w.Header().Set("content-type", "application/json")
	msg := []byte(`{"name":"Prahlad Mehra","Age":20,"email":"prahladmehra98@gmail.com"}`)
	w.Write(msg)
}

func main() {
	fmt.Println("ws-server starting at port:3000")

	roomManager := NewRoomManager()

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "index.html")
	})
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		roomID := r.URL.Query().Get("room")
		hub := roomManager.Get(roomID)
		SocketHandler(hub, w, r)
	})

	server := &http.Server{
		Addr:    ":3000",
		Handler: mux,
	}
	if err := server.ListenAndServe(); err != nil {
		panic(err)
	}
}

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}

	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}

	originHost := parsed.Host
	if originHost == r.Host {
		return true
	}

	allowedDevOrigins := map[string]bool{
		"localhost:5173": true,
		"127.0.0.1:5173": true,
		"localhost:3000": true,
		"127.0.0.1:3000": true,
	}
	return allowedDevOrigins[originHost]
}
