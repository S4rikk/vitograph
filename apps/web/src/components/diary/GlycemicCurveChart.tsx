"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { GlycemicTimelinePoint, GlycemicMealMarker } from "@/lib/api-client";
import { getEmojiForFood } from "./FoodCard";

interface GlycemicCurveChartProps {
  timeline: GlycemicTimelinePoint[];
  meals: GlycemicMealMarker[];
  baseline: number;
}

const Y_MIN = 40;
const Y_MAX = 200;
const SVG_W = 720;
const SVG_H = 200;
const MAX_MIN = 1440;

/** Maps glucose (mg/dl) → SVG Y coordinate */
const toY = (glucose: number): number =>
  SVG_H - ((Math.min(Math.max(glucose, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * SVG_H;

/** Maps time (min of day) → SVG X coordinate */
const toX = (timeMin: number): number => (timeMin / MAX_MIN) * SVG_W;

/** Zone background rect configs */
const ZONE_BANDS = [
  { yStart: Y_MIN, yEnd: 70, fill: "rgba(59, 130, 246, 0.06)" },   // blue: hypo
  { yStart: 70, yEnd: 110, fill: "rgba(16, 185, 129, 0.08)" },      // green: optimal
  { yStart: 110, yEnd: 140, fill: "rgba(245, 158, 11, 0.06)" },     // yellow: elevated
  { yStart: 140, yEnd: Y_MAX, fill: "rgba(239, 68, 68, 0.06)" },    // red: spike
];

const HOUR_LABELS = ["00:00", "06:00", "12:00", "18:00", "24:00"];
const HOUR_POSITIONS = [0, 360, 720, 1080, 1440];

export default function GlycemicCurveChart({ timeline, meals, baseline }: GlycemicCurveChartProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);

  // Build SVG path from timeline data
  const { curvePath, areaPath } = useMemo(() => {
    if (!timeline || timeline.length === 0) return { curvePath: "", areaPath: "" };

    const points = timeline.map((p) => ({
      x: toX(p.time_min),
      y: toY(p.glucose_mg_dl),
    }));

    const curveD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");

    // Area: close the path at the bottom
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const areaD = `${curveD} L ${lastPoint.x} ${SVG_H} L ${firstPoint.x} ${SVG_H} Z`;

    return { curvePath: curveD, areaPath: areaD };
  }, [timeline]);

  // Animate stroke drawing
  useEffect(() => {
    const path = pathRef.current;
    if (!path || !curvePath) return;

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    // Force reflow
    path.getBoundingClientRect();

    requestAnimationFrame(() => {
      path.style.transition = "stroke-dashoffset 1.5s ease-out";
      path.style.strokeDashoffset = "0";
      setIsAnimated(true);
    });
  }, [curvePath]);

  // Current time marker
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowX = toX(nowMin);

  // Compute gradient stops based on zone distribution
  const gradientId = "glycemic-curve-gradient";
  const gradientStops = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    return timeline.map((p) => {
      const offset = (p.time_min / MAX_MIN) * 100;
      const colorMap: Record<string, string> = {
        green: "#10B981",
        yellow: "#F59E0B",
        red: "#EF4444",
        blue: "#3B82F6",
      };
      return { offset: `${offset}%`, color: colorMap[p.zone] || "#10B981" };
    });
  }, [timeline]);

  // Simplify gradient stops — keep only zone-transition points
  const simplifiedStops = useMemo(() => {
    if (gradientStops.length === 0) return [];
    const result = [gradientStops[0]];
    for (let i = 1; i < gradientStops.length; i++) {
      if (gradientStops[i].color !== gradientStops[i - 1].color) {
        result.push(gradientStops[i - 1]);
        result.push(gradientStops[i]);
      }
    }
    result.push(gradientStops[gradientStops.length - 1]);
    return result;
  }, [gradientStops]);

  return (
    <div className="w-full overflow-hidden rounded-2xl bg-white">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H + 40}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block"
      >
        <defs>
          {/* Dynamic color gradient along the curve */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {simplifiedStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          {/* Area fill gradient (vertical) */}
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Zone background bands */}
        {ZONE_BANDS.map((band, i) => {
          const y1 = toY(band.yEnd);
          const y2 = toY(band.yStart);
          return (
            <rect key={i} x="0" y={y1} width={SVG_W} height={y2 - y1} fill={band.fill} />
          );
        })}

        {/* Baseline dashed line */}
        <line
          x1="0"
          y1={toY(baseline)}
          x2={SVG_W}
          y2={toY(baseline)}
          stroke="#CBD5E1"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Hour grid lines */}
        {HOUR_POSITIONS.slice(1, -1).map((minVal) => (
          <line
            key={minVal}
            x1={toX(minVal)}
            y1="0"
            x2={toX(minVal)}
            y2={SVG_H}
            stroke="#E2E8F0"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
        ))}

        {/* Area fill under curve */}
        {areaPath && (
          <path
            ref={areaRef}
            d={areaPath}
            fill="url(#area-fill)"
            opacity={isAnimated ? 0.6 : 0}
            className="transition-opacity duration-1000 delay-500"
          />
        )}

        {/* The curve */}
        {curvePath && (
          <path
            ref={pathRef}
            d={curvePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* "Now" marker — purple dashed vertical line */}
        <line
          x1={nowX}
          y1="0"
          x2={nowX}
          y2={SVG_H}
          stroke="#7C3AED"
          strokeWidth="1.5"
          strokeDasharray="6 3"
          opacity="0.6"
        />
        <circle cx={nowX} cy={toY(baseline)} r="3" fill="#7C3AED" opacity="0.8" />

        {/* Meal markers */}
        {meals.map((meal, i) => {
          const mealDate = new Date(meal.time_iso);
          const mealMin = mealDate.getHours() * 60 + mealDate.getMinutes();
          const x = toX(mealMin);
          const emoji = getEmojiForFood(meal.food_name);

          return (
            <g key={i}>
              {/* Vertical dashed line */}
              <line
                x1={x}
                y1="0"
                x2={x}
                y2={SVG_H}
                stroke="#CBD5E1"
                strokeWidth="0.8"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              {/* Emoji at bottom */}
              <text
                x={x}
                y={SVG_H + 21}
                textAnchor="middle"
                fontSize="19"
                className="select-none"
              >
                {emoji}
              </text>
            </g>
          );
        })}

        {/* Hour labels at bottom */}
        {HOUR_LABELS.map((label, i) => (
          <text
            key={label}
            x={toX(HOUR_POSITIONS[i])}
            y={SVG_H + 36}
            textAnchor="middle"
            fontSize="9"
            fill="#94A3B8"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
