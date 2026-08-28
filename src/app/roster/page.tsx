import { getSession, isAdmin, isSuper } from "@/lib/auth";
import { redirect } from "next/navigation";
import { migrate, query } from "@/lib/db";
import RosterView from "@/components/RosterView";

export const dynamic = "force-dynamic";

export default async function Roster() {
  const s = await getSession();
  if (!s) redirect("/login");
  await migrate();
  const players = await query<any>("SELECT * FROM players WHERE active ORDER BY skill DESC");
  const users = isSuper(s) ? await query<any>("SELECT id,username,role FROM users ORDER BY username") : [];
  return (
    <>
      <h1 className="page">Roster</h1>
      <p className="sub">
        {players.length} players. Skill = 40% ball control + 35% influence + 25% discipline.
      </p>
      <RosterView players={players} users={users} canEdit={isAdmin(s)} isSuper={isSuper(s)} />
    </>
  );
}
