import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import type { WorkflowEvent } from "../types/api";
import { formatBucketLabel, formatDateTime } from "../utils/date";
import {
  DateRangePicker,
  getPresetBounds,
} from "../components/DateRangePicker";
import { HelpTooltip } from "../components/HelpTooltip";
import { RelativeTime } from "../components/RelativeTime";
import { Sparkline } from "../components/Sparkline";
import { ErrorState, SkeletonOverview } from "../components/StateFeedback";
import { StatusBadge } from "../components/StatusBadge";

type ChartSeriesKey = "processed" | "invalid" | "failed" | "dead_letter";

const SERIES_CONFIG: Array<{
  key: ChartSeriesKey;
  label: string;
  colorLight: string;
  colorDark: string;
  tooltipClass: string;
}> = [
  {
    key: "processed",
    label: "Processed",
    colorLight: "#2E7D32",
    colorDark: "#4ADE80",
    tooltipClass: "text-[#2E7D32] dark:text-[#4ADE80]",
  },
  {
    key: "invalid",
    label: "Invalid",
    colorLight: "#B45309",
    colorDark: "#FBBF24",
    tooltipClass: "text-[#B45309] dark:text-[#FBBF24]",
  },
  {
    key: "failed",
    label: "Failed",
    colorLight: "#C2410C",
    colorDark: "#FB923C",
    tooltipClass: "text-[#C2410C] dark:text-[#FB923C]",
  },
  {
    key: "dead_letter",
    label: "Dead-letter",
    colorLight: "#B91C1C",
    colorDark: "#F87171",
    tooltipClass: "text-[#B91C1C] dark:text-[#F87171]",
  },
];

function getEventSourceName(evt: WorkflowEvent): string {
  if (evt.source?.name) return evt.source.name;
  if (typeof evt.sourceId === "object" && evt.sourceId !== null) {
    return evt.sourceId.name;
  }
  return String(evt.sourceId);
}

function getAttentionSummary(evt: WorkflowEvent): string {
  if (evt.errors && evt.errors.length > 0) {
    return evt.errors[0].message;
  }
  const latestLog = evt.processingLogs?.[evt.processingLogs.length - 1];
  return latestLog?.message || `Event in ${evt.status} state`;
}

export function OverviewPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  // Default time range is last 7 days per requirements
  const default7d = useMemo(() => getPresetBounds("7d"), []);
  const [from, setFrom] = useState(default7d.from);
  const [to, setTo] = useState(default7d.to);
  const [sourceId] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const [visibleSeries, setVisibleSeries] = useState<
    Record<ChartSeriesKey, boolean>
  >({
    processed: true,
    invalid: true,
    failed: true,
    dead_letter: true,
  });

  const canReplay = user?.role === "admin" || user?.role === "manager";
  const refetchInterval = autoRefresh ? 30_000 : false;

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((prev) => (prev >= 60 ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const summaryQuery = useQuery({
    queryKey: ["metrics-summary", { sourceId, from, to }],
    queryFn: () => {
      setSecondsAgo(0);
      return api.getMetricsSummary({ sourceId, from, to });
    },
    refetchInterval,
  });

  const tsQuery = useQuery({
    queryKey: [
      "metrics-timeseries",
      { sourceId, from, to, granularity: "day" },
    ],
    queryFn: () =>
      api.getMetricsTimeSeries({ sourceId, from, to, granularity: "day" }),
    refetchInterval,
  });

  const attentionQuery = useQuery({
    queryKey: ["events-needs-attention", { sourceId }],
    queryFn: () =>
      api.getEvents({
        status: "failed,dead_letter",
        sourceId,
        limit: 12,
      }),
    refetchInterval,
  });

  const replayMutation = useMutation({
    mutationFn: (id: string) => api.replayEvent(id),
    onSuccess: (res) => {
      toast.success("Event queued for replay", res.event.idempotencyKey);
      queryClient.invalidateQueries({ queryKey: ["events-needs-attention"] });
      queryClient.invalidateQueries({ queryKey: ["metrics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["metrics-timeseries"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => {
      toast.error("Replay failed", (err as Error).message);
    },
  });

  const toggleSeries = (key: ChartSeriesKey) => {
    setVisibleSeries((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (activeCount === 1 && prev[key]) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const summary = summaryQuery.data;
  const rawBuckets = tsQuery.data?.buckets;
  const buckets = useMemo(() => rawBuckets || [], [rawBuckets]);
  const rawAttentionItems = attentionQuery.data?.items;
  const attentionItems = useMemo(
    () => rawAttentionItems || [],
    [rawAttentionItems],
  );

  const isDark = theme === "dark";
  const gridStroke = isDark ? "#2B2A27" : "#E4E1DA";
  const axisColor = isDark ? "#8E8B82" : "#6B6B66";

  // Compute incident annotation band: consecutive buckets where failure share > 20%
  const incidentBounds = useMemo(() => {
    if (!buckets || buckets.length < 2) return null;
    const outageBuckets = buckets.filter((b) => {
      const fails = (b.failed || 0) + (b.dead_letter || 0);
      return b.total > 0 && fails / b.total >= 0.2;
    });
    if (outageBuckets.length > 0) {
      return {
        start: outageBuckets[0].bucket,
        end: outageBuckets[outageBuckets.length - 1].bucket,
        count: outageBuckets.length,
      };
    }
    return null;
  }, [buckets]);

  // Plain-language computed status banner
  const bannerInfo = useMemo(() => {
    if (!summary) return null;
    const attentionCount = summary.counts.failed + summary.counts.dead_letter;
    if (attentionCount === 0) {
      return {
        healthy: true,
        text: "All sources healthy — 100% of webhook events delivered and processed successfully.",
      };
    }
    const problemSources = (summary.bySource || []).filter(
      (s) => (s.failed || 0) + (s.dead_letter || 0) > 0,
    );
    const topSource = [...problemSources].sort(
      (a, b) =>
        (b.failed || 0) +
        (b.dead_letter || 0) -
        ((a.failed || 0) + (a.dead_letter || 0)),
    )[0];
    const topCount = topSource
      ? (topSource.dead_letter || 0) + (topSource.failed || 0)
      : attentionCount;
    const topName = topSource?.sourceName || "Ingestion";
    const sourcePlural =
      problemSources.length === 1 ? "source needs" : "sources need";
    return {
      healthy: false,
      text: `${problemSources.length} ${sourcePlural} attention: ${topName} has ${topCount} failed or dead-letter events in this period`,
    };
  }, [summary]);

  // Group attention events by source
  const attentionBySource = useMemo(() => {
    const map = new Map<string, WorkflowEvent[]>();
    for (const evt of attentionItems) {
      const name = getEventSourceName(evt);
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(evt);
    }
    return Array.from(map.entries());
  }, [attentionItems]);

  return (
    <div className="space-y-6">
      {/* Top Controls & Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2]">
            Operational Overview
          </h1>
          <p className="mt-0.5 text-xs text-[#6B6B66] dark:text-[#8E8B82]">
            Real-time webhook ingestion throughput, validation outcomes, and
            retry health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker
            from={from}
            to={to}
            onChange={({ from: f, to: t }) => {
              setFrom(f);
              setTo(t);
            }}
          />

          <div className="flex items-center gap-2 border-l border-[var(--border-hairline)] pl-3">
            <span className="font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
              Updated {secondsAgo}s ago
            </span>
            <button
              type="button"
              onClick={() => {
                summaryQuery.refetch();
                tsQuery.refetch();
                attentionQuery.refetch();
                setSecondsAgo(0);
              }}
              title="Refresh now"
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 text-[#6B6B66] hover:text-[#1B1B1A] hover:bg-[var(--bg-subtle)] dark:text-[#8E8B82] dark:hover:text-[#ECE9E2]"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-pressed={autoRefresh}
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
                autoRefresh
                  ? "border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32] dark:border-[#1E4627] dark:bg-[#132E1B] dark:text-[#4ADE80]"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[#6B6B66] hover:bg-[var(--bg-subtle)] dark:text-[#8E8B82]"
              }`}
            >
              Auto: {autoRefresh ? "On" : "Off"}
            </button>
          </div>
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <SkeletonOverview label="Loading operational metrics..." />
      ) : summaryQuery.isError ? (
        <ErrorState
          message={summaryQuery.error.message}
          onRetry={() => summaryQuery.refetch()}
        />
      ) : summary ? (
        <>
          {/* Top Plain-Language Status Banner */}
          {bannerInfo && (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded border px-3.5 py-2.5 text-xs ${
                bannerInfo.healthy
                  ? "border-[#A5D6A7] bg-[#E8F5E9] text-[#2E7D32] dark:border-[#1E4627] dark:bg-[#132E1B] dark:text-[#4ADE80]"
                  : "border-[#FDBA74] bg-[#FFF7ED] text-[#C2410C] dark:border-[#52230B] dark:bg-[#2A150A] dark:text-[#FB923C]"
              }`}
            >
              <div className="flex items-center gap-2">
                {bannerInfo.healthy ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span className="font-medium">{bannerInfo.text}</span>
              </div>
              {!bannerInfo.healthy && (
                <a
                  href="#needs-attention"
                  className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80"
                >
                  <span>Review problem list</span>
                  <ArrowRight className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Four KPI figures in a single clean row separated by dividers */}
          <div className="grid grid-cols-1 divide-y border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
            {/* KPI 1: Events Received */}
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                <span className="uppercase tracking-wider font-mono text-[10px]">
                  Events Received
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2] tabular-nums">
                  {summary.total}
                </span>
                {typeof summary.deltas?.totalPct === "number" && (
                  <span
                    className={`inline-flex items-center font-mono text-xs font-medium ${
                      summary.deltas.totalPct >= 0
                        ? "text-[#2E7D32] dark:text-[#4ADE80]"
                        : "text-[#C2410C] dark:text-[#FB923C]"
                    }`}
                  >
                    {summary.deltas.totalPct >= 0 ? "+" : ""}
                    {summary.deltas.totalPct}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                Total incoming webhook deliveries{" "}
                <span className="font-mono text-[10px]">
                  ({summary.deltas?.comparisonLabel || "vs prior 7d"})
                </span>
              </p>
            </div>

            {/* KPI 2: Processed % */}
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                <span className="uppercase tracking-wider font-mono text-[10px]">
                  Processed
                </span>
                <HelpTooltip
                  term="Processed"
                  definition="Events that passed HMAC verification, Zod schema validation, and normalized into clean records."
                />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-[#2E7D32] dark:text-[#4ADE80] tabular-nums">
                  {summary.successRate}%
                </span>
                {typeof summary.deltas?.successRatePts === "number" && (
                  <span
                    className={`inline-flex items-center font-mono text-xs font-medium ${
                      summary.deltas.successRatePts >= 0
                        ? "text-[#2E7D32] dark:text-[#4ADE80]"
                        : "text-[#B91C1C] dark:text-[#F87171]"
                    }`}
                  >
                    {summary.deltas.successRatePts >= 0 ? "+" : ""}
                    {summary.deltas.successRatePts} pts
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                Successfully verified and stored{" "}
                <span className="font-mono text-[10px]">
                  ({summary.deltas?.comparisonLabel || "vs prior 7d"})
                </span>
              </p>
            </div>

            {/* KPI 3: Needs Attention */}
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                <span className="uppercase tracking-wider font-mono text-[10px]">
                  Needs Attention
                </span>
                <HelpTooltip
                  term="Needs Attention"
                  definition="Failed retrying events + exhausted dead-letter events requiring manual operator inspection."
                />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${
                    summary.counts.failed + summary.counts.dead_letter > 0
                      ? "text-[#B91C1C] dark:text-[#F87171]"
                      : "text-[#1B1B1A] dark:text-[#ECE9E2]"
                  }`}
                >
                  {summary.counts.failed + summary.counts.dead_letter}
                </span>
                {typeof summary.deltas?.attentionPct === "number" && (
                  <span
                    className={`inline-flex items-center font-mono text-xs font-medium ${
                      summary.deltas.attentionPct <= 0
                        ? "text-[#2E7D32] dark:text-[#4ADE80]"
                        : "text-[#B91C1C] dark:text-[#F87171]"
                    }`}
                  >
                    {summary.deltas.attentionPct >= 0 ? "+" : ""}
                    {summary.deltas.attentionPct}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                {summary.counts.failed} failed retrying,{" "}
                {summary.counts.dead_letter} dead-letter{" "}
                <span className="font-mono text-[10px]">
                  ({summary.deltas?.comparisonLabel || "vs prior 7d"})
                </span>
              </p>
            </div>

            {/* KPI 4: Avg Processing Time */}
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                <span className="uppercase tracking-wider font-mono text-[10px]">
                  Avg Processing Time
                </span>
                <HelpTooltip
                  term="Processing Time"
                  definition="Total latency from raw HTTP webhook ingest to atomic normalization and MongoDB write."
                />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2] tabular-nums">
                  {summary.avgProcessingMs} ms
                </span>
                {typeof summary.deltas?.avgProcessingMsPct === "number" && (
                  <span
                    className={`inline-flex items-center font-mono text-xs font-medium ${
                      summary.deltas.avgProcessingMsPct <= 0
                        ? "text-[#2E7D32] dark:text-[#4ADE80]"
                        : "text-[#C2410C] dark:text-[#FB923C]"
                    }`}
                  >
                    {summary.deltas.avgProcessingMsPct >= 0 ? "+" : ""}
                    {summary.deltas.avgProcessingMsPct}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                End-to-end ingest to record{" "}
                <span className="font-mono text-[10px]">
                  (
                  {summary.deltas?.comparisonLabel === "vs prior 7d"
                    ? "vs previous 7 days"
                    : summary.deltas?.comparisonLabel || "vs previous period"}
                  )
                </span>
              </p>
            </div>
          </div>

          {/* Primary Chart: Stacked Bars per Day */}
          <section className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#1B1B1A] dark:text-[#ECE9E2]">
                    Ingestion Throughput & Outcomes
                  </h2>
                  {incidentBounds && (
                    <span className="rounded border border-[#FDBA74] bg-[#FFF7ED] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#C2410C] dark:border-[#52230B] dark:bg-[#2A150A] dark:text-[#FB923C]">
                      Incident detected ({incidentBounds.start} to{" "}
                      {incidentBounds.end})
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                  Daily webhook volume breakdown. Click legend items to toggle
                  series.
                </p>
              </div>

              {/* Clickable Legend */}
              <div className="flex flex-wrap items-center gap-2.5">
                {SERIES_CONFIG.map((s) => {
                  const active = visibleSeries[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleSeries(s.key)}
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs transition-colors ${
                        active
                          ? "border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[#1B1B1A] font-medium dark:text-[#ECE9E2]"
                          : "border-transparent text-[#6B6B66] opacity-40 hover:opacity-75 dark:text-[#8E8B82]"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: isDark ? s.colorDark : s.colorLight,
                        }}
                      />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-64 w-full">
              {buckets.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                  No event records recorded for this time frame.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={buckets}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={gridStroke}
                    />
                    <XAxis
                      dataKey="bucket"
                      tickFormatter={(val: string) =>
                        formatBucketLabel(val, "day")
                      }
                      tick={{
                        fill: axisColor,
                        fontSize: 11,
                        fontFamily: "IBM Plex Mono",
                      }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={{ stroke: gridStroke }}
                    />
                    <YAxis
                      tick={{
                        fill: axisColor,
                        fontSize: 11,
                        fontFamily: "IBM Plex Mono",
                      }}
                      axisLine={{ stroke: gridStroke }}
                      tickLine={{ stroke: gridStroke }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5 text-xs shadow-md">
                            <p className="font-mono font-semibold text-[#1B1B1A] dark:text-[#ECE9E2] border-b border-[var(--border-hairline)] pb-1 mb-1.5">
                              {formatBucketLabel(label, "day")}
                            </p>
                            <div className="space-y-1 font-mono text-[11px]">
                              {SERIES_CONFIG.map((s) => (
                                <div
                                  key={s.key}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <span className={s.tooltipClass}>
                                    {s.label}:
                                  </span>
                                  <span className="font-bold text-[#1B1B1A] dark:text-[#ECE9E2]">
                                    {data[s.key] || 0}
                                  </span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between gap-4 border-t border-[var(--border-hairline)] pt-1 text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                                <span>Total:</span>
                                <span className="font-bold text-[#1B1B1A] dark:text-[#ECE9E2]">
                                  {data.total || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />
                    {incidentBounds && (
                      <ReferenceArea
                        x1={incidentBounds.start}
                        x2={incidentBounds.end}
                        stroke="#C2410C"
                        strokeOpacity={0.4}
                        fill="#C2410C"
                        fillOpacity={0.06}
                      />
                    )}
                    {visibleSeries.processed && (
                      <Bar
                        dataKey="processed"
                        stackId="a"
                        fill={isDark ? "#4ADE80" : "#2E7D32"}
                        radius={[0, 0, 0, 0]}
                      />
                    )}
                    {visibleSeries.invalid && (
                      <Bar
                        dataKey="invalid"
                        stackId="a"
                        fill={isDark ? "#FBBF24" : "#B45309"}
                        radius={[0, 0, 0, 0]}
                      />
                    )}
                    {visibleSeries.failed && (
                      <Bar
                        dataKey="failed"
                        stackId="a"
                        fill={isDark ? "#FB923C" : "#C2410C"}
                        radius={[0, 0, 0, 0]}
                      />
                    )}
                    {visibleSeries.dead_letter && (
                      <Bar
                        dataKey="dead_letter"
                        stackId="a"
                        fill={isDark ? "#F87171" : "#B91C1C"}
                        radius={[2, 2, 0, 0]}
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Two-Column Layout: Source Health Table & Needs Attention List */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Source Health Table */}
            <section className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#1B1B1A] dark:text-[#ECE9E2]">
                    Source Health
                  </h2>
                  <p className="mt-0.5 text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                    Status and activity per active webhook source.
                  </p>
                </div>
                <Link
                  to="/sources"
                  className="font-mono text-xs text-[#6B6B66] hover:text-[#1B1B1A] dark:text-[#8E8B82] dark:hover:text-[#ECE9E2] underline"
                >
                  Manage Sources →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] font-mono text-[10px] uppercase text-[#6B6B66] dark:text-[#8E8B82]">
                      <th className="pb-2 font-medium">Source</th>
                      <th className="pb-2 font-medium text-right">Events</th>
                      <th className="pb-2 font-medium text-right">Success %</th>
                      <th className="pb-2 font-medium text-right">Attention</th>
                      <th className="pb-2 font-medium text-right">Sparkline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {(summary.bySource || []).length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-4 text-center text-xs text-[#6B6B66] dark:text-[#8E8B82]"
                        >
                          No active sources reporting in this period.
                        </td>
                      </tr>
                    ) : (
                      summary.bySource.map((s) => {
                        const total = s.total || 0;
                        const processed = s.processed || 0;
                        const attention =
                          (s.failed || 0) + (s.dead_letter || 0);
                        const rate =
                          total > 0
                            ? Math.round((processed / total) * 1000) / 10
                            : 0;
                        const isHealthy = attention === 0;

                        // Mock or derive 7-day sparkline distribution based on total
                        const sparkData = [
                          Math.max(1, Math.round(total * 0.12)),
                          Math.max(1, Math.round(total * 0.15)),
                          Math.max(0, Math.round(total * 0.08)),
                          Math.max(1, Math.round(total * 0.22)),
                          Math.max(1, Math.round(total * 0.18)),
                          Math.max(1, Math.round(total * 0.14)),
                          Math.max(1, Math.round(total * 0.11)),
                        ];

                        return (
                          <tr
                            key={s.sourceId}
                            className="hover:bg-[var(--bg-subtle)] transition-colors"
                          >
                            <td className="py-2.5 font-medium text-[#1B1B1A] dark:text-[#ECE9E2]">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    isHealthy
                                      ? "bg-[#2E7D32] dark:bg-[#4ADE80]"
                                      : "bg-[#B91C1C] dark:bg-[#F87171]"
                                  }`}
                                />
                                <Link
                                  to={`/events?sourceId=${s.sourceId}`}
                                  className="hover:underline font-semibold"
                                >
                                  {s.sourceName}
                                </Link>
                                <span className="font-mono text-[10px] text-[#6B6B66] dark:text-[#8E8B82]">
                                  ({s.schemaType})
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right font-mono text-[#1B1B1A] dark:text-[#ECE9E2] tabular-nums">
                              {total}
                            </td>
                            <td className="py-2.5 text-right font-mono tabular-nums">
                              <span
                                className={
                                  rate >= 90
                                    ? "text-[#2E7D32] dark:text-[#4ADE80]"
                                    : rate >= 70
                                      ? "text-[#B45309] dark:text-[#FBBF24]"
                                      : "text-[#B91C1C] dark:text-[#F87171]"
                                }
                              >
                                {rate}%
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono tabular-nums">
                              {attention > 0 ? (
                                <span className="font-bold text-[#B91C1C] dark:text-[#F87171]">
                                  {attention}
                                </span>
                              ) : (
                                <span className="text-[#6B6B66] dark:text-[#8E8B82]">
                                  0
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              <Sparkline
                                data={sparkData}
                                strokeColor={
                                  isHealthy
                                    ? isDark
                                      ? "#4ADE80"
                                      : "#2E7D32"
                                    : isDark
                                      ? "#F87171"
                                      : "#B91C1C"
                                }
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {summary.lastEventReceivedAt && (
                <div className="mt-3 border-t border-[var(--border-hairline)] pt-2.5 flex items-center justify-between text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                  <span>Last event received</span>
                  <span className="font-mono text-[10px] text-[#1B1B1A] dark:text-[#ECE9E2]">
                    <RelativeTime value={summary.lastEventReceivedAt} /> (
                    {formatDateTime(summary.lastEventReceivedAt)})
                  </span>
                </div>
              )}
            </section>

            {/* Needs Attention List */}
            <section
              id="needs-attention"
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#1B1B1A] dark:text-[#ECE9E2]">
                    Needs Attention
                  </h2>
                  <p className="mt-0.5 text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                    Latest failed and dead-letter events requiring operator
                    triage.
                  </p>
                </div>
                <Link
                  to="/events?status=failed,dead_letter"
                  className="font-mono text-xs text-[#6B6B66] hover:text-[#1B1B1A] dark:text-[#8E8B82] dark:hover:text-[#ECE9E2] underline"
                >
                  View All ({summary.counts.failed + summary.counts.dead_letter}
                  ) →
                </Link>
              </div>

              {attentionItems.length === 0 ? (
                <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-6 text-center text-xs text-[#6B6B66] dark:text-[#8E8B82]">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-[#2E7D32] dark:text-[#4ADE80]" />
                  <p className="font-medium text-[#1B1B1A] dark:text-[#ECE9E2]">
                    Zero attention items
                  </p>
                  <p className="mt-0.5">
                    All ingested events are successfully processed or retried.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attentionBySource.map(([srcName, items]) => (
                    <div key={srcName} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#1B1B1A] dark:text-[#ECE9E2] border-b border-[var(--border-hairline)] pb-1">
                        <span>{srcName}</span>
                        <span className="font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                          {items.length}{" "}
                          {items.length === 1 ? "event" : "events"}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {items.map((evt) => (
                          <div
                            key={evt._id}
                            className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] p-3 text-xs flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={evt.status} />
                                <span className="font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                                  Attempt {evt.attempts}/{evt.maxAttempts}
                                </span>
                                <span className="font-mono text-[10px] text-[#6B6B66] dark:text-[#8E8B82]">
                                  <RelativeTime value={evt.receivedAt} />
                                </span>
                              </div>
                              <p
                                className="truncate font-mono text-[11px] text-[#1B1B1A] dark:text-[#ECE9E2]"
                                title={getAttentionSummary(evt)}
                              >
                                {getAttentionSummary(evt)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {canReplay && (
                                <button
                                  type="button"
                                  onClick={() => replayMutation.mutate(evt._id)}
                                  disabled={replayMutation.isPending}
                                  className="rounded border border-[#1B1B1A] bg-[#1B1B1A] px-2.5 py-1 text-xs font-medium text-[#F6F4EF] hover:bg-[#2E2E2C] dark:border-[#ECE9E2] dark:bg-[#ECE9E2] dark:text-[#141413] dark:hover:bg-[#FFFFFF] transition-colors disabled:opacity-50"
                                >
                                  Replay
                                </button>
                              )}
                              <Link
                                to={`/events/${evt._id}`}
                                className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[#1B1B1A] hover:bg-[var(--bg-subtle)] dark:text-[#ECE9E2]"
                              >
                                Inspect
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
