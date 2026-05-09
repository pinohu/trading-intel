"use client";

import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

type Point = {
  label: string;
  value: number;
};

export type PriceLevel = {
  price: number;
  label: string;
  color: string;
};

type PriceChartProps = {
  data: Point[];
  variant?: "area" | "candles";
  showVolume?: boolean;
  showEma?: boolean;
  levels?: PriceLevel[];
};

function buildCandles(data: Point[]) {
  return data.map((point, index) => {
    const previous = data[index - 1]?.value ?? point.value * (1 - Math.sin(index + 1) * 0.004);
    const close = point.value;
    const open = previous;
    const spread = Math.max(Math.abs(close - open), close * (0.0035 + (index % 5) * 0.0007));
    const high = Math.max(open, close) + spread * 0.55;
    const low = Math.max(0.01, Math.min(open, close) - spread * 0.55);
    return {
      time: (index + 1) as never,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    };
  });
}

function buildVolume(data: Point[]) {
  return data.map((point, index) => {
    const previous = data[index - 1]?.value ?? point.value;
    const positive = point.value >= previous;
    const movement = Math.abs(point.value - previous) / Math.max(point.value, 1);
    return {
      time: (index + 1) as never,
      value: Math.round(42 + movement * 6200 + ((index * 17) % 33)),
      color: positive ? "rgba(52, 211, 153, 0.38)" : "rgba(251, 113, 133, 0.38)",
    };
  });
}

function buildEma(data: Point[], period = 9) {
  const multiplier = 2 / (period + 1);
  let ema = data[0]?.value ?? 0;
  return data.map((point, index) => {
    ema = index === 0 ? point.value : point.value * multiplier + ema * (1 - multiplier);
    return {
      time: (index + 1) as never,
      value: Number(ema.toFixed(2)),
    };
  });
}

export default function PriceChart({ data, variant = "area", showVolume = false, showEma = false, levels = [] }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight || 260,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#dbe4ef",
      },
      grid: {
        vertLines: { color: "rgba(219,228,239,0.18)" },
        horzLines: { color: "rgba(219,228,239,0.18)" },
      },
      rightPriceScale: { borderColor: "rgba(219,228,239,0.34)" },
      timeScale: { borderColor: "rgba(219,228,239,0.34)", visible: true, timeVisible: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(139, 214, 255, 0.55)", labelBackgroundColor: "#0f172a" },
        horzLine: { color: "rgba(139, 214, 255, 0.55)", labelBackgroundColor: "#0f172a" },
      },
    });
    const series =
      variant === "candles"
        ? chart.addSeries(CandlestickSeries, {
            upColor: "#34d399",
            downColor: "#fb7185",
            borderUpColor: "#34d399",
            borderDownColor: "#fb7185",
            wickUpColor: "rgba(52, 211, 153, 0.85)",
            wickDownColor: "rgba(251, 113, 133, 0.85)",
            priceLineVisible: true,
            lastValueVisible: true,
          })
        : chart.addSeries(AreaSeries, {
            lineColor: "#67e8f9",
            topColor: "rgba(103,232,249,0.35)",
            bottomColor: "rgba(103,232,249,0.08)",
            priceLineVisible: true,
            lastValueVisible: true,
          });

    if (variant === "candles") {
      series.setData(buildCandles(data));
    } else {
      series.setData(
        data.map((point, index) => ({
          time: (index + 1) as never,
          value: point.value,
        })),
      );
    }

    for (const level of levels.filter((item) => Number.isFinite(item.price) && item.price > 0)) {
      series.createPriceLine({
        price: level.price,
        color: level.color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: level.label,
      });
    }

    if (showEma) {
      const emaSeries = chart.addSeries(LineSeries, {
        color: "#fbbf24",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      emaSeries.setData(buildEma(data));
    }

    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "rgba(148, 163, 184, 0.28)",
        priceFormat: { type: "volume" },
        priceScaleId: "",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.78,
          bottom: 0,
        },
      });
      volumeSeries.setData(buildVolume(data));
    }

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
  }, [data, levels, showEma, showVolume, variant]);

  return <div ref={containerRef} role="img" aria-label="Price action chart for the selected symbol." className="h-full min-h-64 w-full" />;
}
