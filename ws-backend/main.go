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

func socketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "internal serve error", http.StatusInternalServerError)
		log.Println("[ERROR]", err)
	}
	defer conn.Close()
	//log about new connection
	log.Println("[LOG] New websocket connection!")

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			log.Println("[ERROR] error while reading message, err=", err)
			break
		}

		msg := string(payload)
		log.Printf("[Message] %s", msg)

		//writing back to the websocket connection
		err = conn.WriteMessage(1, []byte("pong"))
		if err != nil {
			log.Println("[Error] not able to send message, err=", err)
			break
		}
	}
}

func main() {
	fmt.Println("Hello ws-server!")

	mux := http.NewServeMux()
	mux.HandleFunc("/", greet)
	mux.HandleFunc("/ws", socketHandler)

	server := &http.Server{
		Addr:    ":3000",
		Handler: mux,
	}
	if err := server.ListenAndServe(); err != nil {
		panic(err)
	}
}
