"use client";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, X, Sparkles, Clock, Bot, Trophy, AlertTriangle, RefreshCw } from "lucide-react";

const SECTIONS = [
  {
    title: "Welcome to OracleX",
    icon: "crystal_ball",
    content: [
      "OracleX is an AI-powered prediction market platform built on Chainlink CRE.",
      "Create markets on any topic, trade YES/NO shares, and let AI resolve the outcome using real-world data.",
      "Every settlement is decentralized \u2014 Chainlink DON nodes run AI independently and must reach consensus.",
    ],
  },
  {
    title: "Home \u2014 Swipe to Discover",
    icon: "swipe",
    content: [
      "The Home tab shows markets as swipeable cards (like Tinder).",
      "Swipe RIGHT \u2192 to view market details and place a bet.",
      "Swipe LEFT \u2190 to skip and see the next market.",
      "The card shows the market question, current YES probability, and time remaining.",
    ],
  },
  {
    title: "Markets \u2014 Browse & Filter",
    icon: "list",
    content: [
      "The Markets tab shows all markets in a scrollable list.",
      "Filter by status: Open, Closed, or Settled.",
      "Tap any market to see full details, odds chart, and the trade panel.",
      "Settled markets show the AI\u2019s reasoning and confidence score.",
    ],
  },
  {
    title: "Buying Shares",
    icon: "buy",
    content: [
      "On a market detail page, choose YES or NO.",
      "Enter the USDC amount you want to bet.",
      "The price adjusts automatically using a Constant Product Market Maker (CPMM) \u2014 the more people buy one side, the more expensive it becomes.",
      "After buying, your position appears in the Holdings tab.",
    ],
  },
  {
    title: "Create Market",
    icon: "create",
    content: [
      "Tap the + button in the navigation bar.",
      "Choose a category: Crypto, Sports, Tech, or News.",
      "Write a yes/no question (e.g., \u201cWill ETH hit $5k by June?\u201d).",
      "Use \u201cAuto-fill with AI\u201d to get resolution source and criteria suggestions.",
      "Set the duration and initial liquidity, then create!",
      "In World App, you\u2019ll verify with World ID first (sybil resistance).",
    ],
  },
  {
    title: "Holdings \u2014 Your Positions",
    icon: "holdings",
    content: [
      "The Holdings tab shows all your active and resolved positions.",
      "Each position shows your YES/NO share amounts and current status:",
      "\u2022 Live \u2014 Market is still open for trading",
      "\u2022 Ended \u2014 Market closed, awaiting AI settlement",
      "\u2022 Claimable \u2014 You won! Tap to claim your USDC",
      "\u2022 Invalid \u2014 AI couldn\u2019t determine the outcome, you\u2019re refunded",
      "\u2022 Done \u2014 Market settled, position closed",
    ],
  },
  {
    title: "AI Settlement via Chainlink CRE",
    icon: "ai",
    content: [
      "When a market\u2019s closing time passes, anyone can tap \u201cRequest AI Settlement.\u201d",
      "This emits a SettlementRequested event on-chain.",
      "The Chainlink CRE workflow detects this event and each DON node independently:",
      "\u2022 Reads the market question from the blockchain",
      "\u2022 Fetches real-world data (CoinGecko, Odds API, NewsAPI)",
      "\u2022 Calls Groq AI (llama-3.3-70b) to determine the outcome",
      "All nodes must reach identical consensus (BFT).",
      "The settlement is written on-chain with the outcome, confidence score, and AI reasoning.",
    ],
  },
  {
    title: "Outcomes Explained",
    icon: "outcomes",
    content: [
      "After AI settlement, there are three possible outcomes:",
    ],
    outcomes: [
      {
        label: "YES / NO",
        color: "bg-[#99ff88]",
        text: "AI determined the answer with \u226580% confidence. Winners claim proportional USDC payouts. Losers receive nothing.",
      },
      {
        label: "INVALID",
        color: "bg-[#fbbf24]",
        text: "AI couldn\u2019t determine the outcome (e.g., question about full year 2026 asked in March). ALL positions are refunded \u2014 nobody loses.",
      },
    ],
    extra: [
      "Example: \u201cWill the Fed cut rates twice in 2026?\u201d resolved as INVALID because we\u2019re only 2.5 months into 2026 \u2014 insufficient evidence.",
    ],
  },
  {
    title: "Claiming Rewards",
    icon: "claim",
    content: [
      "If you won (or market was INVALID), go to the Holdings tab.",
      "Your position will show \u201cClaimable\u201d status with a green badge.",
      "Tap \u201cClaim Winnings\u201d to receive your USDC back to your wallet.",
      "For INVALID markets, you get your full position refunded.",
      "For winning bets, you receive proportional winnings from the losing pool.",
    ],
  },
  {
    title: "Powered By",
    icon: "stack",
    content: [
      "\u2022 Chainlink CRE \u2014 Decentralized AI oracle execution",
      "\u2022 Groq AI (llama-3.3-70b) \u2014 Fast, accurate market resolution",
      "\u2022 World Chain \u2014 Gas-free transactions in World App",
      "\u2022 World ID \u2014 Sybil-resistant market creation",
      "\u2022 Ethereum Sepolia \u2014 Web app chain",
      "\u2022 thirdweb v5 \u2014 Wallet connection & contract interaction",
    ],
  },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  crystal_ball: <span className="text-3xl">🔮</span>,
  swipe:        <span className="text-3xl">👆</span>,
  list:         <span className="text-3xl">📋</span>,
  buy:          <span className="text-3xl">💰</span>,
  create:       <span className="text-3xl">✨</span>,
  holdings:     <span className="text-3xl">📊</span>,
  ai:           <Bot size={30} />,
  outcomes:     <AlertTriangle size={30} />,
  claim:        <Trophy size={30} />,
  stack:        <span className="text-3xl">⚡</span>,
};

export default function GuidePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#efe7f7] pb-28 px-4" style={{ fontFamily: "'Brice Regular', sans-serif" }}>
      <div className="pt-5 pb-2">
        <h1 className="text-3xl" style={{ fontFamily: "'Brice Black', sans-serif" }}>
          How It Works
        </h1>
        <p className="text-sm text-black/50 mt-1">Your guide to OracleX prediction markets</p>
      </div>

      <div className="space-y-4 max-w-lg">
        {SECTIONS.map((section, i) => (
          <div key={i} className="retro-card p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#d3aeff] border-2 border-black rounded-xl flex items-center justify-center shrink-0">
                {ICON_MAP[section.icon]}
              </div>
              <div>
                <span className="text-[10px] font-bold text-black/40 block">Step {i + 1}</span>
                <h2 className="text-base leading-tight" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
                  {section.title}
                </h2>
              </div>
            </div>

            <div className="space-y-2 ml-1">
              {section.content.map((line, j) => (
                <p key={j} className="text-sm text-black/70 leading-relaxed">
                  {line}
                </p>
              ))}
            </div>

            {/* Outcome cards */}
            {section.outcomes && (
              <div className="space-y-2 mt-3">
                {section.outcomes.map((o, j) => (
                  <div key={j} className={`${o.color} border-2 border-black rounded-xl p-3`}>
                    <p className="font-bold text-sm mb-1" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
                      {o.label}
                    </p>
                    <p className="text-xs text-black/70">{o.text}</p>
                  </div>
                ))}
              </div>
            )}

            {section.extra && (
              <div className="mt-3 border-2 border-[#d3aeff] rounded-xl p-3 bg-[#d3aeff]/20">
                {section.extra.map((line, j) => (
                  <p key={j} className="text-xs text-black/60">{line}</p>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* CTA */}
        <button
          onClick={() => router.push("/home")}
          className="retro-btn w-full bg-black text-white py-4 text-base mb-8"
        >
          Start Trading →
        </button>
      </div>
    </div>
  );
}
