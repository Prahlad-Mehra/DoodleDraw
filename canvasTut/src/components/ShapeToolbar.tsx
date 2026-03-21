import type { ReactNode } from "react";
import { type ToolType } from "../drawing";

type ShapeToolbarProps = {
    activeTool: ToolType;
    onSelect: (tool: ToolType) => void;
};

const TOOL_OPTIONS: Array<{
    label: string;
    value: ToolType;
    icon: ReactNode;
}> = [
    {
        label: "Select",
        value: "select",
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                    d="M5 3.5v15l4.5-4 3 6 2.3-1.2-3-6H18L5 3.5Z"
                    fill="currentColor"
                />
            </svg>
        ),
    },
    {
        label: "Rectangle",
        value: "rect",
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect
                    x="5"
                    y="6"
                    width="14"
                    height="11"
                    rx="1.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                />
            </svg>
        ),
    },
    {
        label: "Oval",
        value: "oval",
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <ellipse
                    cx="12"
                    cy="12"
                    rx="7"
                    ry="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                />
            </svg>
        ),
    },
    {
        label: "Arrow",
        value: "arrow",
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                    d="M5 17 18 7M13 7h5v5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        ),
    },
    {
        label: "Line",
        value: "line",
        icon: (
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                    d="M5 17 19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>
        ),
    },
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
                    <span className="shape-toolbar__icon">{tool.icon}</span>
                    <span>{tool.label}</span>
                </button>
            ))}
        </div>
    );
}
