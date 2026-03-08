"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActiveWalletConnectionStatus } from "thirdweb/react";
import { isMiniApp } from "@/lib/worldid";

export function AuthGuard() {
  const status   = useActiveWalletConnectionStatus();
  const pathname = usePathname();
  const router   = useRouter();
  const hasConnected = useRef(false);

  // Track if the wallet has ever been connected in this session
  if (status === "connected") hasConnected.current = true;

  useEffect(() => {
    // In World App, users browse without a wallet — don't redirect
    if (isMiniApp()) return;
    // Don't redirect while auto-connect is still in progress
    if (status === "connecting") return;
    // Only redirect if we previously had a connection that was lost,
    // not on initial page load when auto-connect hasn't fired yet
    if (status === "disconnected" && pathname !== "/" && hasConnected.current) {
      router.replace("/");
    }
  }, [status, pathname, router]);

  return null;
}
