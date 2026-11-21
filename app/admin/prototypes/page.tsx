import type { Metadata } from "next";
import AdminApp from "@/components/admin/AdminApp";

// Intern vy : aldrig indexerad (meta här, X-Robots-Tag i Workern och inte med i sitemap.xml).
export const metadata: Metadata = {
  title: "Prototypanalys (intern)",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
};

export default function AdminPrototypesPage() {
  return <AdminApp />;
}
