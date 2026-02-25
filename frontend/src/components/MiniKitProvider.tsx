"use client";
import { useEffect, useState } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

export function MiniKitProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    MiniKit.install(process.env.NEXT_PUBLIC_WLD_APP_ID);
    setReady(true);
  }, []);

  // Don't render children until MiniKit is installed, so isMiniApp() works reliably
  if (!ready) return null;

  return <>{children}</>;
}
