import { getSession, isSuper } from "@/lib/auth";
import { redirect } from "next/navigation";
import { migrate, query } from "@/lib/db";
import ApprovalsView from "@/components/ApprovalsView";

export const dynamic = "force-dynamic";

export default async function Approvals() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!isSuper(s)) redirect("/matchday");
  await migrate();
  const rows = await query<any>(`
    SELECT p.*, pl.name AS player_name, u.username AS proposer
    FROM proposals p
    JOIN players pl ON pl.id = p.player_id
    LEFT JOIN users u ON u.id = p.proposed_by
    ORDER BY p.created_at DESC`);
  return (
    <>
      <h1 className="page">Approvals</h1>
      <p className="sub">Rating changes proposed by admins.</p>
      <ApprovalsView rows={rows} />
    </>
  );
}
