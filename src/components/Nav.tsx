"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/matchday", label: "Matchday" },
  { href: "/results", label: "Results" },
  { href: "/games", label: "Games" },
  { href: "/stats", label: "Stats" },
  { href: "/assessment", label: "Assessment" },
  { href: "/photos", label: "Photos" },
  { href: "/roster", label: "Roster" },
];

export default function Nav({ session, pendingCount = 0 }: { session: any; pendingCount?: number }) {
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
            {pendingCount > 0 && (
              <span style={{ marginLeft: 6, background: "var(--amber)", color: "#201604",
                borderRadius: 100, padding: "1px 6px", fontSize: 10.5, fontWeight: 800 }}>
                {pendingCount}
              </span>
            )}
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
