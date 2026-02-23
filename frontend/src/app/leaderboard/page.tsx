"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface LeaderEntry { rank: number; wallet: string; totalVolume: string; tradeCount: number; grade?: string | null; }

function shortAddr(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }
function fmtVol(raw: string) {
  const n = parseFloat(raw);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const GRADE_BG: Record<string, string> = {
  A: "bg-[#99ff88] text-black", B: "bg-[#d3aeff] text-black",
  C: "bg-yellow-300 text-black", D: "bg-orange-300 text-black", F: "bg-[#ff6961] text-white",
};

export default function LeaderboardPage() {
  const account = useActiveAccount();
  const router  = useRouter();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (account === undefined) return;
    if (!account) router.replace("/");
  }, [account, router]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/positions/leaderboard/all?limit=50`)
      .then((r) => r.json())
      .then(async (data: LeaderEntry[]) => {
        const withGrades = await Promise.all(
          data.map(async (e) => {
            try {
              const r = await fetch(`${BACKEND_URL}/positions/${e.wallet}/brier`);
              const b = await r.json() as { grade: string | null };
              return { ...e, grade: b.grade };
            } catch { return { ...e, grade: null }; }
          })
        );
        setEntries(withGrades); setLoading(false);
      })
      .catch(() => { setError("Backend offline — try again later"); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-[#efe7f7] pb-28 px-4" style={{ fontFamily: "'Brice Regular', sans-serif" }}>
      <div className="pt-5 pb-4">
        <h1 className="text-3xl" style={{ fontFamily: "'Brice Black', sans-serif" }}>Leaderboard</h1>
        <p className="text-sm text-black/50 mt-1">Top traders by USDC volume</p>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-black border-t-[#d3aeff] rounded-full animate-spin" />
        </div>
      )}

      {error && <div className="retro-card p-6 text-center text-[#ff6961]">{error}</div>}

      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-20">
          <p className="text-5xl mb-3">🏆</p>
          <p className="text-black/50">No trades yet — be the first!</p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.wallet} className="retro-card flex items-center gap-3 p-4">
              {/* Rank */}
              <div className="w-8 text-center font-bold text-lg shrink-0" style={{ fontFamily: "'Brice Black', sans-serif" }}>
                {MEDAL[e.rank] ?? `#${e.rank}`}
              </div>

              {/* Wallet */}
              <div className="flex-1 min-w-0">
                <a href={`/profile/${e.wallet}`} className="font-bold text-sm underline decoration-dotted truncate block">
                  {shortAddr(e.wallet)}
                </a>
                <p className="text-xs text-black/40">{e.tradeCount} trades</p>
              </div>

              {/* Volume */}
              <div className="text-right shrink-0">
                <p className="font-bold text-base" style={{ fontFamily: "'Brice Black', sans-serif" }}>
                  {fmtVol(e.totalVolume)}
                </p>
                {e.grade && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-2 border-black ${GRADE_BG[e.grade] ?? "bg-white"}`}>
                    {e.grade}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grade legend */}
      {!loading && entries.length > 0 && (
        <div className="mt-6 retro-card p-3 flex flex-wrap gap-2 justify-center">
          {[["A","<0.10"],["B","<0.15"],["C","<0.20"],["D","<0.25"],["F","≥0.25"]].map(([g, r]) => (
            <span key={g} className="text-xs flex items-center gap-1">
              <span className={`font-bold px-1.5 py-0.5 rounded border-2 border-black ${GRADE_BG[g] ?? ""}`}>{g}</span>
              <span className="text-black/40">{r}</span>
            </span>
          ))}
          <span className="text-xs text-black/30 w-full text-center mt-1">Brier score calibration (lower = better)</span>
        </div>
      )}
    </div>
  );
}
