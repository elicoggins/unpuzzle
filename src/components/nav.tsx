"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/play", label: "play" },
  { href: "/profile", label: "profile" },
  { href: "/leaderboard", label: "leaderboard" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border px-6 py-4 flex items-center justify-between">
      <Link
        href="/"
        className="text-xl font-bold tracking-tight text-text-primary hover:text-accent transition-colors"
      >
        unpuzzle
      </Link>
      <div className="flex items-center gap-2">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:border-border-hover"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
