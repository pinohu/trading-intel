"use client";

import { AreaSeries, createChart, ColorType, type IChartApi } from "lightweight-charts";
import { useEffect, useRef } from "react";

type Point = {
  label: string;
  value: number;
};

export default function PriceChart({ data }: { data: Point[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

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

    const observer = new ResizeObserver(([entry]) => {
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height || 260),
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [data]);

  return <div ref={containerRef} className="h-full min-h-64 w-full" />;
}
