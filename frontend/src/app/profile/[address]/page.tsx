"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { backendFetch } from "@/lib/api";

interface Position {
  marketId:    string;
  question:    string;
  category:    string;
  yesNet:      number;
  noNet:       number;
  outcome:     number;   // 0=open 1=YES 2=NO 3=INVALID
  closingTime: string;
}

interface Trade {
  id:          number;
  marketId:    string;
  side:        string;
  action:      string;
  usdcAmount:  string;
  txHash:      string | null;
  createdAt:   string;
  market?: {
    question: string;
  };
}

interface ProfileData {
  data:      Position[];
  allTrades: Trade[];
  meta:      { total: number };
}

interface BrierData {
  score:          number | null;
  grade:          string | null;
  resolvedTrades: number;
}

const GRADE_COLOR: Record<string, string> = {
  A: "text-green-400 border-green-500/30 bg-green-500/10",
  B: "text-blue-400  border-blue-500/30  bg-blue-500/10",
  C: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  D: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  F: "text-red-400   border-red-500/30   bg-red-500/10",
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUSDC(n: number) {
  return `$${n.toFixed(2)}`;
}

const OUTCOME_LABEL: Record<number, { label: string; color: string }> = {
  0: { label: "Open",    color: "text-blue-400"   },
  1: { label: "YES",     color: "text-green-400"  },
  2: { label: "NO",      color: "text-red-400"    },
  3: { label: "Invalid", color: "text-yellow-400" },
};

export default function ProfilePage() {
  const params  = useParams();
  const address = (params.address as string).toLowerCase();

  const [data,    setData]    = useState<ProfileData | null>(null);
  const [brier,   setBrier]   = useState<BrierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<"positions" | "history">("positions");

  useEffect(() => {
    if (!address) return;
    Promise.all([
      backendFetch(`/positions/${address}?limit=200`).then((r) => r.json()),
      backendFetch(`/positions/${address}/brier`).then((r) => r.json()),
    ])
      .then(([profileData, brierData]: [ProfileData, BrierData]) => {
        setData(profileData);
        setBrier(brierData);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load profile — backend offline?");
        setLoading(false);
      });
  }, [address]);

  // Compute summary stats
  const totalVolume = data?.allTrades.reduce(
    (acc, t) => acc + parseFloat(t.usdcAmount), 0
  ) ?? 0;
  const openPositions = data?.data.length ?? 0;
  const tradeCount    = data?.meta.total ?? 0;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 font-mono">
            {shortAddr(address)}
          </h1>
          <p className="text-gray-500 text-sm font-mono break-all">{address}</p>
        </div>
        <a
          href={`https://sepolia.etherscan.io/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 mt-1"
        >
          Etherscan ↗
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Volume",   value: `$${totalVolume.toFixed(2)}` },
          { label: "Trades",         value: tradeCount.toLocaleString()  },
          { label: "Open Positions", value: openPositions.toString()     },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white mb-1">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}

        {/* Brier Grade */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          {brier?.grade ? (
            <>
              <p className={`text-2xl font-bold mb-1 ${(GRADE_COLOR[brier.grade] ?? "text-gray-400").split(" ")[0]}`}>
                {brier.grade}
              </p>
              <p className="text-xs text-gray-500">Calibration</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {brier.resolvedTrades} resolved
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-600 mb-1">—</p>
              <p className="text-xs text-gray-500">Calibration</p>
              <p className="text-xs text-gray-600 mt-0.5">No resolved trades</p>
            </>
          )}
        </div>
      </div>

      {/* Brier score explainer */}
      {brier?.grade && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 mb-6 text-xs ${GRADE_COLOR[brier.grade] ?? ""}`}>
          <span className="text-lg mt-0.5">
            {brier.grade === "A" ? "🏆" : brier.grade === "B" ? "🎯" : brier.grade === "C" ? "📊" : brier.grade === "D" ? "📉" : "⚠️"}
          </span>
          <div>
            <p className="font-semibold mb-0.5">
              Grade {brier.grade} — Brier Score {brier.score?.toFixed(3)}
            </p>
            <p className="opacity-80">
              {brier.grade === "A" && "Exceptional calibration. Your probability estimates are highly accurate."}
              {brier.grade === "B" && "Good calibration. You consistently pick well-priced positions."}
              {brier.grade === "C" && "Average calibration. Room to improve prediction accuracy."}
              {brier.grade === "D" && "Below average. Try focusing on higher-confidence opportunities."}
              {brier.grade === "F" && "Poor calibration. Consider the base rates before betting."}
              {" "}Lower is better — A &lt; 0.10, B &lt; 0.15, C &lt; 0.20, D &lt; 0.25, F ≥ 0.25.
            </p>
          </div>
        </div>
      )}

      {loading && <div className="text-center text-gray-500 py-20">Loading…</div>}
      {error   && <div className="text-center text-red-400 py-10">{error}</div>}

      {!loading && !error && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
            {(["positions", "history"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                  tab === t
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Positions tab */}
          {tab === "positions" && (
            <div className="space-y-3">
              {data?.data.length === 0 && (
                <p className="text-gray-500 text-center py-10">No open positions.</p>
              )}
              {data?.data.map((pos) => {
                const outcome = OUTCOME_LABEL[pos.outcome];
                return (
                  <Link
                    key={pos.marketId}
                    href={`/markets/${pos.marketId}`}
                    className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium mb-1 truncate">
                          {pos.question}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">{pos.category}</p>
                      </div>
                      <span className={`text-xs font-semibold ${outcome.color} shrink-0`}>
                        {outcome.label}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-6 text-sm">
                      {pos.yesNet > 0.001 && (
                        <div>
                          <span className="text-gray-500 text-xs">YES</span>
                          <p className="text-green-400 font-semibold">{formatUSDC(pos.yesNet)}</p>
                        </div>
                      )}
                      {pos.noNet > 0.001 && (
                        <div>
                          <span className="text-gray-500 text-xs">NO</span>
                          <p className="text-red-400 font-semibold">{formatUSDC(pos.noNet)}</p>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* History tab */}
          {tab === "history" && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {data?.allTrades.length === 0 && (
                <p className="text-gray-500 text-center py-10">No trades yet.</p>
              )}
              {(data?.allTrades ?? []).length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="px-4 py-3 text-left">Market</th>
                      <th className="px-4 py-3 text-center">Side</th>
                      <th className="px-4 py-3 text-center">Action</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.allTrades.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/markets/${t.marketId}`}
                            className="text-blue-400 hover:text-blue-300 text-xs truncate block max-w-[200px]"
                          >
                            {t.market?.question
                              ? t.market.question.slice(0, 40) + (t.market.question.length > 40 ? "…" : "")
                              : `#${t.marketId}`}
                          </Link>
                        </td>
                        <td className={`px-4 py-3 text-center text-xs font-semibold ${
                          t.side === "YES" ? "text-green-400" : "text-red-400"
                        }`}>
                          {t.side}
                        </td>
                        <td className={`px-4 py-3 text-center text-xs ${
                          t.action === "BUY" ? "text-blue-400" : "text-orange-400"
                        }`}>
                          {t.action}
                        </td>
                        <td className="px-4 py-3 text-right text-white font-mono text-xs">
                          ${parseFloat(t.usdcAmount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
