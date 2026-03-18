/*
 If someone reading this , then I'm sorry for not having comments
 because this is not AI generated SLOP CODE with 🚀✅💡⚒️ comments
*/

import { useEffect, useRef, useState } from "react";
import "./App.css";
import { ShapeToolbar } from "./components/ShapeToolbar";
import { drawScene, type Pos, type SceneNode, type ShapeType } from "./drawing";

function App() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const sceneGraphRef = useRef<Map<string, SceneNode>>(new Map());
    const draftShapeRef = useRef<SceneNode | null>(null);
    const dragStartRef = useRef<Pos | null>(null);
    const nextShapeIdRef = useRef<number>(0);
    const activeToolRef = useRef<ShapeType>("rect");
    const [activeTool, setActiveTool] = useState<ShapeType>("rect");

    

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

            const startPos = getPointerPosition(e);
            dragStartRef.current = startPos;
            draftShapeRef.current = {
                id: `draft-${nextShapeIdRef.current}`,
                startPos,
                endPos: startPos,
                shape: activeToolRef.current,
            };
            scheduleRender();
        };

        const handleMouseMove = (e: MouseEvent) => {
            const startPos = dragStartRef.current;
            const draftShape = draftShapeRef.current;
            if (!startPos) return;
            if (!draftShape) return;

            draftShapeRef.current = {
                id: `draft-${nextShapeIdRef.current}`,
                startPos,
                endPos: getPointerPosition(e),
                shape: draftShape.shape,
            };
            scheduleRender();
        };

        const finishShape = (endPos: Pos) => {
            const startPos = dragStartRef.current;
            const draftShape = draftShapeRef.current;
            if (!startPos) return;
            if (!draftShape) return;

            const committedShape: SceneNode = {
                id: `${nextShapeIdRef.current}`,
                startPos,
                endPos,
                shape: draftShape.shape,
            };

            sceneGraphRef.current.set(committedShape.id, committedShape);
            nextShapeIdRef.current += 1;
            dragStartRef.current = null;
            draftShapeRef.current = null;
            scheduleRender();
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!dragStartRef.current) return;
            finishShape(getPointerPosition(e));
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
    }, []);

    return (
        <main className="app-shell">
            <ShapeToolbar activeTool={activeTool} onSelect={setActiveTool} />
            <canvas ref={canvasRef} className="drawing-canvas" />
        </main>
    );
}

export default App;
