"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/matchday", label: "Matchday" },
  { href: "/results", label: "Results" },
  { href: "/games", label: "Games" },
  { href: "/stats", label: "Stats" },
  { href: "/roster", label: "Roster" },
];

export default function Nav({ session }: { session: any }) {
  const path = usePathname() || "";
  if (path === "/login") return null;
  const isSuper = session?.role === "superadmin";
  return (
    <nav className="nav">
      <div className="nav-in">
        <Link href="/matchday" className="brand"><i />JC Pickup</Link>
        {session && LINKS.map((l) => (
          <Link key={l.href} href={l.href}
            className={`link ${path.startsWith(l.href) ? "on" : ""}`}>{l.label}</Link>
        ))}
        {isSuper && (
          <Link href="/approvals" className={`link ${path.startsWith("/approvals") ? "on" : ""}`}>
            Approvals
          </Link>
        )}
        <span className="sp" />
        {session ? (
          <form action="/api/logout" method="post">
            <button className="btn ghost sm" type="submit">{session.username} · Sign out</button>
          </form>
        ) : (
          <Link href="/login" className="btn sm">Sign in</Link>
        )}
      </div>
    </nav>
  );
}
