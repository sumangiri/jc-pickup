import { getSession, isSuper } from "@/lib/auth";
import { redirect } from "next/navigation";
import { migrate, migrateExtras, query } from "@/lib/db";
import AssessmentView from "@/components/AssessmentView";

export const dynamic = "force-dynamic";

export default async function Assessment() {
  const s = await getSession();
  if (!s) redirect("/login");
  await migrate(); await migrateExtras();
  const rows = await query<any>(
    "SELECT id, week_label, content, games_covered, created_at FROM assessments ORDER BY created_at DESC LIMIT 20");
  return (
    <>
      <h1 className="page">Overall assessment</h1>
      <p className="sub">The season so far — updated weekly, covering every game since day 0.</p>
      <AssessmentView rows={rows} canAsk={isSuper(s)} />
    </>
  );
}
