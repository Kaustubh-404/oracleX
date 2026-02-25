"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import Link from "next/link";
import { formatTimeLeft, CATEGORY_META, OUTCOME_LABEL } from "@/lib/utils";
import { backendFetch } from "@/lib/api";
import { isMiniApp } from "@/lib/worldid";
import { WORLD_CHAIN_SLUG, SEPOLIA_CHAIN_SLUG } from "@/lib/worldchain";

interface Market {
  id: number;
  chain: string;
  question: string;
  category: string;
  yesPool: string;
  noPool: string;
  closingTime: string;
  outcome: number;
  aiConfidenceBps: string;
}

type Filter = "ongoing" | "ended" | "settled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ongoing", label: "Ongoing"  },
  { key: "ended",   label: "Ended"    },
  { key: "settled", label: "Settled"  },
];

function MarketCard({ m }: { m: Market }) {
  const now    = Math.floor(Date.now() / 1000);
  const isOpen = m.outcome === 0;
  const closed = isOpen && Number(m.closingTime) <= now;
  const yes    = Number(m.yesPool);
  const no     = Number(m.noPool);
  const total  = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;
  const noPct  = 100 - yesPct;
  const cat    = CATEGORY_META[m.category] ?? CATEGORY_META.default;

  const statusLabel = (() => {
    if (m.outcome === 1) return { text: "YES",     bg: "bg-[#99ff88] text-black" };
    if (m.outcome === 2) return { text: "NO",      bg: "bg-[#ff6961] text-white" };
    if (m.outcome === 3) return { text: "INVALID", bg: "bg-black text-white"     };
    if (closed)          return { text: "Ended",   bg: "bg-black text-white"     };
    return { text: formatTimeLeft(BigInt(m.closingTime)), bg: "bg-[#d3aeff] text-black" };
  })();

  return (
    <Link href={`/markets/${m.id}?chain=${m.chain ?? "sepolia"}`}>
      <div className="retro-card p-4 cursor-pointer active:scale-[0.98] transition-transform">
        {/* Top row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold capitalize">
            {cat.emoji} {m.category}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border-2 border-black ${statusLabel.bg}`}>
            {statusLabel.text}
          </span>
        </div>

        {/* Question */}
        <p
          className="text-sm leading-snug line-clamp-2 mb-3"
          style={{ fontFamily: "'Brice SemiBold', sans-serif" }}
        >
          {m.question}
        </p>

        {/* Probability bar (only for open/ended) */}
        {m.outcome === 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs font-bold mb-1">
              <span className="text-[#2d8a20]">YES {yesPct}%</span>
              <span className="text-[#c0392b]">NO {noPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-black/10 border-2 border-black overflow-hidden">
              <div
                className="h-full bg-[#99ff88] rounded-full"
                style={{ width: `${yesPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Volume */}
        <div className="flex items-center justify-between text-xs text-black/50">
          <span>
            ${((yes + no) / 1e6).toFixed(0)} vol
          </span>
          {m.outcome !== 0 && (
            <span className="font-bold text-black/70">
              {m.outcome === 1 ? `YES won` : m.outcome === 2 ? "NO won" : "Refunded"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function MarketsPage() {
  const account = useActiveAccount();
  const router  = useRouter();
  const [filter, setFilter]   = useState<Filter>("ongoing");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (account === undefined) return;
    if (!account) router.replace("/");
  }, [account, router]);

  useEffect(() => {
    const chain = isMiniApp() ? WORLD_CHAIN_SLUG : SEPOLIA_CHAIN_SLUG;
    backendFetch(`/markets?chain=${chain}`)
      .then((r) => r.json())
      .then((res: Market[] | { data: Market[] }) => {
        const data = Array.isArray(res) ? res : res.data;
        setMarkets(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now      = Math.floor(Date.now() / 1000);
  const filtered = markets.filter((m) => {
    if (filter === "ongoing")  return m.outcome === 0 && Number(m.closingTime) > now;
    if (filter === "ended")    return m.outcome === 0 && Number(m.closingTime) <= now;
    if (filter === "settled")  return m.outcome !== 0;
    return true;
  });

  return (
    <div
      className="min-h-screen bg-[#efe7f7] pb-28"
      style={{ fontFamily: "'Brice Regular', sans-serif" }}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-3xl" style={{ fontFamily: "'Brice Black', sans-serif" }}>
          Markets
        </h1>
      </div>

      {/* Filter tabs */}
      <div className="flex px-4 gap-2 mb-4">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`retro-btn px-4 py-2 text-sm transition-all ${
              filter === key
                ? "bg-black text-white"
                : "bg-white text-black"
            }`}
            style={{ borderWidth: "3px" }}
          >
            {label}
            {!loading && (
              <span className="ml-1.5 text-xs opacity-60">
                {markets.filter((m) => {
                  if (key === "ongoing") return m.outcome === 0 && Number(m.closingTime) > now;
                  if (key === "ended")   return m.outcome === 0 && Number(m.closingTime) <= now;
                  return m.outcome !== 0;
                }).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="retro-card h-36 animate-pulse bg-black/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-brice-regular text-black/50">
              No {filter} markets yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((m) => (
              <MarketCard key={m.id} m={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
