"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { ConnectButton } from "thirdweb/react";
import { client, CHAIN } from "@/lib/thirdweb";
import { isMiniApp } from "@/lib/worldid";

export default function LandingPage() {
  const account    = useActiveAccount();
  const router     = useRouter();
  const [inWorld, setInWorld] = useState(false);

  useEffect(() => {
    setInWorld(isMiniApp());
  }, []);

  useEffect(() => {
    if (account) router.replace("/home");
  }, [account, router]);

  return (
    <div
      className="relative flex flex-col justify-end gap-8 px-8 pb-14 pt-10 min-h-screen w-screen overflow-hidden"
      style={{ background: "#d3aeff", fontFamily: "'Brice Regular', sans-serif" }}
    >
      {/* ── Decorative assets ──────────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/starsquare.png"
        alt=""
        className="absolute w-[18vw] h-[18vh] top-6 left-28 object-contain pointer-events-none select-none"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/star2.png"
        alt=""
        className="absolute w-[14vw] h-[18vh] top-28 left-8 object-contain rotate-[40deg] pointer-events-none select-none"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/flower.png"
        alt=""
        className="absolute w-[38vw] h-[42vh] top-20 left-28 object-contain pointer-events-none select-none"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/star3.png"
        alt=""
        className="absolute w-[40vw] h-[38vh] top-4 right-6 object-contain pointer-events-none select-none"
      />

      {/* ── Headline ───────────────────────────────────── */}
      <div className="relative z-10">
        <h1
          className="text-5xl leading-tight text-black"
          style={{ fontFamily: "'Brice Black', sans-serif" }}
        >
          Predict.
          <br />
          Win.
          <br />
          Earn.
        </h1>
        <p className="text-sm text-black/70 mt-3 max-w-xs">
          AI-powered prediction markets on Ethereum.<br />
          Resolved by Chainlink CRE — no manipulation.
        </p>
      </div>

      {/* ── Connect Wallet / Enter App ─────────────────── */}
      <div className="relative z-10">
        {inWorld ? (
          <button
            onClick={() => router.replace("/home")}
            className="retro-btn bg-black text-white px-6 py-3 text-base"
          >
            Enter App →
          </button>
        ) : (
          <div className="bg-black w-fit rounded-xl overflow-hidden">
            <ConnectButton
              client={client}
              chain={CHAIN}
              appMetadata={{
                name: "OracleX",
                description: "AI-powered prediction markets",
              }}
              connectButton={{ label: "Connect Wallet" }}
            />
          </div>
        )}
      </div>

      {/* Powered by label */}
      <p className="relative z-10 text-xs text-black/50">
        Powered by Chainlink CRE · Sepolia Testnet
      </p>
    </div>
  );
}
