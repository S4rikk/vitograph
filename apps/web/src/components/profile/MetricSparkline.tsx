"use client";

import { useMemo } from "react";

interface SparklineProps {
    /** Array of data points, ordered oldest → newest. Each point = number. */
    points: number[];
    /** Width of the SVG in pixels. Default: 200 */
    width?: number;
    /** Height of the SVG in pixels. Default: 32 */
    height?: number;
    /** Stroke color for the line. Default: "var(--color-primary-500)" */
    strokeColor?: string;
    /** Fill gradient start color (top). Default: "var(--color-primary-200)" */
    gradientStartColor?: string;
    /** Fill gradient end color (bottom, transparent). Default: transparent */
    gradientEndColor?: string;
}

export default function MetricSparkline({
    points,
    width = 200,
    height = 32,
    strokeColor = "var(--color-primary-500)",
    gradientStartColor = "var(--color-primary-200)",
    gradientEndColor = "rgba(20,184,166,0)",
}: SparklineProps) {
    const pathData = useMemo(() => {
        if (points.length < 2) return { line: "", area: "" };

        const minVal = Math.min(...points);
        const maxVal = Math.max(...points);
        const range = maxVal - minVal || 1; // Avoid division by zero

        const padding = 2; // px padding inside SVG
        const usableWidth = width - padding * 2;
        const usableHeight = height - padding * 2;

        const coords = points.map((val, i) => {
            const x = padding + (i / (points.length - 1)) * usableWidth;
            const y = padding + (1 - (val - minVal) / range) * usableHeight;
            return { x, y };
        });

        // Build SVG path string with smooth curves (catmull-rom → cubic bezier)
        let line = `M ${coords[0].x},${coords[0].y}`;
        for (let i = 1; i < coords.length; i++) {
            const prev = coords[i - 1];
            const curr = coords[i];
            const cpX = (prev.x + curr.x) / 2;
            line += ` C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`;
        }

        // Area path: same line + close to bottom
        const lastCoord = coords[coords.length - 1];
        const firstCoord = coords[0];
        const area = `${line} L ${lastCoord.x},${height} L ${firstCoord.x},${height} Z`;

        return { line, area };
    }, [points, width, height]);

    if (points.length < 2) return null;

    const gradientId = `sparkline-grad-${width}-${height}`;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block w-full"
            style={{ height: `${height}px` }}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={gradientStartColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={gradientEndColor} stopOpacity={0} />
                </linearGradient>
            </defs>
            {/* Gradient fill under the line */}
            <path d={pathData.area} fill={`url(#${gradientId})`} />
            {/* The line itself */}
            <path
                d={pathData.line}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
