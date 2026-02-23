"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveWalletConnectionStatus } from "thirdweb/react";
import { GalleryHorizontalEnd, LayoutList, Plus, ChartBarBig, UserRound } from "lucide-react";

const NAV = [
  { href: "/home",     label: "Home",    Icon: GalleryHorizontalEnd },
  { href: "/markets",  label: "Markets", Icon: LayoutList           },
  null,
  { href: "/holdings", label: "Holdings",Icon: ChartBarBig          },
  { href: "/account",  label: "Account", Icon: UserRound            },
] as const;

export function BottomNav() {
  const status   = useActiveWalletConnectionStatus();
  const pathname = usePathname();

  // Hide on landing page or when definitively disconnected
  // Keep visible during "connecting"/"unknown" to avoid flash on navigation
  if (pathname === "/" || status === "disconnected") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#efe7f7] border-t-4 border-black">
      <div className="relative flex items-center justify-between max-w-lg mx-auto px-2">
        {/* Left: Home + Markets */}
        <Link
          href="/home"
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-opacity ${
            pathname === "/home" ? "opacity-100" : "opacity-40"
          }`}
        >
          <GalleryHorizontalEnd size={22} />
          <span className="text-[10px] font-brice-regular">Home</span>
        </Link>

        <Link
          href="/markets"
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-opacity ${
            pathname === "/markets" ? "opacity-100" : "opacity-40"
          }`}
        >
          <LayoutList size={22} />
          <span className="text-[10px] font-brice-regular">Markets</span>
        </Link>

        {/* Center: floating + button */}
        <div className="flex-1 flex justify-center">
          <Link
            href="/create"
            className="absolute -top-5 bg-[#d3aeff] border-4 border-black rounded-full p-3 shadow-[3px_3px_0px_#000]"
          >
            <Plus size={20} strokeWidth={3} />
          </Link>
        </div>

        <Link
          href="/holdings"
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-opacity ${
            pathname === "/holdings" ? "opacity-100" : "opacity-40"
          }`}
        >
          <ChartBarBig size={22} />
          <span className="text-[10px] font-brice-regular">Holdings</span>
        </Link>

        <Link
          href="/account"
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-opacity ${
            pathname === "/account" ? "opacity-100" : "opacity-40"
          }`}
        >
          <UserRound size={22} />
          <span className="text-[10px] font-brice-regular">Account</span>
        </Link>
      </div>
    </nav>
  );
}
