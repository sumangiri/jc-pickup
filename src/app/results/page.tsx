import { getSession, isSuper } from "@/lib/auth";
import { redirect } from "next/navigation";
import { migrate, query } from "@/lib/db";
import ResultForm from "@/components/ResultForm";

export const dynamic = "force-dynamic";

export default async function Results() {
  const s = await getSession();
  if (!s) redirect("/login");
  await migrate();
  const pending = await query<any>("SELECT * FROM games WHERE result IS NULL ORDER BY date DESC");
  const recent = await query<any>(
    "SELECT * FROM games WHERE result IS NOT NULL ORDER BY date DESC LIMIT 5");

  return (
    <>
      <h1 className="page">Results</h1>
      <p className="sub">Enter the score and who was man of the match.</p>

      {pending.length === 0 ? (
        <div className="chalk empty">
          <h3>No games waiting</h3>
          <p>Save a game from Matchday and it will show up here.</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
          {pending.map((g) => <ResultForm key={g.id} game={g} isSuper={isSuper(s)} />)}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginTop: 34 }}>Recently recorded</div>
          <div className="chalk" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead><tr><th>Date</th><th>Score</th><th>Won</th><th>MOTM</th></tr></thead>
              <tbody>
                {recent.map((g) => (
                  <tr key={g.id}>
                    <td className="mono">{g.date}</td>
                    <td className="mono">{g.score_home}–{g.score_away}</td>
                    <td><span className={`pill ${g.result}`}>{g.result}</span></td>
                    <td>{g.motm || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
