"use client";

import { useState, useMemo } from "react";

export interface DoughnutSlice {
  label: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface DoughnutChartProps {
  data: DoughnutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSublabel?: string;
  showLegend?: boolean;
  tooltipFormatter?: (slice: DoughnutSlice) => string;
  emptyMessage?: string;
  className?: string;
}

const DEFAULT_COLORS = [
  "#071738",
  "#162f67",
  "#47d79d",
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
  const startInner = polarToCartesian(cx, cy, innerRadius, endAngle);
  const endInner = polarToCartesian(cx, cy, innerRadius, startAngle);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
}

interface TooltipState {
  x: number;
  y: number;
  slice: DoughnutSlice;
}

export function DoughnutChart({
  data,
  size = 240,
  strokeWidth = 36,
  centerLabel,
  centerSublabel,
  showLegend = true,
  tooltipFormatter,
  emptyMessage = "No data available",
  className = "",
}: DoughnutChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const total = useMemo(
    () => data.reduce((sum, s) => sum + (s.value > 0 ? s.value : 0), 0),
    [data]
  );

  const segments = useMemo(() => {
    if (total <= 0) return [];
    let cumulative = 0;
    return data
      .filter((s) => s.value > 0)
      .map((s, i) => {
        const startAngle = cumulative;
        const angle = (s.value / total) * 360;
        cumulative += angle;
        return {
          ...s,
          startAngle,
          endAngle: cumulative,
          color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
        };
      });
  }, [data, total]);

  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2;
  const innerRadius = Math.max(0, outerRadius - strokeWidth);

  if (segments.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-sm text-slate-500 ${className}`}
        style={{ height: size }}
      >
        {emptyMessage}
      </div>
    );
  }

  const handleMouseEnter = (
    e: React.MouseEvent<SVGElement>,
    slice: DoughnutSlice
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      slice,
    });
  };

  const handleMouseLeave = () => setTooltip(null);

  return (
    <div className={`relative ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        onMouseLeave={handleMouseLeave}
      >
        {segments.map((seg) => {
          const isHovered = tooltip?.slice.label === seg.label;
          const path = describeArc(
            cx,
            cy,
            outerRadius,
            innerRadius,
            seg.startAngle,
            seg.endAngle
          );
          return (
            <path
              key={seg.label}
              d={path}
              fill={seg.color}
              stroke="#ffffff"
              strokeWidth={2}
              style={{
                transition: "opacity 0.15s ease, transform 0.15s ease",
                opacity: isHovered ? 0.85 : 1,
                transformOrigin: `${cx}px ${cy}px`,
                transform: isHovered ? "scale(1.04)" : "scale(1)",
              }}
              onMouseEnter={(e) => handleMouseEnter(e, seg)}
            />
          );
        })}

        {/* Center label */}
        <text
          x={cx}
          y={centerSublabel ? cy - 4 : cy + 6}
          textAnchor="middle"
          className="fill-slate-900 text-xl font-bold"
        >
          {centerLabel ?? (total > 0 ? total : "")}
        </text>
        {centerSublabel && (
          <text
            x={cx}
            y={cy + 20}
            textAnchor="middle"
            className="fill-slate-500 text-xs"
          >
            {centerSublabel}
          </text>
        )}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: tooltip.slice.color }}
            />
            <span className="font-medium text-slate-900">
              {tooltipFormatter
                ? tooltipFormatter(tooltip.slice)
                : `${tooltip.slice.label}: ${tooltip.slice.value} (${tooltip.slice.percentage}%)`}
            </span>
          </div>
        </div>
      )}

      {showLegend && segments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="truncate max-w-[140px]">{seg.label}</span>
              <span className="text-slate-400">
                {seg.value} ({seg.percentage}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}