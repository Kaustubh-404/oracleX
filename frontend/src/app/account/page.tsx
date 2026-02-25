"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount, useReadContract, useWalletDetailsModal } from "thirdweb/react";
import { client, CHAIN, USDC_ADDRESS } from "@/lib/thirdweb";
import { USDC_ABI } from "@/abis/OracleX";
import { getContract } from "thirdweb";
import Link from "next/link";
import { Trophy, ChartBarBig, Copy, CheckCheck, Wallet, LogOut } from "lucide-react";
import { backendFetch } from "@/lib/api";
import { isMiniApp } from "@/lib/worldid";
import { getMiniKitAddress, clearMiniKitAddress } from "@/lib/minikit-wallet";
const usdcContract = getContract({ client, chain: CHAIN, address: USDC_ADDRESS, abi: USDC_ABI });

interface Stats { totalVolume: string; tradeCount: number; }

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}···${addr.slice(-4)}`;
}

export default function AccountPage() {
  const account      = useActiveAccount();
  const router       = useRouter();
  const detailsModal = useWalletDetailsModal();
  const [copied, setCopied] = useState(false);
  const [stats,  setStats]  = useState<Stats | null>(null);

  const inWorldApp = isMiniApp();
  const miniKitAddr = inWorldApp ? getMiniKitAddress() : null;

  // The effective address: MiniKit in World App, thirdweb in browser
  const walletAddress = inWorldApp ? miniKitAddr : account?.address;

  useEffect(() => {
    if (inWorldApp) {
      if (!miniKitAddr) router.replace("/");
      return;
    }
    if (account === undefined) return;
    if (!account) router.replace("/");
  }, [account, router, inWorldApp, miniKitAddr]);

  // USDC balance — only for browser (thirdweb)
  const { data: usdcRaw } = useReadContract({
    contract: usdcContract,
    method:   "balanceOf",
    params:   [account?.address ?? "0x0000000000000000000000000000000000000000" as `0x${string}`],
    queryOptions: { enabled: !inWorldApp && !!account },
  });
  const usdcBalance = usdcRaw ? (Number(usdcRaw) / 1e6).toFixed(2) : "—";

  useEffect(() => {
    if (!walletAddress) return;
    backendFetch(`/positions/${walletAddress}`)
      .then((r) => r.json())
      .then((data) => {
        const trades: { amount: string }[] = Array.isArray(data) ? data : data.trades ?? data.data ?? [];
        const vol = trades.reduce((s, t) => s + parseFloat(t.amount || "0"), 0);
        setStats({ totalVolume: vol.toFixed(2), tradeCount: trades.length });
      })
      .catch(() => setStats(null));
  }, [walletAddress]);

  function copyAddress() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWalletModal() {
    detailsModal.open({ client, theme: "light" });
  }

  function handleWorldAppSignOut() {
    clearMiniKitAddress();
    router.replace("/");
  }

  const displayAddr = walletAddress ?? "";
  const avatarHue = displayAddr ? parseInt(displayAddr.slice(2, 8), 16) % 360 : 0;

  return (
    <div
      className="min-h-screen bg-[#efe7f7] pb-28 px-4"
      style={{ fontFamily: "'Brice Regular', sans-serif" }}
    >
      <div className="pt-5 pb-4">
        <h1 className="text-3xl" style={{ fontFamily: "'Brice Black', sans-serif" }}>Account</h1>
      </div>

      {/* Wallet card */}
      <div className="retro-card p-5 mb-4">
        {/* Avatar */}
        <div
          className="w-16 h-16 rounded-2xl border-4 border-black mb-3 flex items-center justify-center font-bold text-2xl select-none"
          style={{ background: `hsl(${avatarHue}, 65%, 72%)` }}
        >
          {displayAddr ? displayAddr.slice(2, 4).toUpperCase() : "??"}
        </div>

        {/* Address + copy */}
        {displayAddr && (
          <div className="flex items-center gap-2 mb-4">
            <span className="font-bold text-sm" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
              {shortAddr(displayAddr)}
            </span>
            <button
              onClick={copyAddress}
              className="border-2 border-black rounded-lg p-1.5 bg-white hover:bg-black/5 transition-colors"
              title="Copy address"
            >
              {copied
                ? <CheckCheck size={14} className="text-[#2d8a20]" />
                : <Copy size={14} className="text-black/50" />}
            </button>
          </div>
        )}

        {/* Balances */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {inWorldApp ? (
            <div className="border-4 border-black rounded-2xl p-3 bg-[#99ff88] min-w-0">
              <p className="text-xs text-black/60 mb-0.5">Wallet</p>
              <p className="text-sm font-bold leading-tight" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
                World App
              </p>
            </div>
          ) : (
            <div className="border-4 border-black rounded-2xl p-3 bg-[#99ff88] min-w-0">
              <p className="text-xs text-black/60 mb-0.5">USDC Balance</p>
              <p className="text-base font-bold leading-tight truncate" style={{ fontFamily: "'Brice Black', sans-serif" }}>
                ${usdcBalance}
              </p>
            </div>
          )}
          <div className="border-4 border-black rounded-2xl p-3 bg-[#d3aeff]">
            <p className="text-xs text-black/60 mb-0.5">Network</p>
            <p className="text-sm font-bold" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
              {inWorldApp ? "World Chain" : "Sepolia"}
            </p>
            <p className="text-xs text-black/50">Testnet</p>
          </div>
        </div>

        {/* Wallet management */}
        {inWorldApp ? (
          <>
            <button
              onClick={handleWorldAppSignOut}
              className="retro-btn w-full bg-black text-white py-3 flex items-center justify-center gap-2 text-sm"
            >
              <LogOut size={16} strokeWidth={2.5} />
              Sign Out
            </button>
            <p className="text-xs text-black/40 text-center mt-2">
              Signed in via World App
            </p>
          </>
        ) : (
          <>
            <button
              onClick={openWalletModal}
              className="retro-btn w-full bg-black text-white py-3 flex items-center justify-center gap-2 text-sm"
            >
              <Wallet size={16} strokeWidth={2.5} />
              Manage Wallet
            </button>
            <p className="text-xs text-black/40 text-center mt-2">
              Switch wallet · Disconnect · Settings
            </p>
          </>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="retro-card p-4 mb-4">
          <p className="font-bold mb-3" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
            Trading Stats
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-black rounded-xl p-3 text-center bg-white">
              <p className="text-2xl font-bold" style={{ fontFamily: "'Brice Black', sans-serif" }}>
                {stats.tradeCount}
              </p>
              <p className="text-xs text-black/50">Total Trades</p>
            </div>
            <div className="border-2 border-black rounded-xl p-3 text-center bg-white">
              <p className="text-2xl font-bold" style={{ fontFamily: "'Brice Black', sans-serif" }}>
                ${parseFloat(stats.totalVolume) >= 1000
                  ? `${(parseFloat(stats.totalVolume) / 1000).toFixed(1)}K`
                  : stats.totalVolume}
              </p>
              <p className="text-xs text-black/50">Volume</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="space-y-2">
        <Link
          href="/holdings"
          className="retro-card flex items-center gap-3 p-4 active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 bg-[#99ff88] border-2 border-black rounded-xl flex items-center justify-center shrink-0">
            <ChartBarBig size={18} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>My Holdings</p>
            <p className="text-xs text-black/50">View all your positions</p>
          </div>
          <span className="ml-auto text-black/30 text-lg">›</span>
        </Link>

        <Link
          href="/leaderboard"
          className="retro-card flex items-center gap-3 p-4 active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 bg-[#d3aeff] border-2 border-black rounded-xl flex items-center justify-center shrink-0">
            <Trophy size={18} />
          </div>
          <div>
            <p className="font-bold text-sm" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>Leaderboard</p>
            <p className="text-xs text-black/50">See top traders</p>
          </div>
          <span className="ml-auto text-black/30 text-lg">›</span>
        </Link>
      </div>
    </div>
  );
}
