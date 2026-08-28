import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { migrate } from "@/lib/db";
import { allGames } from "@/lib/stats";
import GamesBrowser from "@/components/GamesBrowser";

export const dynamic = "force-dynamic";

export default async function Games() {
  const s = await getSession();
  if (!s) redirect("/login");
  await migrate();
  const games = await allGames();
  return (
    <>
      <h1 className="page">Games</h1>
      <p className="sub">Every game on record. Search by date, player or scoreline.</p>
      <GamesBrowser games={games.map((g) => ({
        ...g, home: JSON.parse(g.home), away: JSON.parse(g.away),
        captains: JSON.parse(g.captains || "{}"),
      }))} />
    </>
  );
}
