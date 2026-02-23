"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useActiveWalletConnectionStatus } from "thirdweb/react";

export function AuthGuard() {
  const status   = useActiveWalletConnectionStatus();
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    if (status === "disconnected" && pathname !== "/") {
      router.replace("/");
    }
  }, [status, pathname, router]);

  return null;
}
