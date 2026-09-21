"use client";

import { useState, useMemo } from "react";

export interface LineSeriesPoint {
  date: string;
  count: number;
}

export interface LineChartProps {
  data: LineSeriesPoint[];
  height?: number;
  width?: number;
  strokeColor?: string;
  fillColor?: string;
  gridColor?: string;
  axisColor?: string;
  tooltipFormatter?: (point: LineSeriesPoint) => string;
  labelFormatter?: (date: string) => string;
  emptyMessage?: string;
  className?: string;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 40 };

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TooltipState {
  x: number;
  y: number;
  point: LineSeriesPoint;
}

export function LineChart({
  data,
  height = 220,
  width = 0,
  strokeColor = "#162f67",
  fillColor = "rgba(22,47,103,0.12)",
  gridColor = "#e2e8f0",
  axisColor = "#cbd5e1",
  tooltipFormatter,
  labelFormatter,
  emptyMessage = "No data available",
  className = "",
  }: LineChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const { pathD, areaD, points, yScale, yMax, viewBoxW, viewBoxH } =
    useMemo(() => {
      const filtered = data.filter((p) => p.count != null);
      if (filtered.length === 0) {
        return {
          pathD: "",
          areaD: "",
          points: [] as { x: number; y: number; point: LineSeriesPoint }[],
          xScale: 0,
          yScale: 0,
          yMax: 0,
          viewBoxW: 0,
          viewBoxH: 0,
        };
      }

      const values = filtered.map((p) => p.count);
      const maxVal = Math.max(...values, 1);
      const yMax = Math.ceil(maxVal / 5) * 5 || 5;

      const innerW = Math.max(1, width > 0 ? width - MARGIN.left - MARGIN.right : 600);
      const innerH = Math.max(1, height - MARGIN.top - MARGIN.bottom);
      const viewBoxW = width > 0 ? width : innerW + MARGIN.left + MARGIN.right;
      const viewBoxH = height;

      const xStep = filtered.length > 1 ? innerW / (filtered.length - 1) : innerW;
      const yStep = innerH / yMax;

      const pts = filtered.map((p, i) => {
        const x = MARGIN.left + i * xStep;
        const y = MARGIN.top + innerH - p.count * yStep;
        return { x, y, point: p };
      });

      const line = pts
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
      const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${(MARGIN.top + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(MARGIN.top + innerH).toFixed(1)} Z`;

      return {
        pathD: line,
        areaD: area,
        points: pts,
        xScale: xStep,
        yScale: yStep,
        yMax,
        viewBoxW,
        viewBoxH,
      };
    }, [data, width, height]);

  if (!pathD) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-slate-500 ${className}`}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const innerH = height - MARGIN.top - MARGIN.bottom;
  const yTicks = 5;
  const yTickStep = yMax / yTicks;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width;
    const idx = Math.round((svgX * (points.length - 1)));
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    const p = points[clamped];
    setTooltip({ x: p.x, y: p.y, point: p.point });
  };

  const handleMouseLeave = () => setTooltip(null);

  return (
    <div className={`relative ${className}`}>
      <svg
        width={width || undefined}
        height={height}
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        className="w-full"
        style={{ width: width > 0 ? width : "100%", height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const y = MARGIN.top + innerH - i * yTickStep * yScale;
          return (
            <line
              key={i}
              x1={MARGIN.left}
              y1={y}
              x2={viewBoxW - MARGIN.right}
              y2={y}
              stroke={gridColor}
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Y axis labels */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = Math.round(i * yTickStep);
          const y = MARGIN.top + innerH - i * yTickStep * yScale;
          return (
            <text
              key={i}
              x={MARGIN.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-slate-400 text-[10px]"
            >
              {val}
            </text>
          );
        })}

        {/* X axis labels (every ~5th) */}
        {points.map((p, i) => {
          const step = Math.max(1, Math.ceil(points.length / 6));
          if (i % step !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={viewBoxH - MARGIN.bottom + 18}
              textAnchor="middle"
              className="fill-slate-400 text-[10px]"
            >
              {labelFormatter ? labelFormatter(p.point.date) : formatDateLabel(p.point.date)}
            </text>
          );
        })}

        {/* Baseline */}
        <line
          x1={MARGIN.left}
          y1={MARGIN.top + innerH}
          x2={viewBoxW - MARGIN.right}
          y2={MARGIN.top + innerH}
          stroke={axisColor}
        />

        {/* Area fill */}
        <path d={areaD} fill={fillColor} />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="#ffffff"
            stroke={strokeColor}
            strokeWidth={2}
          />
        ))}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          <div className="font-medium text-slate-900">
            {tooltipFormatter
              ? tooltipFormatter(tooltip.point)
              : `${formatDateLabel(tooltip.point.date)}: ${tooltip.point.count}`}
          </div>
        </div>
      )}
    </div>
  );
}