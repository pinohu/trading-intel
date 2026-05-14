"use client";

import { AreaSeries, createChart, ColorType, type IChartApi } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

type Point = {
  label: string;
  value: number;
};

type ChartAction = {
  id: string;
  label: string;
  side: "Buy" | "Sell / Avoid";
  status: "Watching" | "Closed" | "Canceled";
  index: number;
  entry: number;
  createdAt: string;
};

export default function PriceChart({ data, actions = [] }: { data: Point[]; actions?: ChartAction[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [markerCoordinates, setMarkerCoordinates] = useState<Array<ChartAction & { x: number; y: number }>>([]);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

  const sortedActions = useMemo(
    () => [...actions].sort((a, b) => a.index - b.index || a.createdAt.localeCompare(b.createdAt)),
    [actions],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 260,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)", visible: false },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#67e8f9",
      topColor: "rgba(103,232,249,0.35)",
      bottomColor: "rgba(103,232,249,0.02)",
      priceLineVisible: false,
      lastValueVisible: true,
    });
    series.setData(
      data.map((point, index) => ({
        time: (index + 1) as never,
        value: point.value,
      })),
    );
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const updateActionCoordinates = () => {
      const mapped = sortedActions
        .map((action) => {
          const x = chart.timeScale().timeToCoordinate((action.index + 1) as never);
          const y = series.priceToCoordinate(action.entry);
          if (x == null || y == null) return null;
          return { ...action, x, y };
        })
        .filter((action): action is ChartAction & { x: number; y: number } => action !== null);
      setMarkerCoordinates(mapped);
    };

    updateActionCoordinates();
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateActionCoordinates);

    const observer = new ResizeObserver(([entry]) => {
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height || 260),
      });
      updateActionCoordinates();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateActionCoordinates);
      chartRef.current = null;
      chart.remove();
    };
  }, [data, sortedActions]);

  return (
    <div ref={containerRef} className="relative h-full min-h-64 w-full overflow-hidden rounded-md">
      {markerCoordinates.map((action) => {
        const active = selectedActionId === action.id;
        const tone =
          action.side === "Buy"
            ? "border-emerald-200/90 bg-emerald-300/80 text-slate-950"
            : "border-rose-200/90 bg-rose-300/80 text-slate-950";
        return (
          <button
            key={action.id}
            onClick={() => setSelectedActionId((current) => (current === action.id ? null : action.id))}
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur transition ${tone} ${active ? "ring-2 ring-white/70" : ""}`}
            style={{ left: `${action.x}px`, top: `${action.y}px` }}
            title={`${action.label} @ ${action.entry.toFixed(2)} (${action.status})`}
          >
            {action.side === "Buy" ? "B" : "S"}
          </button>
        );
      })}
      {selectedActionId && (
        <div className="absolute bottom-2 left-2 z-20 max-w-[85%] rounded-md border border-white/15 bg-slate-950/90 px-3 py-2 text-xs text-slate-100 shadow-lg">
          {(() => {
            const selectedAction = sortedActions.find((action) => action.id === selectedActionId);
            if (!selectedAction) return null;
            return (
              <div className="space-y-1">
                <div className="font-semibold text-white">{selectedAction.label}</div>
                <div>
                  {selectedAction.side} · {selectedAction.status} · ${selectedAction.entry.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-300">{new Date(selectedAction.createdAt).toLocaleString()}</div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
