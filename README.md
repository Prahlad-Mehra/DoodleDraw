# DoodleDraw

DoodleDraw is a real-time collaborative drawing app. The frontend is a
React/Vite canvas app, and the backend is a Go WebSocket server that keeps room
state, broadcasts shape changes, and coordinates edit locks between connected
clients.

## Features

- Draw rectangles, ovals, arrows, and lines on a full-screen canvas.
- Select, move, and resize existing shapes.
- Collaborate in shared rooms using WebSockets.
- Join different rooms with the `?room=` query parameter.
- Receive the current scene and active locks when joining a room.
- Prevent conflicting edits with per-shape lock requests.

## Project Structure

```text
DoodleDraw/
|-- canvasTut/      # React + TypeScript + Vite frontend
|-- ws-backend/     # Go WebSocket backend
`-- README.md
```

## Prerequisites

- Node.js and npm
- Go 1.25.2 or newer

## Getting Started

Run the backend and frontend in separate terminals.

### 1. Start the WebSocket Backend

```sh
cd ws-backend
go run .
```

The backend listens on `http://localhost:3000` and exposes:

- `GET /` - serves the backend test page from `ws-backend/index.html`
- `GET /ws?room=<room-id>` - opens a WebSocket connection for a room

If `room` is omitted or blank, the server uses the `default` room.

### 2. Start the Frontend

```sh
cd canvasTut
npm install
npm run dev
```

Open the Vite dev URL, usually `http://localhost:5173`.

To collaborate in a named room, open the same room URL in multiple tabs or
browsers:

```text
http://localhost:5173/?room=design-room
```

## Configuration

By default, the frontend connects to:

```text
ws://<current-hostname>:3000/ws
```

You can override the backend WebSocket URL with `VITE_WS_URL`:

```sh
VITE_WS_URL=ws://localhost:3000/ws npm run dev
```

The frontend appends the current room as a `room` query parameter.

## Development Commands

Frontend commands are run from `canvasTut/`:

```sh
npm run dev      # start Vite
npm run build    # type-check and build
npm run lint     # run ESLint
npm run preview  # preview the production build
```

Backend commands are run from `ws-backend/`:

```sh
go run .         # start the WebSocket server
go test ./...    # run backend tests
```

## Collaboration Protocol

Client messages sent to the backend:

- `shape:upsert` - create, update, or commit a shape
- `shape:delete` - delete a shape
- `lock:request` - request edit ownership for an existing committed shape
- `lock:release` - release edit ownership

Server messages sent to clients:

- `welcome` - initial client id, room id, scene snapshot, and active locks
- `shape:upsert` - broadcast a created or updated shape
- `shape:delete` - broadcast a deleted shape id
- `lock:granted` - broadcast lock ownership for a shape
- `lock:denied` - tell a client that a lock request failed
- `lock:release` - broadcast that a shape lock was released
- `error` - report invalid or rejected client messages

Shapes use this JSON structure:

```json
{
  "id": "client-1:0",
  "startPos": { "x": 10, "y": 20 },
  "endPos": { "x": 100, "y": 120 },
  "shape": "rect"
}
```

Supported shape values are `rect`, `oval`, `arrow`, and `line`.

## How Collaboration Works

When a client joins a room, the server sends a `welcome` message containing the
current scene and active shape locks. New shapes can stream draft updates while
they are being drawn. Once committed, existing shapes require a lock before they
can be moved, resized, or deleted.

Rooms are in-memory and live only for the lifetime of the backend process.
