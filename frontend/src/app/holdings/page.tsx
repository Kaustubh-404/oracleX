"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { prepareContractCall, getContract } from "thirdweb";
import { client, CHAIN, ORACLEX_ADDRESS } from "@/lib/thirdweb";
import { ORACLE_X_ABI } from "@/abis/OracleX";
import { useMarket, useUserPositions, useMarketCount } from "@/hooks/useMarkets";
import { formatUSDC, formatTimeLeft, OUTCOME_LABEL, CATEGORY_META } from "@/lib/utils";

const oracleXContract = getContract({ client, chain: CHAIN, address: ORACLEX_ADDRESS, abi: ORACLE_X_ABI });

const STATUS_STYLES: Record<string, string> = {
  Live:      "bg-[#d3aeff] text-black border-black",
  Ended:     "bg-black     text-white border-black",
  Claimable: "bg-[#99ff88] text-black border-black",
  Done:      "bg-black/10  text-black/50 border-black/20",
};

function PositionRow({
  marketId,
  userAddress,
  onLoaded,
  onFound,
}: {
  marketId: bigint;
  userAddress: string;
  onLoaded: () => void;
  onFound: () => void;
}) {
  const { data: market }    = useMarket(marketId);
  const { data: positions } = useUserPositions(marketId, userAddress);
  const { mutate: sendTx, isPending } = useSendTransaction();

  const reported = useRef(false);
  useEffect(() => {
    if (reported.current || !market || !positions) return;
    reported.current = true;
    onLoaded();
    if (positions[0] > 0n || positions[1] > 0n) onFound();
  }, [market, positions, onLoaded, onFound]);

  if (!market || !positions) return null;

  const yesAmt  = positions[0];
  const noAmt   = positions[1];
  if (yesAmt === 0n && noAmt === 0n) return null;

  const outcome  = Number(market.outcome);
  const isOpen   = outcome === 0;
  const now      = BigInt(Math.floor(Date.now() / 1000));
  const isClosed = isOpen && market.closingTime < now;
  const cat      = CATEGORY_META[market.category] ?? CATEGORY_META.default;

  const canClaim =
    !isOpen &&
    ((outcome === 1 && yesAmt > 0n) ||
     (outcome === 2 && noAmt  > 0n) ||
     (outcome === 3 && (yesAmt > 0n || noAmt > 0n)));

  const statusKey = !isOpen
    ? canClaim ? "Claimable" : "Done"
    : isClosed ? "Ended" : "Live";

  function handleClaim() {
    const tx = prepareContractCall({
      contract: oracleXContract,
      method:   "claimWinnings",
      params:   [marketId],
    });
    sendTx(tx);
  }

  return (
    <div className="retro-card p-4">
      {/* Market question */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/markets/${marketId}`} className="flex-1">
          <p className="text-sm leading-snug line-clamp-2" style={{ fontFamily: "'Brice SemiBold', sans-serif" }}>
            {cat.emoji} {market.question}
          </p>
        </Link>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border-2 shrink-0 ${STATUS_STYLES[statusKey]}`}>
          {statusKey}
        </span>
      </div>

      {/* Position */}
      <div className="flex gap-2 mb-3">
        {yesAmt > 0n && (
          <div className="flex-1 bg-[#99ff88] border-2 border-black rounded-xl px-3 py-1.5 text-center">
            <p className="text-xs font-bold text-black/60">YES</p>
            <p className="text-sm font-bold" style={{ fontFamily: "'Brice Black', sans-serif" }}>
              {formatUSDC(yesAmt)}
            </p>
          </div>
        )}
        {noAmt > 0n && (
          <div className="flex-1 bg-[#ff6961] border-2 border-black rounded-xl px-3 py-1.5 text-center">
            <p className="text-xs font-bold text-white/70">NO</p>
            <p className="text-sm font-bold text-white" style={{ fontFamily: "'Brice Black', sans-serif" }}>
              {formatUSDC(noAmt)}
            </p>
          </div>
        )}
      </div>

      {/* Action */}
      {canClaim ? (
        <button
          onClick={handleClaim}
          disabled={isPending}
          className="retro-btn w-full bg-[#99ff88] text-black py-2.5 text-sm"
        >
          {isPending ? "Claiming…" : "Claim Winnings 🎉"}
        </button>
      ) : isOpen && !isClosed ? (
        <Link
          href={`/markets/${marketId}`}
          className="retro-btn block text-center bg-white text-black py-2.5 text-sm"
        >
          Trade →
        </Link>
      ) : (
        <div className="text-xs text-black/40 text-center py-1">
          {isClosed
            ? "Awaiting settlement"
            : outcome === 3
            ? "Refunded"
            : `Lost — ${OUTCOME_LABEL[outcome]} won`}
        </div>
      )}
    </div>
  );
}

function AllPositions({ address }: { address: string }) {
  const { data: count } = useMarketCount();
  const [loaded,  setLoaded]  = useState(0);
  const [found,   setFound]   = useState(0);

  const marketIds = useMemo(() => {
    if (!count) return [];
    const ids: bigint[] = [];
    for (let i = 1n; i <= count; i++) ids.push(i);
    return ids;
  }, [count]);

  const total      = marketIds.length;
  const allChecked = total > 0 && loaded >= total;
  const isEmpty    = allChecked && found === 0;

  if (!count) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-3">📭</p>
        <p className="text-black/50">Nothing here yet — go make some predictions!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {marketIds.map((id) => (
          <PositionRow
            key={id.toString()}
            marketId={id}
            userAddress={address}
            onLoaded={() => setLoaded((n) => n + 1)}
            onFound={() => setFound((n) => n + 1)}
          />
        ))}
      </div>

      {isEmpty && (
        <div className="retro-card p-8 text-center mt-4">
          <p className="text-5xl mb-3">📭</p>
          <p className="font-bold text-lg mb-1" style={{ fontFamily: "'Brice Black', sans-serif" }}>
            Nothing to see here
          </p>
          <p className="text-sm text-black/50 mb-5">
            You haven&apos;t placed any bets yet.
          </p>
          <a
            href="/home"
            className="retro-btn inline-block bg-black text-white px-6 py-3 text-sm"
          >
            Browse Markets →
          </a>
        </div>
      )}
    </>
  );
}

export default function HoldingsPage() {
  const account = useActiveAccount();
  const router  = useRouter();

  useEffect(() => {
    if (account === undefined) return;
    if (!account) router.replace("/");
  }, [account, router]);

  return (
    <div className="min-h-screen bg-[#efe7f7] pb-28 px-4" style={{ fontFamily: "'Brice Regular', sans-serif" }}>
      <div className="pt-5 pb-4">
        <h1 className="text-3xl" style={{ fontFamily: "'Brice Black', sans-serif" }}>
          Holdings
        </h1>
        <p className="text-sm text-black/50 mt-1">Your prediction market positions</p>
      </div>

      {!account ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-3">👛</p>
          <p className="font-brice-regular text-black/50">Connect your wallet to see holdings</p>
        </div>
      ) : (
        <AllPositions address={account.address} />
      )}
    </div>
  );
}
