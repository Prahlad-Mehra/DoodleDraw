/*
 If someone reading this , then I'm sorry for not having comments
 because this is not a AI generated SLOP CODE with 🚀✅💡⚒️ comments
*/

import { useEffect, useRef, useState } from "react";
import "./App.css";
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

type InteractionState =
    | {
          kind: "drawing";
          startPos: Pos;
      }
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

function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sceneGraphRef = useRef<Map<string, SceneNode>>(new Map());
    const draftShapeRef = useRef<SceneNode | null>(null);
    const interactionRef = useRef<InteractionState | null>(null);
    const nextShapeIdRef = useRef<number>(0);
    const activeToolRef = useRef<ToolType>("rect");
    const [activeTool, setActiveTool] = useState<ToolType>("rect");
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

    useEffect(() => {
        activeToolRef.current = activeTool;
    }, [activeTool]);

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
                selectedShapeId,
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

        const getPointerPosition = (e: MouseEvent): Pos => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            scheduleRender();
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;

            const pointerPos = getPointerPosition(e);

            if (activeToolRef.current === "select") {
                const shapes = Array.from(sceneGraphRef.current.values());
                const hitShape = getHitShape(shapes, pointerPos);

                if (!hitShape) {
                    setSelectedShapeId(null);
                    interactionRef.current = null;
                    scheduleRender();
                    return;
                }

                setSelectedShapeId(hitShape.id);

                const handle = getShapeHandleAtPoint(hitShape, pointerPos);

                if (handle) {
                    interactionRef.current = {
                        kind: "resizing",
                        shapeId: hitShape.id,
                        handle,
                        originalShape: { ...hitShape },
                    };
                } else {
                    interactionRef.current = {
                        kind: "moving",
                        shapeId: hitShape.id,
                        pointerOffset: {
                            x: pointerPos.x - hitShape.startPos.x,
                            y: pointerPos.y - hitShape.startPos.y,
                        },
                        originalShape: { ...hitShape },
                    };
                }

                scheduleRender();
                return;
            }

            interactionRef.current = {
                kind: "drawing",
                startPos: pointerPos,
            };
            setSelectedShapeId(null);
            draftShapeRef.current = {
                id: `draft-${nextShapeIdRef.current}`,
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

                draftShapeRef.current = {
                    id: `draft-${nextShapeIdRef.current}`,
                    startPos: interaction.startPos,
                    endPos: pointerPos,
                    shape: draftShape.shape,
                };
                scheduleRender();
                return;
            }

            const activeShape = sceneGraphRef.current.get(interaction.shapeId);
            if (!activeShape) return;

            if (interaction.kind === "moving") {
                const width = interaction.originalShape.endPos.x - interaction.originalShape.startPos.x;
                const height = interaction.originalShape.endPos.y - interaction.originalShape.startPos.y;
                const nextStartPos = {
                    x: pointerPos.x - interaction.pointerOffset.x,
                    y: pointerPos.y - interaction.pointerOffset.y,
                };

                sceneGraphRef.current.set(interaction.shapeId, {
                    ...activeShape,
                    startPos: nextStartPos,
                    endPos: {
                        x: nextStartPos.x + width,
                        y: nextStartPos.y + height,
                    },
                });
                scheduleRender();
                return;
            }

            sceneGraphRef.current.set(
                interaction.shapeId,
                resizeShape(interaction.originalShape, interaction.handle, pointerPos),
            );
            scheduleRender();
        };

        const finishShape = (endPos: Pos) => {
            const draftShape = draftShapeRef.current;
            if (!draftShape) return;
            const interaction = interactionRef.current;
            if (!interaction || interaction.kind !== "drawing") return;

            const committedShape: SceneNode = {
                id: `${nextShapeIdRef.current}`,
                startPos: interaction.startPos,
                endPos,
                shape: draftShape.shape,
            };

            sceneGraphRef.current.set(committedShape.id, committedShape);
            nextShapeIdRef.current += 1;
            interactionRef.current = null;
            draftShapeRef.current = null;
            setSelectedShapeId(committedShape.id);
            scheduleRender();
        };

        const handleMouseUp = (e: MouseEvent) => {
            const interaction = interactionRef.current;
            if (!interaction) return;

            if (interaction.kind === "drawing") {
                finishShape(getPointerPosition(e));
                return;
            }

            interactionRef.current = null;
            scheduleRender();
        };

        window.addEventListener("resize", handleResize);
        canvas.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        handleResize();

        return () => {
            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
            window.removeEventListener("resize", handleResize);
            canvas.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [selectedShapeId]);

    return (
        <main className="app-shell">
            <ShapeToolbar activeTool={activeTool} onSelect={setActiveTool} />
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
