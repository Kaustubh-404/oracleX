"use client";
import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface LeaderEntry {
  rank:        number;
  wallet:      string;
  totalVolume: string;
  tradeCount:  number;
  grade?:      string | null;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUSDC(raw: string) {
  const n = parseFloat(raw);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const GRADE_COLOR: Record<string, string> = {
  A: "text-green-400",
  B: "text-blue-400",
  C: "text-yellow-400",
  D: "text-orange-400",
  F: "text-red-400",
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/positions/leaderboard/all?limit=50`)
      .then((r) => r.json())
      .then(async (data: LeaderEntry[]) => {
        // Fetch Brier grades for all entries in parallel (best-effort)
        const withGrades = await Promise.all(
          data.map(async (e) => {
            try {
              const r = await fetch(`${BACKEND_URL}/positions/${e.wallet}/brier`);
              const b = await r.json() as { grade: string | null };
              return { ...e, grade: b.grade };
            } catch {
              return { ...e, grade: null };
            }
          })
        );
        setEntries(withGrades);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load leaderboard — backend offline?");
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-gray-400">
          Top traders by USDC volume. Calibration grade based on Brier score across resolved markets.
        </p>
      </div>

      {loading && (
        <div className="text-center text-gray-500 py-20">Loading…</div>
      )}

      {error && (
        <div className="text-center text-red-400 py-20">{error}</div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="text-center text-gray-500 py-20">No trades yet — be the first!</div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="px-5 py-3 text-left">#</th>
                <th className="px-5 py-3 text-left">Wallet</th>
                <th className="px-5 py-3 text-right">Volume</th>
                <th className="px-5 py-3 text-right">Trades</th>
                <th className="px-5 py-3 text-right" title="Brier score calibration grade — lower is better">Grade</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.wallet}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-5 py-3.5 text-gray-400 font-mono">
                    {MEDAL[e.rank] ?? e.rank}
                  </td>
                  <td className="px-5 py-3.5">
                    <a
                      href={`/profile/${e.wallet}`}
                      className="font-mono text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {shortAddr(e.wallet)}
                    </a>
                  </td>
                  <td className="px-5 py-3.5 text-right text-green-400 font-semibold">
                    {formatUSDC(e.totalVolume)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-400">
                    {e.tradeCount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {e.grade ? (
                      <span className={`font-bold ${GRADE_COLOR[e.grade] ?? "text-gray-400"}`}>
                        {e.grade}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grade legend */}
      <div className="mt-4 flex gap-4 justify-center text-xs text-gray-600">
        {[["A","<0.10"],["B","<0.15"],["C","<0.20"],["D","<0.25"],["F","≥0.25"]].map(([g, r]) => (
          <span key={g}>
            <span className={`font-bold ${GRADE_COLOR[g] ?? ""}`}>{g}</span> {r}
          </span>
        ))}
        <span className="text-gray-700">· Brier score (lower = better calibration)</span>
      </div>

      <p className="text-xs text-gray-600 text-center mt-3">
        Rankings update in real-time via on-chain event indexing.
      </p>
    </div>
  );
}
