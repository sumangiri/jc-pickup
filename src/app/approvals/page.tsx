import { getSession, isSuper } from "@/lib/auth";
import { redirect } from "next/navigation";
import { migrate, migrateExtras, query } from "@/lib/db";
import ApprovalsView from "@/components/ApprovalsView";

export const dynamic = "force-dynamic";

export default async function Approvals() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isSuper(s)) redirect("/matchday");
  await migrate(); await migrateExtras();

  const proposals = await query<any>(`
    SELECT p.*, pl.name AS player_name, u.username AS proposer
    FROM proposals p JOIN players pl ON pl.id = p.player_id
    LEFT JOIN users u ON u.id = p.proposed_by
    ORDER BY p.created_at DESC`);
  const pendingGames = (await query<any>(
    "SELECT * FROM games WHERE approval_status = 'pending' ORDER BY date DESC"))
    .map((g) => ({ ...g, home: JSON.parse(g.home), away: JSON.parse(g.away) }));
  const pendingResults = (await query<any>(
    "SELECT * FROM games WHERE pending_result IS NOT NULL ORDER BY date DESC"))
    .map((g) => ({ ...g, pending: JSON.parse(g.pending_result) }));

  return (
    <>
      <h1 className="page">Approvals</h1>
      <p className="sub">Nothing becomes official until you say so.</p>
      <ApprovalsView proposals={proposals} games={pendingGames} results={pendingResults} />
    </>
  );
}
