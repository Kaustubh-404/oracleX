"use client";
import { useState } from "react";
import { PayEmbed } from "thirdweb/react";
import { client, CHAIN, USDC_ADDRESS } from "@/lib/thirdweb";

/**
 * Button that opens a thirdweb PayEmbed modal for buying USDC via
 * Coinbase Pay, credit card, or cross-chain swap.
 */
export function BuyUSDCButton({
  className,
  label = "Buy USDC",
}: {
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        }
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="relative">
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 z-10 w-7 h-7 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-white flex items-center justify-center text-sm"
            >
              ✕
            </button>

            <PayEmbed
              client={client}
              payOptions={{
                prefillBuy: {
                  chain:  CHAIN,
                  token: {
                    address:  USDC_ADDRESS,
                    symbol:   "USDC",
                    name:     "USD Coin",
                    icon:     "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
                  },
                  amount: "50",
                  allowEdits: { amount: true, token: false, chain: false },
                },
              }}
              theme="dark"
            />
          </div>
        </div>
      )}
    </>
  );
}
