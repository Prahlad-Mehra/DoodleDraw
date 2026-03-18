export type ShapeType = "rect" | "oval" | "arrow" | "line";

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
};

export function drawScene({
    ctx,
    width,
    height,
    shapes,
    draftShape,
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
    }

    if (draftShape) {
        drawShape(ctx, draftShape);
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
