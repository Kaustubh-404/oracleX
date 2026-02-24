"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActiveWalletConnectionStatus } from "thirdweb/react";
import { isMiniApp } from "@/lib/worldid";

export function AuthGuard() {
  const status   = useActiveWalletConnectionStatus();
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    // In World App, users browse without a wallet — don't redirect
    if (isMiniApp()) return;
    if (status === "disconnected" && pathname !== "/") {
      router.replace("/");
    }
  }, [status, pathname, router]);

  return null;
}
