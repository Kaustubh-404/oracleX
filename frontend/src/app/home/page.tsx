"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimation,
  type PanInfo,
} from "framer-motion";
import { Check, X, RefreshCw } from "lucide-react";
import { formatTimeLeft, CATEGORY_META } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface Market {
  id: number;
  question: string;
  category: string;
  yesPool: string;
  noPool: string;
  closingTime: string;
  outcome: number;
}

/* ── Swipeable Card ────────────────────────────────────────── */
function SwipeableCard({
  market,
  onSwipe,
}: {
  market: Market;
  onSwipe: (dir: "left" | "right") => void;
}) {
  const x        = useMotionValue(0);
  const rotate   = useTransform(x, [-220, 220], [-22, 22]);
  const yesOpacity = useTransform(x, [-220, 0, 80], [0, 0, 1]);
  const noOpacity  = useTransform(x, [-80, 0, 220], [1, 0, 0]);
  const controls = useAnimation();

  const yesPct = (() => {
    const yes = Number(market.yesPool);
    const no  = Number(market.noPool);
    const tot = yes + no;
    return tot > 0 ? Math.round((yes / tot) * 100) : 50;
  })();

  const category = CATEGORY_META[market.category] ?? CATEGORY_META.default;

  async function handleDragEnd(_: never, info: PanInfo) {
    if (Math.abs(info.offset.x) > 100) {
      await controls.start({
        x: info.offset.x > 0 ? 1100 : -1100,
        transition: { duration: 0.28 },
      });
      onSwipe(info.offset.x > 0 ? "right" : "left");
      x.set(0);
      controls.set({ x: 0 });
    } else {
      controls.start({ x: 0, transition: { type: "spring", duration: 0.45 } });
    }
  }

  return (
    <motion.div
      className="absolute w-full touch-none"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.85}
      onDragEnd={handleDragEnd}
      animate={controls}
    >
      <div className="relative border-black border-4 rounded-2xl overflow-hidden shadow-[6px_6px_0px_#000]">
        {/* YES indicator */}
        <motion.div
          className="absolute top-5 right-5 bg-[#99ff88] p-3.5 rounded-full border-[3px] border-black z-20"
          style={{ opacity: yesOpacity }}
        >
          <Check strokeWidth={3} size={28} color="black" />
        </motion.div>

        {/* NO indicator */}
        <motion.div
          className="absolute top-5 left-5 bg-[#ff6961] p-3.5 rounded-full border-[3px] border-black z-20"
          style={{ opacity: noOpacity }}
        >
          <X strokeWidth={3} size={28} color="white" />
        </motion.div>

        {/* Card image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/cards.jpeg"
          alt="market"
          className="w-full object-cover select-none"
          style={{ height: "clamp(300px, 62vh, 520px)" }}
          draggable={false}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Info */}
        <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full border-2 border-white/30 bg-white/10 capitalize mb-2 inline-block`}
          >
            {category.emoji} {market.category}
          </span>
          <h2
            className="text-xl leading-snug mb-3"
            style={{ fontFamily: "'Brice SemiBold', sans-serif" }}
          >
            {market.question}
          </h2>

          {/* Probability */}
          <div className="flex items-center gap-3 mb-1">
            <div className="flex-1 h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#99ff88] rounded-full"
                style={{ width: `${yesPct}%` }}
              />
            </div>
            <span className="text-sm font-bold text-[#99ff88] shrink-0">
              {yesPct}% YES
            </span>
          </div>

          <p className="text-xs text-white/50 mt-1">
            {formatTimeLeft(BigInt(market.closingTime))}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Home Page ─────────────────────────────────────────────── */
export default function HomePage() {
  const account = useActiveAccount();
  const router  = useRouter();

  const [markets, setMarkets]   = useState<Market[]>([]);
  const [index, setIndex]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [done, setDone]         = useState(false);

  // Redirect to landing if not connected
  useEffect(() => {
    if (account === undefined) return; // still loading
    if (!account) router.replace("/");
  }, [account, router]);

  const loadMarkets = useCallback(() => {
    setLoading(true);
    setDone(false);
    setIndex(0);
    const now = Math.floor(Date.now() / 1000);
    fetch(`${BACKEND_URL}/markets`)
      .then((r) => r.json())
      .then((res: Market[] | { data: Market[] }) => {
        const data = Array.isArray(res) ? res : res.data ?? [];
        const open = data.filter(
          (m) => m.outcome === 0 && Number(m.closingTime) > now
        );
        setMarkets(open);
        if (open.length === 0) setDone(true);
      })
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  function handleSwipe(dir: "left" | "right") {
    if (dir === "right" && markets[index]) {
      router.push(`/markets/${markets[index].id}`);
    }
    const next = index + 1;
    if (next >= markets.length) {
      setDone(true);
    } else {
      setIndex(next);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#efe7f7]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-black border-t-[#d3aeff] rounded-full animate-spin mx-auto" />
          <p className="font-brice-regular">Loading markets…</p>
        </div>
      </div>
    );
  }

  if (done || markets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#efe7f7] px-8 pb-24">
        <div className="retro-card p-8 text-center max-w-sm w-full">
          <p className="text-5xl mb-4">🎯</p>
          <h2
            className="text-2xl mb-2"
            style={{ fontFamily: "'Brice Black', sans-serif" }}
          >
            All caught up!
          </h2>
          <p className="text-sm text-black/60 mb-6">
            {markets.length === 0
              ? "No open markets right now."
              : "You've seen all open markets."}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={loadMarkets}
              className="retro-btn bg-[#d3aeff] px-5 py-3 flex items-center justify-center gap-2 w-full"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              onClick={() => router.push("/markets")}
              className="retro-btn bg-black text-white px-5 py-3 w-full"
            >
              Browse All Markets →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = markets[index];

  return (
    <div
      className="flex flex-col min-h-screen bg-[#efe7f7]"
      style={{ fontFamily: "'Brice Regular', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h1 className="text-2xl" style={{ fontFamily: "'Brice Black', sans-serif" }}>
          OracleX
        </h1>
        <span className="text-xs text-black/40 font-brice-regular">
          {index + 1} / {markets.length}
        </span>
      </div>

      {/* Swipe area */}
      <div className="flex-1 relative px-4 pb-2" style={{ minHeight: "65vh" }}>
        {current && (
          <SwipeableCard
            key={current.id}
            market={current}
            onSwipe={handleSwipe}
          />
        )}
      </div>

      {/* Hint */}
      <div className="text-center pb-28 text-xs text-black/40 font-brice-regular">
        ← Skip &nbsp;·&nbsp; Bet →
      </div>
    </div>
  );
}
