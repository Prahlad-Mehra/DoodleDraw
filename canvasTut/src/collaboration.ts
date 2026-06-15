import type { SceneNode } from "./drawing";

type WelcomePayload = {
    clientId: string;
    roomId: string;
    scene: SceneNode[];
    locks: Record<string, string>;
};

type ShapePayload = {
    shape: SceneNode;
    committed?: boolean;
};

type ShapeDeletePayload = {
    shapeId: string;
};

type LockPayload = {
    shapeId: string;
    ownerId?: string;
};

type ErrorPayload = {
    message: string;
};

export type ServerMessage =
    | { type: "welcome"; payload: WelcomePayload }
    | { type: "shape:upsert"; payload: ShapePayload }
    | { type: "shape:delete"; payload: ShapeDeletePayload }
    | { type: "lock:granted"; payload: LockPayload }
    | { type: "lock:denied"; payload: LockPayload }
    | { type: "lock:release"; payload: LockPayload }
    | { type: "error"; payload: ErrorPayload };

export type ClientMessage =
    | { type: "shape:upsert"; payload: ShapePayload }
    | { type: "shape:delete"; payload: ShapeDeletePayload }
    | { type: "lock:request"; payload: Pick<LockPayload, "shapeId"> }
    | { type: "lock:release"; payload: Pick<LockPayload, "shapeId"> };

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

type CollaborationClientOptions = {
    roomId: string;
    onMessage: (message: ServerMessage) => void;
    onStatusChange: (status: ConnectionStatus) => void;
};

export type CollaborationClient = {
    close: () => void;
    send: (message: ClientMessage) => boolean;
};

export function getRoomId() {
    return new URLSearchParams(window.location.search).get("room") || "default";
}

export function createCollaborationClient({
    roomId,
    onMessage,
    onStatusChange,
}: CollaborationClientOptions): CollaborationClient {
    const socket = new WebSocket(getWebSocketUrl(roomId));

    onStatusChange("connecting");

    socket.addEventListener("open", () => {
        onStatusChange("connected");
    });

    socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;

        try {
            onMessage(JSON.parse(event.data) as ServerMessage);
        } catch (error) {
            console.error("Failed to parse websocket message", error);
        }
    });

    socket.addEventListener("close", () => {
        onStatusChange("disconnected");
    });

    socket.addEventListener("error", () => {
        onStatusChange("error");
    });

    return {
        close: () => socket.close(),
        send: (message) => {
            if (socket.readyState !== WebSocket.OPEN) {
                return false;
            }

            socket.send(JSON.stringify(message));
            return true;
        },
    };
}

function getWebSocketUrl(roomId: string) {
    const configuredUrl = import.meta.env.VITE_WS_URL;
    const baseUrl =
        configuredUrl ||
        `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
            window.location.hostname
        }:3000/ws`;

    const url = new URL(baseUrl);
    url.searchParams.set("room", roomId);
    return url.toString();
}
