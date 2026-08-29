import "./globals.css";
import { getSession, isSuper } from "@/lib/auth";
import { migrate, migrateExtras, query } from "@/lib/db";
import Nav from "@/components/Nav";

export const metadata = { title: "JC Pickup", description: "Jersey City Heights pickup soccer" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  let pendingCount = 0;
  if (isSuper(session)) {
    try {
      await migrate(); await migrateExtras();
      const a = await query<any>("SELECT COUNT(*) AS c FROM games WHERE approval_status = 'pending'");
      const b = await query<any>("SELECT COUNT(*) AS c FROM games WHERE pending_result IS NOT NULL");
      const c = await query<any>("SELECT COUNT(*) AS c FROM proposals WHERE status = 'pending'");
      pendingCount = Number(a[0]?.c || 0) + Number(b[0]?.c || 0) + Number(c[0]?.c || 0);
    } catch {}
  }
  return (
    <html lang="en">
      <body>
        <Nav session={session} pendingCount={pendingCount} />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
