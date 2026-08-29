import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { migrate } from "@/lib/db";
import { allGames } from "@/lib/stats";
import GamesBrowser from "@/components/GamesBrowser";
import { isAdmin, isSuper } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Games() {
  const s = await getSession();
  if (!s) redirect("/login");
  await migrate();
  const games = await allGames();
  const admin = isAdmin(s);
  const superAdmin = isSuper(s);
  return (
    <>
      <h1 className="page">Games</h1>
      <p className="sub">Every game on record. Search by date, player or scoreline.</p>
      <GamesBrowser admin={admin} isSuper={superAdmin} games={games.map((g) => ({
        ...g, home: JSON.parse(g.home), away: JSON.parse(g.away),
        captains: JSON.parse(g.captains || "{}"),
      }))} />
    </>
  );
}
