"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PortfolioRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/holdings"); }, [router]);
  return null;
}
