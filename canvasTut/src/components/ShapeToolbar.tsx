import { type ShapeType } from "../drawing";

type ShapeToolbarProps = {
    activeTool: ShapeType;
    onSelect: (tool: ShapeType) => void;
};

const TOOL_OPTIONS: Array<{ label: string; value: ShapeType }> = [
    { label: "Rectangle", value: "rect" },
    { label: "Oval", value: "oval" },
    { label: "Arrow", value: "arrow" },
    { label: "Line", value: "line" },
];

export function ShapeToolbar({ activeTool, onSelect }: ShapeToolbarProps) {
    return (
        <div className="shape-toolbar" aria-label="Shape tools">
            {TOOL_OPTIONS.map((tool) => (
                <button
                    key={tool.value}
                    type="button"
                    className={`shape-toolbar__button${
                        activeTool === tool.value ? " is-active" : ""
                    }`}
                    onClick={() => onSelect(tool.value)}
                    aria-pressed={activeTool === tool.value}
                >
                    {tool.label}
                </button>
            ))}
        </div>
    );
}
