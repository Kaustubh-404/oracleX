import { formatDistanceToNow, format } from "date-fns";

// Format USDC (6 decimals) → "$1,234.56"
export function formatUSDC(raw: bigint): string {
  const value = Number(raw) / 1e6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Parse dollar string → USDC bigint (6 decimals)
export function parseUSDC(dollars: string): bigint {
  const num = parseFloat(dollars);
  if (isNaN(num) || num < 0) return 0n;
  return BigInt(Math.round(num * 1e6));
}

// Parse token string → WLD bigint (18 decimals)
export function parseWLD(amount: string): bigint {
  const num = parseFloat(amount);
  if (isNaN(num) || num < 0) return 0n;
  // Use string manipulation to avoid floating point precision issues
  const [whole, frac = ""] = amount.split(".");
  const padded = (frac + "000000000000000000").slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(padded);
}

// Format WLD (18 decimals) → "1,234.56 WLD"
export function formatWLD(raw: bigint): string {
  const value = Number(raw) / 1e18;
  return value.toFixed(2) + " WLD";
}

// Unix timestamp → "3h 22m left" or "Closed"
export function formatTimeLeft(closingTime: bigint): string {
  const ms = Number(closingTime) * 1000;
  if (ms < Date.now()) return "Closed";
  return formatDistanceToNow(ms, { addSuffix: false }) + " left";
}

// Unix timestamp → "Mar 1, 2026"
export function formatDate(ts: bigint): string {
  return format(new Date(Number(ts) * 1000), "MMM d, yyyy HH:mm 'UTC'");
}

// Market outcome number → label
export const OUTCOME_LABEL: Record<number, string> = {
  0: "Open",
  1: "YES",
  2: "NO",
  3: "Invalid",
};

export const OUTCOME_COLOR: Record<number, string> = {
  0: "text-gray-400",
  1: "text-yes",
  2: "text-no",
  3: "text-yellow-400",
};

// Category → emoji + color
export const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  crypto:  { emoji: "🪙", color: "bg-yellow-500/20 text-yellow-300" },
  sports:  { emoji: "⚽", color: "bg-blue-500/20 text-blue-300"    },
  tech:    { emoji: "💻", color: "bg-purple-500/20 text-purple-300" },
  news:    { emoji: "📰", color: "bg-gray-500/20 text-gray-300"     },
  default: { emoji: "❓", color: "bg-gray-500/20 text-gray-300"     },
};

// Truncate wallet address: "0x1234...abcd"
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Confidence bps → percentage string
export function formatConfidence(bps: bigint): string {
  return `${(Number(bps) / 100).toFixed(1)}%`;
}

// Map raw getMarket() tuple → named object
// getMarket returns a struct (tuple), viem decodes it as a named object
export function parseMarket(raw: {
  id: bigint; question: string; category: string; resolutionSource: string;
  closingTime: bigint; settlementDeadline: bigint; collateral: string;
  yesPool: bigint; noPool: bigint; outcome: number; settlementRequested: boolean;
  aiConfidenceBps: bigint; creator: string;
}) {
  return {
    id:                  raw.id,
    question:            raw.question,
    category:            raw.category,
    resolutionSource:    raw.resolutionSource,
    closingTime:         raw.closingTime,
    settlementDeadline:  raw.settlementDeadline,
    collateral:          raw.collateral  as `0x${string}`,
    yesPool:             raw.yesPool,
    noPool:              raw.noPool,
    outcome:             raw.outcome,
    settlementRequested: raw.settlementRequested,
    aiConfidenceBps:     raw.aiConfidenceBps,
    creator:             raw.creator as `0x${string}`,
  };
}

export type MarketData = ReturnType<typeof parseMarket>;
