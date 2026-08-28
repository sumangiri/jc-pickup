import "./globals.css";
import { getSession } from "@/lib/auth";
import Nav from "@/components/Nav";

export const metadata = { title: "JC Pickup", description: "Jersey City Heights pickup soccer" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <Nav session={session} />
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
