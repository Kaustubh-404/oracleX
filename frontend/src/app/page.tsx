"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { ConnectButton } from "thirdweb/react";
import { client, CHAIN } from "@/lib/thirdweb";
import { isMiniApp } from "@/lib/worldid";
import { MiniKit } from "@worldcoin/minikit-js";
import { generateNonce, setMiniKitAddress } from "@/lib/minikit-wallet";

export default function LandingPage() {
  const account  = useActiveAccount();
  const router   = useRouter();
  const [inWorld,  setInWorld]  = useState(false);
  const [authState, setAuthState] = useState<"idle" | "pending" | "error">("idle");

  useEffect(() => {
    setInWorld(isMiniApp());
  }, []);

  // Browser: redirect on wallet connect
  useEffect(() => {
    if (!inWorld && account) router.replace("/home");
  }, [account, inWorld, router]);

  async function handleWorldAuth() {
    setAuthState("pending");
    try {
      const { finalPayload } = await MiniKit.commandsAsync.walletAuth({
        nonce:          generateNonce(),
        statement:      "Sign in to OracleX",
        expirationTime: new Date(Date.now() + 10 * 60 * 1000),
      });
      if (finalPayload.status === "success") {
        setMiniKitAddress(finalPayload.address);
        router.replace("/home");
      } else {
        setAuthState("error");
      }
    } catch {
      setAuthState("error");
    }
  }

  return (
    <div
      className="relative flex flex-col justify-end gap-8 px-8 pb-14 pt-10 min-h-screen w-screen overflow-hidden"
      style={{ background: "#d3aeff", fontFamily: "'Brice Regular', sans-serif" }}
    >
      {/* ── Decorative assets ──────────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/starsquare.png" alt=""
        className="absolute w-[18vw] h-[18vh] top-6 left-28 object-contain pointer-events-none select-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/star2.png" alt=""
        className="absolute w-[14vw] h-[18vh] top-28 left-8 object-contain rotate-[40deg] pointer-events-none select-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/flower.png" alt=""
        className="absolute w-[38vw] h-[42vh] top-20 left-28 object-contain pointer-events-none select-none" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/star3.png" alt=""
        className="absolute w-[40vw] h-[38vh] top-4 right-6 object-contain pointer-events-none select-none" />

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

      {/* ── Sign in ────────────────────────────────────── */}
      <div className="relative z-10">
        {inWorld ? (
          <div>
            <button
              onClick={handleWorldAuth}
              disabled={authState === "pending"}
              className="retro-btn bg-black text-white px-6 py-3 text-base w-full"
              style={{ fontFamily: "'Brice SemiBold', sans-serif" }}
            >
              {authState === "pending" ? "Signing in…" : "Sign in with World App"}
            </button>
            {authState === "error" && (
              <p className="text-xs text-red-700 mt-2 text-center">Sign-in failed. Please try again.</p>
            )}
          </div>
        ) : (
          <div className="bg-black w-fit rounded-xl overflow-hidden">
            <ConnectButton
              client={client}
              chain={CHAIN}
              appMetadata={{ name: "OracleX", description: "AI-powered prediction markets" }}
              connectButton={{ label: "Connect Wallet" }}
            />
          </div>
        )}
      </div>

      {/* Powered by label */}
      <p className="relative z-10 text-xs text-black/50">
        Powered by Chainlink CRE · Sepolia Testnet
      </p>
      <p className="relative z-10 text-[10px] text-black/30 -mt-6">v1.1.0</p>
    </div>
  );
}
