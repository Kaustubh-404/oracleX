"use client";
import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useMarket } from "@/hooks/useMarkets";

interface Props {
  marketId: bigint;
}

/**
 * Generates synthetic historical probability data from contract state.
 * In production this would query an indexer (e.g. The Graph or a backend).
 * For the hackathon demo we seed a realistic-looking curve from the
 * current odds and a deterministic seed derived from the marketId.
 */
function generateChartData(
  marketId: bigint,
  yesPct: number,
  createdAt: number,
  closingTime: number
) {
  const POINTS = 24;
  const now = Math.floor(Date.now() / 1000);
  const start = createdAt;
  const end = Math.min(closingTime, now);
  const step = Math.max(Math.floor((end - start) / POINTS), 1);

  // Deterministic noise based on marketId
  const seed = Number(marketId % 1000n);

  const data: { time: string; yes: number; no: number }[] = [];
  let current = 50; // start at 50%

  for (let i = 0; i <= POINTS; i++) {
    const ts = start + step * i;
    if (ts > now) break;

    // Drift toward the final yesPct over time
    const progress = i / POINTS;
    const target = yesPct;
    const noise = Math.sin(seed * i * 0.3) * 4 * (1 - progress);
    current = current + (target - current) * 0.15 + noise;
    current = Math.max(5, Math.min(95, current));

    const date = new Date(ts * 1000);
    const label =
      end - start < 86400
        ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : date.toLocaleDateString([], { month: "short", day: "numeric" });

    data.push({
      time: label,
      yes: Math.round(current),
      no: Math.round(100 - current),
    });
  }

  return data;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className={p.name === "yes" ? "text-green-400" : "text-red-400"}>
          {p.name.toUpperCase()}: {p.value}%
        </p>
      ))}
    </div>
  );
};

export function ProbabilityChart({ marketId }: Props) {
  const { data: market } = useMarket(marketId);

  const yesPct = useMemo(() => {
    if (!market) return 50;
    const total = Number(market.yesPool + market.noPool);
    if (total === 0) return 50;
    return Math.round((Number(market.yesPool) / total) * 100);
  }, [market]);

  const chartData = useMemo(() => {
    if (!market) return [];
    const closingSec = Number(market.closingTime);
    // Estimate market creation = closingTime minus 7 days (or now, whichever is earlier)
    const estimatedStart = Math.min(
      closingSec - 7 * 86400,
      Math.floor(Date.now() / 1000) - 3600
    );
    return generateChartData(marketId, yesPct, estimatedStart, closingSec);
  }, [marketId, market, yesPct]);

  if (!market || chartData.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-600 text-xs">
        Not enough data to chart
      </div>
    );
  }

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <XAxis
            dataKey="time"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={50} stroke="#374151" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="yes"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#22c55e" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
