/*
 If someone reading this , then I'm sorry for not having comments
 because this is not a AI generated SLOP CODE with 🚀✅💡⚒️ comments
*/

import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import {
    createCollaborationClient,
    getRoomId,
    type CollaborationClient,
    type ServerMessage,
} from "./collaboration";
import { ShapeToolbar } from "./components/ShapeToolbar";
import {
    drawScene,
    getHitShape,
    getShapeHandleAtPoint,
    type Pos,
    type SceneNode,
    type ToolType,
} from "./drawing";

type SelectionHandle =
    | "start"
    | "end"
    | "topLeft"
    | "topRight"
    | "bottomLeft"
    | "bottomRight";

type DrawingInteraction = {
    kind: "drawing";
    shapeId: string;
    startPos: Pos;
};

type SelectionInteraction =
    | {
          kind: "moving";
          shapeId: string;
          pointerOffset: Pos;
          originalShape: SceneNode;
      }
    | {
          kind: "resizing";
          shapeId: string;
          handle: SelectionHandle;
          originalShape: SceneNode;
      };

type InteractionState = DrawingInteraction | SelectionInteraction;

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

const SYNC_THROTTLE_MS = 33;

function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sceneGraphRef = useRef<Map<string, SceneNode>>(new Map());
    const draftShapeRef = useRef<SceneNode | null>(null);
    const interactionRef = useRef<InteractionState | null>(null);
    const pendingLockInteractionRef = useRef<SelectionInteraction | null>(null);
    const nextShapeIdRef = useRef<number>(0);
    const activeToolRef = useRef<ToolType>("rect");
    const selectedShapeIdRef = useRef<string | null>(null);
    const collaborationRef = useRef<CollaborationClient | null>(null);
    const clientIdRef = useRef<string | null>(null);
    const remoteLocksRef = useRef<Map<string, string>>(new Map());
    const scheduleRenderRef = useRef<() => void>(() => undefined);
    const lastSyncAtRef = useRef<number>(0);
    const [activeTool, setActiveTool] = useState<ToolType>("rect");
    const [roomId] = useState(getRoomId);
    const [connectionStatus, setConnectionStatus] =
        useState<ConnectionStatus>("connecting");

    const isShapeInLocalInteraction = useCallback((shapeId: string) => {
        return (
            interactionRef.current?.shapeId === shapeId ||
            draftShapeRef.current?.id === shapeId
        );
    }, []);

    const handleServerMessage = useCallback(
        (message: ServerMessage) => {
            switch (message.type) {
                case "welcome": {
                    clientIdRef.current = message.payload.clientId;
                    sceneGraphRef.current = new Map(
                        message.payload.scene.map((shape) => [shape.id, shape]),
                    );
                    remoteLocksRef.current = new Map(
                        Object.entries(message.payload.locks),
                    );
                    scheduleRenderRef.current();
                    return;
                }
                case "shape:upsert": {
                    if (isShapeInLocalInteraction(message.payload.shape.id)) {
                        return;
                    }

                    sceneGraphRef.current.set(
                        message.payload.shape.id,
                        message.payload.shape,
                    );
                    scheduleRenderRef.current();
                    return;
                }
                case "shape:delete": {
                    sceneGraphRef.current.delete(message.payload.shapeId);
                    if (selectedShapeIdRef.current === message.payload.shapeId) {
                        selectedShapeIdRef.current = null;
                    }
                    scheduleRenderRef.current();
                    return;
                }
                case "lock:granted": {
                    remoteLocksRef.current.set(
                        message.payload.shapeId,
                        message.payload.ownerId || "",
                    );

                    if (message.payload.ownerId !== clientIdRef.current) {
                        return;
                    }

                    const pending = pendingLockInteractionRef.current;
                    if (pending?.shapeId === message.payload.shapeId) {
                        interactionRef.current = pending;
                        pendingLockInteractionRef.current = null;
                        return;
                    }

                    collaborationRef.current?.send({
                        type: "lock:release",
                        payload: { shapeId: message.payload.shapeId },
                    });
                    return;
                }
                case "lock:denied": {
                    remoteLocksRef.current.set(
                        message.payload.shapeId,
                        message.payload.ownerId || "",
                    );

                    if (
                        pendingLockInteractionRef.current?.shapeId ===
                        message.payload.shapeId
                    ) {
                        pendingLockInteractionRef.current = null;
                        interactionRef.current = null;
                        scheduleRenderRef.current();
                    }
                    return;
                }
                case "lock:release": {
                    remoteLocksRef.current.delete(message.payload.shapeId);
                    return;
                }
                case "error": {
                    console.warn(
                        "WebSocket server error:",
                        message.payload.message,
                    );
                    return;
                }
            }
        },
        [isShapeInLocalInteraction],
    );

    useEffect(() => {
        activeToolRef.current = activeTool;
    }, [activeTool]);

    useEffect(() => {
        const client = createCollaborationClient({
            roomId,
            onStatusChange: setConnectionStatus,
            onMessage: (message) => {
                handleServerMessage(message);
            },
        });

        collaborationRef.current = client;

        return () => {
            collaborationRef.current = null;
            client.close();
        };
    }, [handleServerMessage, roomId]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let frameId = 0;
        let framePending = false;

        const render = () => {
            drawScene({
                ctx,
                width: canvas.width,
                height: canvas.height,
                shapes: sceneGraphRef.current.values(),
                draftShape: draftShapeRef.current,
                selectedShapeId: selectedShapeIdRef.current,
            });
        };

        const scheduleRender = () => {
            if (framePending) return;
            framePending = true;

            frameId = window.requestAnimationFrame(() => {
                framePending = false;
                render();
            });
        };

        scheduleRenderRef.current = scheduleRender;

        const setSelectedShape = (shapeId: string | null) => {
            selectedShapeIdRef.current = shapeId;
            scheduleRender();
        };

        const getPointerPosition = (e: MouseEvent): Pos => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        const sendShapeUpsert = (
            shape: SceneNode,
            force = false,
            committed = true,
        ) => {
            const now = performance.now();
            if (!force && now - lastSyncAtRef.current < SYNC_THROTTLE_MS) {
                return;
            }

            lastSyncAtRef.current = now;
            collaborationRef.current?.send({
                type: "shape:upsert",
                payload: { shape, committed },
            });
        };

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            scheduleRender();
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            if (!clientIdRef.current) return;

            const pointerPos = getPointerPosition(e);

            if (activeToolRef.current === "select") {
                const shapes = Array.from(sceneGraphRef.current.values());
                const hitShape = getHitShape(shapes, pointerPos);

                if (!hitShape) {
                    setSelectedShape(null);
                    interactionRef.current = null;
                    pendingLockInteractionRef.current = null;
                    return;
                }

                setSelectedShape(hitShape.id);

                const handle = getShapeHandleAtPoint(hitShape, pointerPos);
                const nextInteraction: SelectionInteraction = handle
                    ? {
                          kind: "resizing",
                          shapeId: hitShape.id,
                          handle,
                          originalShape: { ...hitShape },
                      }
                    : {
                          kind: "moving",
                          shapeId: hitShape.id,
                          pointerOffset: {
                              x: pointerPos.x - hitShape.startPos.x,
                              y: pointerPos.y - hitShape.startPos.y,
                          },
                          originalShape: { ...hitShape },
                      };

                pendingLockInteractionRef.current = nextInteraction;
                interactionRef.current = null;
                collaborationRef.current?.send({
                    type: "lock:request",
                    payload: { shapeId: hitShape.id },
                });
                scheduleRender();
                return;
            }

            const shapeId = `${clientIdRef.current}:${nextShapeIdRef.current}`;
            nextShapeIdRef.current += 1;

            interactionRef.current = {
                kind: "drawing",
                shapeId,
                startPos: pointerPos,
            };
            setSelectedShape(null);
            draftShapeRef.current = {
                id: shapeId,
                startPos: pointerPos,
                endPos: pointerPos,
                shape: activeToolRef.current,
            };
            scheduleRender();
        };

        const handleMouseMove = (e: MouseEvent) => {
            const interaction = interactionRef.current;
            if (!interaction) return;

            const pointerPos = getPointerPosition(e);

            if (interaction.kind === "drawing") {
                const draftShape = draftShapeRef.current;
                if (!draftShape) return;

                const nextDraft = {
                    id: interaction.shapeId,
                    startPos: interaction.startPos,
                    endPos: pointerPos,
                    shape: draftShape.shape,
                };

                draftShapeRef.current = nextDraft;
                sendShapeUpsert(nextDraft, false, false);
                scheduleRender();
                return;
            }

            const activeShape = sceneGraphRef.current.get(interaction.shapeId);
            if (!activeShape) return;

            if (interaction.kind === "moving") {
                const width =
                    interaction.originalShape.endPos.x -
                    interaction.originalShape.startPos.x;
                const height =
                    interaction.originalShape.endPos.y -
                    interaction.originalShape.startPos.y;
                const nextStartPos = {
                    x: pointerPos.x - interaction.pointerOffset.x,
                    y: pointerPos.y - interaction.pointerOffset.y,
                };
                const nextShape = {
                    ...activeShape,
                    startPos: nextStartPos,
                    endPos: {
                        x: nextStartPos.x + width,
                        y: nextStartPos.y + height,
                    },
                };

                sceneGraphRef.current.set(interaction.shapeId, nextShape);
                sendShapeUpsert(nextShape);
                scheduleRender();
                return;
            }

            const nextShape = resizeShape(
                interaction.originalShape,
                interaction.handle,
                pointerPos,
            );
            sceneGraphRef.current.set(interaction.shapeId, nextShape);
            sendShapeUpsert(nextShape);
            scheduleRender();
        };

        const finishShape = (endPos: Pos) => {
            const draftShape = draftShapeRef.current;
            if (!draftShape) return;
            const interaction = interactionRef.current;
            if (!interaction || interaction.kind !== "drawing") return;

            const committedShape: SceneNode = {
                id: interaction.shapeId,
                startPos: interaction.startPos,
                endPos,
                shape: draftShape.shape,
            };

            sceneGraphRef.current.set(committedShape.id, committedShape);
            interactionRef.current = null;
            draftShapeRef.current = null;
            setSelectedShape(committedShape.id);
            sendShapeUpsert(committedShape, true);
            scheduleRender();
        };

        const handleMouseUp = (e: MouseEvent) => {
            const interaction = interactionRef.current;

            if (!interaction) {
                pendingLockInteractionRef.current = null;
                return;
            }

            if (interaction.kind === "drawing") {
                finishShape(getPointerPosition(e));
                return;
            }

            const shape = sceneGraphRef.current.get(interaction.shapeId);
            if (shape) {
                sendShapeUpsert(shape, true);
            }

            collaborationRef.current?.send({
                type: "lock:release",
                payload: { shapeId: interaction.shapeId },
            });
            interactionRef.current = null;
            pendingLockInteractionRef.current = null;
            scheduleRender();
        };

        window.addEventListener("resize", handleResize);
        canvas.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        handleResize();

        return () => {
            scheduleRenderRef.current = () => undefined;
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            window.removeEventListener("resize", handleResize);
            canvas.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    return (
        <main className="app-shell">
            <ShapeToolbar activeTool={activeTool} onSelect={setActiveTool} />
            <div className="collaboration-status">
                Room: {roomId} | {connectionStatus}
            </div>
            <canvas
                ref={canvasRef}
                className={`drawing-canvas${
                    activeTool === "select" ? " is-selecting" : ""
                }`}
            />
        </main>
    );
}

export default App;

function resizeShape(
    shape: SceneNode,
    handle: SelectionHandle,
    pointerPos: Pos,
): SceneNode {
    switch (handle) {
        case "start":
            return { ...shape, startPos: pointerPos };
        case "end":
            return { ...shape, endPos: pointerPos };
        case "topLeft":
            return {
                ...shape,
                startPos: pointerPos,
            };
        case "topRight":
            return {
                ...shape,
                startPos: { x: shape.startPos.x, y: pointerPos.y },
                endPos: { x: pointerPos.x, y: shape.endPos.y },
            };
        case "bottomLeft":
            return {
                ...shape,
                startPos: { x: pointerPos.x, y: shape.startPos.y },
                endPos: { x: shape.endPos.x, y: pointerPos.y },
            };
        case "bottomRight":
            return {
                ...shape,
                endPos: pointerPos,
            };
    }
}
