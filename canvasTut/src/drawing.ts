export type ShapeType = "rect" | "oval" | "arrow" | "line";
export type ToolType = ShapeType | "select";

export type Pos = {
    x: number;
    y: number;
};

export type SceneNode = {
    id: string;
    startPos: Pos;
    endPos: Pos;
    shape: ShapeType;
};

type DrawSceneArgs = {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    shapes: Iterable<SceneNode>;
    draftShape: SceneNode | null;
    selectedShapeId: string | null;
};

export type Bounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

const HIT_TOLERANCE = 10;
const HANDLE_SIZE = 10;

export function drawScene({
    ctx,
    width,
    height,
    shapes,
    draftShape,
    selectedShapeId,
}: DrawSceneArgs) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#121212";
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "white";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const shape of shapes) {
        drawShape(ctx, shape);

        if (shape.id === selectedShapeId) {
            drawSelectionOutline(ctx, shape);
        }
    }

    if (draftShape) {
        drawShape(ctx, draftShape);
    }
}

export function getShapeBounds(shape: SceneNode): Bounds {
    return {
        left: Math.min(shape.startPos.x, shape.endPos.x),
        right: Math.max(shape.startPos.x, shape.endPos.x),
        top: Math.min(shape.startPos.y, shape.endPos.y),
        bottom: Math.max(shape.startPos.y, shape.endPos.y),
    };
}

export function getResizeHandles(shape: SceneNode) {
    const bounds = getShapeBounds(shape);

    return {
        start: { x: shape.startPos.x, y: shape.startPos.y },
        end: { x: shape.endPos.x, y: shape.endPos.y },
        topLeft: { x: bounds.left, y: bounds.top },
        topRight: { x: bounds.right, y: bounds.top },
        bottomLeft: { x: bounds.left, y: bounds.bottom },
        bottomRight: { x: bounds.right, y: bounds.bottom },
    };
}

export function getHitShape(
    shapes: SceneNode[],
    pos: Pos,
): SceneNode | null {
    for (let index = shapes.length - 1; index >= 0; index -= 1) {
        if (isPointInsideShape(shapes[index], pos)) {
            return shapes[index];
        }
    }

    return null;
}

export function getShapeHandleAtPoint(
    shape: SceneNode,
    pos: Pos,
): "start" | "end" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | null {
    const handles = getResizeHandles(shape);

    for (const [name, handlePos] of Object.entries(handles)) {
        if (
            Math.abs(pos.x - handlePos.x) <= HANDLE_SIZE &&
            Math.abs(pos.y - handlePos.y) <= HANDLE_SIZE
        ) {
            return name as
                | "start"
                | "end"
                | "topLeft"
                | "topRight"
                | "bottomLeft"
                | "bottomRight";
        }
    }

    return null;
}

function isPointInsideShape(shape: SceneNode, pos: Pos) {
    switch (shape.shape) {
        case "rect":
        case "oval":
            return isPointInsideBounds(getShapeBounds(shape), pos);
        case "line":
        case "arrow":
            return distanceToSegment(pos, shape.startPos, shape.endPos) <= HIT_TOLERANCE;
    }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: SceneNode) {
    switch (shape.shape) {
        case "rect":
            drawRect(ctx, shape);
            return;
        case "oval":
            drawOval(ctx, shape);
            return;
        case "line":
            drawLine(ctx, shape);
            return;
        case "arrow":
            drawArrow(ctx, shape);
            return;
    }
}

function drawRect(ctx: CanvasRenderingContext2D, shape: SceneNode) {
    const width = shape.endPos.x - shape.startPos.x;
    const height = shape.endPos.y - shape.startPos.y;
    ctx.strokeRect(shape.startPos.x, shape.startPos.y, width, height);
}

function drawOval(ctx: CanvasRenderingContext2D, shape: SceneNode) {
    const centerX = (shape.startPos.x + shape.endPos.x) / 2;
    const centerY = (shape.startPos.y + shape.endPos.y) / 2;
    const radiusX = Math.abs(shape.endPos.x - shape.startPos.x) / 2;
    const radiusY = Math.abs(shape.endPos.y - shape.startPos.y) / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
}

function drawLine(ctx: CanvasRenderingContext2D, shape: SceneNode) {
    ctx.beginPath();
    ctx.moveTo(shape.startPos.x, shape.startPos.y);
    ctx.lineTo(shape.endPos.x, shape.endPos.y);
    ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, shape: SceneNode) {
    const angle = Math.atan2(
        shape.endPos.y - shape.startPos.y,
        shape.endPos.x - shape.startPos.x,
    );
    const headLength = 18;

    drawLine(ctx, shape);

    ctx.beginPath();
    ctx.moveTo(shape.endPos.x, shape.endPos.y);
    ctx.lineTo(
        shape.endPos.x - headLength * Math.cos(angle - Math.PI / 6),
        shape.endPos.y - headLength * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(shape.endPos.x, shape.endPos.y);
    ctx.lineTo(
        shape.endPos.x - headLength * Math.cos(angle + Math.PI / 6),
        shape.endPos.y - headLength * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
}

function drawSelectionOutline(ctx: CanvasRenderingContext2D, shape: SceneNode) {
    const bounds = getShapeBounds(shape);
    const handles = getResizeHandles(shape);

    ctx.save();
    ctx.strokeStyle = "#4da3ff";
    ctx.fillStyle = "#4da3ff";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
        bounds.left - 6,
        bounds.top - 6,
        bounds.right - bounds.left + 12,
        bounds.bottom - bounds.top + 12,
    );
    ctx.setLineDash([]);

    const visibleHandles =
        shape.shape === "rect" || shape.shape === "oval"
            ? [
                  handles.topLeft,
                  handles.topRight,
                  handles.bottomLeft,
                  handles.bottomRight,
              ]
            : [handles.start, handles.end];

    for (const handle of visibleHandles) {
        ctx.fillRect(
            handle.x - HANDLE_SIZE / 2,
            handle.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE,
        );
    }

    ctx.restore();
}

function isPointInsideBounds(bounds: Bounds, pos: Pos) {
    return (
        pos.x >= bounds.left - HIT_TOLERANCE &&
        pos.x <= bounds.right + HIT_TOLERANCE &&
        pos.y >= bounds.top - HIT_TOLERANCE &&
        pos.y <= bounds.bottom + HIT_TOLERANCE
    );
}

function distanceToSegment(point: Pos, start: Pos, end: Pos) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx === 0 && dy === 0) {
        return Math.hypot(point.x - start.x, point.y - start.y);
    }

    const t = Math.max(
        0,
        Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                (dx * dx + dy * dy),
        ),
    );

    const projection = {
        x: start.x + t * dx,
        y: start.y + t * dy,
    };

    return Math.hypot(point.x - projection.x, point.y - projection.y);
}
