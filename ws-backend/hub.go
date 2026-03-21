package main

type Hub struct {
	//registered clients
	clients map[*client]bool
	//register the new client to the hub
	register chan *client
	//Unregsiter the client from the hub
	unregister chan *client
	//Inbound message from the clients
	brodcast chan *Message
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*client]bool),
		register:   make(chan *client),
		unregister: make(chan *client),
		brodcast:   make(chan *Message),
	}
}

// The hub will run all the time as a goroutine for each Room. To put it simply one room = one hub, and for each hub we have goroutine
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.clients[c] = true

		case c := <-h.unregister:
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}

		case m := <-h.brodcast:
			for client := range h.clients {
				if client.conn == m.conn {
					continue
				}
				select {
				case client.send <- m.msg:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}
