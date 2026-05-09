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
  type IPriceLine,
  type ISeriesApi,
  type SeriesType,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

type Point = {
  label: string;
  value: number;
};

export type ChartCandle = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type PriceLevel = {
  price: number;
  label: string;
  color: string;
};

type PriceChartProps = {
  data: Point[];
  candles?: ChartCandle[];
  variant?: "area" | "candles";
  showVolume?: boolean;
  showEma?: boolean;
  showVwap?: boolean;
  levels?: PriceLevel[];
};

function buildCandles(data: Point[], candles?: ChartCandle[]) {
  if (candles?.length) {
    return candles.map((candle, index) => ({
      time: normalizeChartTime(candle.time, index),
      open: Number(candle.open.toFixed(2)),
      high: Number(candle.high.toFixed(2)),
      low: Number(candle.low.toFixed(2)),
      close: Number(candle.close.toFixed(2)),
    }));
  }
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

function buildVolume(data: Point[], candles?: ChartCandle[]) {
  if (candles?.length) {
    return candles.map((candle, index) => {
      const positive = candle.close >= candle.open;
      return {
        time: normalizeChartTime(candle.time, index),
        value: Math.max(1, Math.round(candle.volume ?? 1)),
        color: positive ? "rgba(52, 211, 153, 0.38)" : "rgba(251, 113, 133, 0.38)",
      };
    });
  }
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

function buildEma(data: Point[], period = 9, candles?: ChartCandle[]) {
  const source = candles?.length
    ? candles.map((candle, index) => ({ time: normalizeChartTime(candle.time, index), value: candle.close }))
    : data.map((point, index) => ({ time: (index + 1) as never, value: point.value }));
  const multiplier = 2 / (period + 1);
  let ema = source[0]?.value ?? 0;
  return source.map((point, index) => {
    ema = index === 0 ? point.value : point.value * multiplier + ema * (1 - multiplier);
    return {
      time: point.time,
      value: Number(ema.toFixed(2)),
    };
  });
}

function buildVwap(data: Point[], candles?: ChartCandle[]) {
  if (candles?.length) {
    let cumulativeTypicalVolume = 0;
    let cumulativeVolume = 0;
    return candles.map((candle, index) => {
      const volume = Math.max(1, candle.volume ?? 1);
      const typical = (candle.high + candle.low + candle.close) / 3;
      cumulativeTypicalVolume += typical * volume;
      cumulativeVolume += volume;
      return {
        time: normalizeChartTime(candle.time, index),
        value: Number((cumulativeTypicalVolume / cumulativeVolume).toFixed(2)),
      };
    });
  }

  let cumulativeValue = 0;
  return data.map((point, index) => {
    cumulativeValue += point.value;
    return {
      time: (index + 1) as never,
      value: Number((cumulativeValue / (index + 1)).toFixed(2)),
    };
  });
}

function normalizeChartTime(value: string | number, index: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value as never;
  const timestamp = Date.parse(String(value));
  if (Number.isFinite(timestamp)) return Math.floor(timestamp / 1000) as never;
  return (index + 1) as never;
}

export default function PriceChart({ data, candles, variant = "area", showVolume = false, showEma = false, showVwap = false, levels = [] }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

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
    chartRef.current = chart;
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
    mainSeriesRef.current = series;

    if (showEma) {
      const emaSeries = chart.addSeries(LineSeries, {
        color: "#fbbf24",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      emaSeriesRef.current = emaSeries;
    }

    if (showVwap) {
      const vwapSeries = chart.addSeries(LineSeries, {
        color: "#a78bfa",
        lineWidth: 2,
        lineStyle: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      vwapSeriesRef.current = vwapSeries;
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
      volumeSeriesRef.current = volumeSeries;
    }

    const observer = new ResizeObserver(([entry]) => {
      chart.applyOptions({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height || 260),
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      priceLinesRef.current = [];
      mainSeriesRef.current = null;
      emaSeriesRef.current = null;
      vwapSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [showEma, showVolume, showVwap, variant]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!chart || !series) return;

    if (variant === "candles") {
      series.setData(buildCandles(data, candles));
    } else {
      series.setData(
        candles?.length
          ? candles.map((candle, index) => ({ time: normalizeChartTime(candle.time, index), value: candle.close }))
          : data.map((point, index) => ({
              time: (index + 1) as never,
              value: point.value,
            })),
      );
    }

    if (emaSeriesRef.current) {
      emaSeriesRef.current.setData(buildEma(data, 9, candles));
    }

    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(buildVolume(data, candles));
    }

    if (vwapSeriesRef.current) {
      vwapSeriesRef.current.setData(buildVwap(data, candles));
    }

    chart.timeScale().fitContent();
  }, [candles, data, variant]);

  useEffect(() => {
    const series = mainSeriesRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current) {
      series.removePriceLine(line);
    }

    priceLinesRef.current = levels
      .filter((item) => Number.isFinite(item.price) && item.price > 0)
      .map((level) =>
        series.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: level.label,
        }),
      );
  }, [levels]);

  return <div ref={containerRef} role="img" aria-label="Price action chart for the selected symbol." className="h-full min-h-64 w-full" />;
}
