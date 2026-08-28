import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PhotosView from "@/components/PhotosView";

export const dynamic = "force-dynamic";

export default async function Photos() {
  const s = await getSession();
  if (!s) redirect("/login");
  return (
    <>
      <h1 className="page">Photos</h1>
      <p className="sub">The season in pictures — add yours after every game.</p>
      <PhotosView />
    </>
  );
}
