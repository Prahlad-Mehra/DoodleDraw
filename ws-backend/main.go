package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func greet(w http.ResponseWriter, r *http.Request) {
	log.Println("[LOG] new requset came")
	w.Header().Set("content-type", "application/json")
	msg := []byte(`{"name":"Prahlad Mehra","Age":20,"email":"prahladmehra98@gmail.com"}`)
	w.Write(msg)
}

func main() {
	fmt.Println("ws-server starting at port:3000")

	//creating a new demo hub and running it in a saperate goroutine
	hub := NewHub()
	go hub.Run()

	mux := http.NewServeMux()
	mux.HandleFunc("/", greet)
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		//we need to validate and check which hub this client belongs to and also validate if it has a password for hub or not.

		//here pass the hub , w responseWriter and r *http.Request
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
