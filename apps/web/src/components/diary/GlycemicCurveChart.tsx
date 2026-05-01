"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { GlycemicTimelinePoint, GlycemicMealMarker } from "@/lib/api-client";
import { getEmojiForFood } from "./FoodCard";

interface GlycemicCurveChartProps {
  timeline: GlycemicTimelinePoint[];
  meals: GlycemicMealMarker[];
  baseline: number;
  zoneThresholds: { greenMax: number; yellowMax: number };
}

const Y_MIN = 40;
const Y_MAX = 200;
const SVG_W = 720;
const SVG_H = 200;
const MIN_WINDOW_MINUTES = 360;

/** Maps glucose (mg/dl) → SVG Y coordinate */
const toY = (glucose: number): number =>
  SVG_H - ((Math.min(Math.max(glucose, Y_MIN), Y_MAX) - Y_MIN) / (Y_MAX - Y_MIN)) * SVG_H;

export default function GlycemicCurveChart({ timeline, meals, baseline, zoneThresholds }: GlycemicCurveChartProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);

  const zoneBands = useMemo(() => [
    { yStart: Y_MIN, yEnd: 70, fill: "rgba(59, 130, 246, 0.06)" },
    { yStart: 70, yEnd: zoneThresholds.greenMax, fill: "rgba(16, 185, 129, 0.08)" },
    { yStart: zoneThresholds.greenMax, yEnd: zoneThresholds.yellowMax, fill: "rgba(245, 158, 11, 0.06)" },
    { yStart: zoneThresholds.yellowMax, yEnd: Y_MAX, fill: "rgba(239, 68, 68, 0.06)" },
  ], [zoneThresholds]);

  // Dynamic X-Axis scaling
  const { xMin, xMax } = useMemo(() => {
    if (meals.length === 0) return { xMin: 480, xMax: 1200 }; // fallback 08:00 - 20:00

    const mealTimes = meals.map((m) => {
      const d = new Date(m.time_iso);
      return d.getHours() * 60 + d.getMinutes();
    });

    let earliest = Math.min(...mealTimes) - 60; // 1 hour before first meal
    let latest = Math.max(...mealTimes) + 240;  // 4 hours after last meal

    // Ensure at least MIN_WINDOW_MINUTES
    if (latest - earliest < MIN_WINDOW_MINUTES) {
      const pad = (MIN_WINDOW_MINUTES - (latest - earliest)) / 2;
      earliest -= pad;
      latest += pad;
    }

    return {
      xMin: Math.max(0, Math.floor(earliest)),
      xMax: Math.min(1440, Math.ceil(latest)),
    };
  }, [meals]);

  const toX = (timeMin: number): number => {
    if (xMax === xMin) return SVG_W / 2;
    return ((timeMin - xMin) / (xMax - xMin)) * SVG_W;
  };

  // Determine if viewing today to smartly show/hide 'Now' marker
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowX = toX(nowMin);

  const isToday = useMemo(() => {
    if (meals.length === 0) return true;
    return new Date(meals[0].time_iso).toDateString() === now.toDateString();
  }, [meals, now]);

  // Generate dynamic hour grids
  const dynamicHourGrids = useMemo(() => {
    const grids = [];
    const startHour = Math.ceil(xMin / 60);
    const endHour = Math.floor(xMax / 60);
    
    // Choose step dynamically based on window duration
    const durationHours = (xMax - xMin) / 60;
    const step = durationHours > 16 ? 4 : durationHours > 8 ? 2 : 1;

    for (let h = startHour; h <= endHour; h++) {
      if (h % step === 0) {
        grids.push({ time: h * 60, label: `${h.toString().padStart(2, "0")}:00` });
      }
    }
    return grids;
  }, [xMin, xMax]);

  // Spline smoothing helper
  const buildSmoothCurve = (points: {x: number, y: number}[]) => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[0];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i !== points.length - 2 ? points[i + 2] : p2;
      
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  // Build SVG path from timeline data
  const { curvePath, areaPath, redPeaks } = useMemo(() => {
    if (!timeline || timeline.length === 0) return { curvePath: "", areaPath: "", redPeaks: [] };

    const points = timeline.map((p) => ({
      x: toX(p.time_min),
      y: toY(p.glucose_mg_dl),
      mg_dl: p.glucose_mg_dl,
    }));

    const peaks: {x: number, y: number}[] = [];
    
    // Better algorithm: Group points into "red segments" and find the absolute maximum of each segment.
    let inRedZone = false;
    let currentSegment: typeof points = [];

    for (let i = 0; i < points.length; i++) {
      const isRed = points[i].mg_dl >= zoneThresholds.yellowMax;
      
      if (isRed) {
        inRedZone = true;
        currentSegment.push(points[i]);
      } else {
        if (inRedZone && currentSegment.length > 0) {
          // Finished a red segment! Find its peak.
          const peakPoint = currentSegment.reduce((max, p) => p.mg_dl > max.mg_dl ? p : max, currentSegment[0]);
          peaks.push({ x: peakPoint.x, y: peakPoint.y });
          currentSegment = []; // reset
        }
        inRedZone = false;
      }
    }
    
    // Check if the timeline ended while inside a red zone
    if (inRedZone && currentSegment.length > 0) {
      const peakPoint = currentSegment.reduce((max, p) => p.mg_dl > max.mg_dl ? p : max, currentSegment[0]);
      peaks.push({ x: peakPoint.x, y: peakPoint.y });
    }

    const curveD = buildSmoothCurve(points);

    // Area: close the path at the bottom
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const areaD = `${curveD} L ${lastPoint.x} ${SVG_H} L ${firstPoint.x} ${SVG_H} Z`;

    return { curvePath: curveD, areaPath: areaD, redPeaks: peaks };
  }, [timeline, toX, zoneThresholds.yellowMax]);

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

  const gradientId = "glycemic-curve-gradient";

  return (
    <div className="w-full rounded-2xl bg-surface mt-1">
      <svg
        viewBox={`0 -40 ${SVG_W} ${SVG_H + 80}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block"
      >
        <defs>
          {/* Dynamic color gradient along the curve */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2={SVG_H} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#EF4444" />
            <stop offset={toY(zoneThresholds.yellowMax + 5) / SVG_H} stopColor="#EF4444" />
            
            <stop offset={toY(zoneThresholds.yellowMax - 5) / SVG_H} stopColor="#F59E0B" />
            <stop offset={toY(zoneThresholds.greenMax + 5) / SVG_H} stopColor="#F59E0B" />
            
            <stop offset={toY(zoneThresholds.greenMax - 5) / SVG_H} stopColor="#10B981" />
            <stop offset={toY(75) / SVG_H} stopColor="#10B981" />
            
            <stop offset={toY(65) / SVG_H} stopColor="#3B82F6" />
            <stop offset="1" stopColor="#3B82F6" />
          </linearGradient>
          {/* Area fill gradient (vertical) */}
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
          </linearGradient>

          {/* Needle piercing gradient */}
          <linearGradient id="needle-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0" />
            <stop offset="30%" stopColor="#EF4444" stopOpacity="1" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
          
          <clipPath id="chart-area-clip">
            <rect x="-10" y="-60" width={SVG_W + 20} height={SVG_H + 60} />
          </clipPath>

          <filter id="neon-red-glow" x="-500%" y="-500%" width="1100%" height="1100%">
            <feGaussianBlur stdDeviation="4" result="blur1" />
            <feGaussianBlur stdDeviation="12" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <mask id="red-zone-mask" maskUnits="userSpaceOnUse" x="-100" y="-100" width={SVG_W + 200} height={SVG_H + 200}>
            <rect x="-100" y="-100" width={SVG_W + 200} height={SVG_H + 200} fill="url(#mask-gradient)" />
          </mask>
          
          <linearGradient id="mask-gradient" x1="0" y1="0" x2="0" y2={SVG_H} gradientUnits="userSpaceOnUse">
            <stop offset={toY(zoneThresholds.yellowMax + 5) / SVG_H} stopColor="white" />
            <stop offset={toY(zoneThresholds.yellowMax - 10) / SVG_H} stopColor="black" />
            <stop offset="1" stopColor="black" />
          </linearGradient>
        </defs>

        {/* Zone background bands */}
        {zoneBands.map((band, i) => {
          const isTopBand = i === zoneBands.length - 1;
          const y1 = isTopBand ? -40 : toY(band.yEnd);
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
        {dynamicHourGrids.map((g) => (
          <line
            key={g.time}
            x1={toX(g.time)}
            y1="-40"
            x2={toX(g.time)}
            y2={SVG_H}
            stroke="#E2E8F0"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
        ))}

        <g clipPath="url(#chart-area-clip)">
          {/* Ghost Syringe Needles for Peaks in Red Zone */}
          {redPeaks.map((peak, i) => {
            const h = 45; // total length of the metal needle
            const tipY = peak.y + 15; // tip pierces slightly past the peak into the curve
            const topY = tipY - h; // top of the metal needle
            
            return (
              <g key={`syringe-group-${i}`}>
                {/* Glowing Piercing Wound on the curve */}
                <g 
                  className="transition-opacity duration-[1500ms] delay-1000"
                  opacity={isAnimated ? 1 : 0}
                >
                  <circle cx={peak.x} cy={peak.y} r={7} fill="#EF4444" opacity={0.7} filter="url(#neon-red-glow)" className="animate-pulse" style={{ animationDuration: "1.5s" }} />
                  <circle cx={peak.x} cy={peak.y} r={2.5} fill="#DC2626" />
                  {/* Expanding radar ping outward from the wound */}
                  <circle cx={peak.x} cy={peak.y} r={8} fill="#EF4444" opacity={0.5} className="animate-ping origin-center" style={{ animationDuration: "2s", transformBox: "fill-box" }} />
                </g>

                {/* Dropping Syringe */}
                <g
                  className="transition-all duration-[1200ms] ease-out delay-700"
                  style={{ 
                    transform: isAnimated ? "translateY(0)" : "translateY(-30px)", 
                    opacity: isAnimated ? 0.95 : 0 
                  }}
                >
                  {/* Syringe Plunger/Top */}
                  <rect x={peak.x - 2} y={topY - 14} width={4} height={3} rx={1} fill="#FCA5A5" />
                  
                  {/* Syringe Hub (Plastic base at the top) */}
                  <rect x={peak.x - 4} y={topY - 11} width={8} height={4} rx={1} fill="#EF4444" />
                  <rect x={peak.x - 3} y={topY - 7} width={6} height={7} rx={1} fill="#EF4444" />
                  
                  {/* Metal Needle Shaft */}
                  <line x1={peak.x} y1={topY} x2={peak.x} y2={tipY - 4} stroke="#CBD5E1" strokeWidth="2" />
                  <line x1={peak.x - 1} y1={topY} x2={peak.x - 1} y2={tipY - 5} stroke="#F8FAFC" strokeWidth="0.5" /> {/* Highlight */}
                  
                  {/* Beveled Tip (Sharp point) */}
                  <path d={`M ${peak.x - 1} ${tipY - 5} L ${peak.x + 1} ${tipY - 5} L ${peak.x} ${tipY} Z`} fill="#94A3B8" />
                  
                  {/* Red warning glow behind the needle hub */}
                  <circle cx={peak.x} cy={topY - 5} r={10} fill="#EF4444" opacity={0.15} filter="url(#neon-red-glow)" />
                </g>
              </g>
            );
          })}

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

          {/* Red glow overlay (only visible in red zone) */}
          {curvePath && (
            <g mask="url(#red-zone-mask)">
              <path
                d={curvePath}
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#neon-red-glow)"
                opacity={isAnimated ? 0.9 : 0}
                className="transition-opacity duration-1000 delay-500"
              />
            </g>
          )}
        </g>

        {/* "Now" marker — purple dashed vertical line */}
        {isToday && nowX >= 0 && nowX <= SVG_W && (
          <g>
            <line
              x1={nowX}
              y1="-40"
              x2={nowX}
              y2={SVG_H}
              stroke="#8B5CF6"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.5"
            />
            <circle cx={nowX} cy={toY(baseline)} r="3" fill="#7C3AED" opacity="0.8" />
          </g>
        )}

        {/* Meal markers */}
        {meals.map((meal, i) => {
          const mealDate = new Date(meal.time_iso);
          const mealMin = mealDate.getHours() * 60 + mealDate.getMinutes();
          const x = toX(mealMin);
          
          if (x < 0 || x > SVG_W) return null; // hide if outside viewport

          const emoji = getEmojiForFood(meal.food_name);

          return (
            <g key={i}>
              <line
                x1={x}
                y1="-40"
                x2={x}
                y2={SVG_H}
                stroke="#CBD5E1"
                strokeWidth="0.8"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <foreignObject
                x={x - 20}
                y={SVG_H + 2}
                width={40}
                height={40}
                className="overflow-visible"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[20px] leading-normal select-none">{emoji}</span>
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Hour labels at bottom */}
        {dynamicHourGrids.map((g) => (
          <text
            key={g.time}
            x={toX(g.time)}
            y={SVG_H + 36}
            textAnchor="middle"
            fontSize="9"
            fill="#94A3B8"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {g.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
