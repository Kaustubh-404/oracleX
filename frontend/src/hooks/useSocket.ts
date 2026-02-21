"use client";
import { useEffect, useRef, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface MarketUpdate {
  marketId:      string;
  yesPct?:       number;
  noPct?:        number;
  totalVolume?:  string;
  lastTradeAt?:  string;
}

/**
 * Connects to the backend Socket.io server and subscribes to live updates
 * for a specific market. Returns the most recent update received.
 *
 * Uses dynamic import so socket.io-client is only loaded client-side.
 */
export function useMarketSocket(marketId: string): MarketUpdate | null {
  const [update, setUpdate] = useState<MarketUpdate | null>(null);
  const socketRef = useRef<unknown>(null);

  useEffect(() => {
    if (!marketId) return;

    let active = true;

    import("socket.io-client").then(({ io }) => {
      if (!active) return;

      const socket = io(BACKEND_URL, { transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("subscribeMarket", marketId);
      });

      // Backend emits these events when trades happen
      const handlePositionTaken = (data: { marketId: string; isYes: boolean; amount: number }) => {
        if (data.marketId !== marketId) return;
        // Signal that data changed so the page can refetch on-chain state
        setUpdate({ marketId: data.marketId });
      };

      const handlePositionSold = (data: { marketId: string }) => {
        if (data.marketId !== marketId) return;
        setUpdate({ marketId: data.marketId });
      };

      const handleMarketSettled = (data: { marketId: string; outcome: number; confidenceBps: string; aiReasoning: string }) => {
        if (data.marketId !== marketId) return;
        setUpdate({ marketId: data.marketId });
      };

      socket.on("positionTaken",  handlePositionTaken);
      socket.on("positionSold",   handlePositionSold);
      socket.on("marketSettled",  handleMarketSettled);
    });

    return () => {
      active = false;
      const s = socketRef.current as { disconnect?: () => void } | null;
      if (s?.disconnect) s.disconnect();
    };
  }, [marketId]);

  return update;
}
