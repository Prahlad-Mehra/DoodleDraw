package main

import "github.com/gorilla/websocket"

type client struct{
	conn *websocket.Conn
	send chan []byte
	hub *Hub
}