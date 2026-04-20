import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getWorkspaceBySlug } from "@/lib/workspace";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace, role } = await getWorkspaceBySlug(slug);

  const nav = [
    { href: `/w/${workspace.slug}`, label: "Prehľad" },
    { href: `/w/${workspace.slug}/projects`, label: "Projekty" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{workspace.name}</h1>
          <p className="text-sm text-muted-foreground">/{workspace.slug}</p>
        </div>
        <Badge variant="secondary">Rola: {role}</Badge>
      </div>

      <nav className="flex gap-1 border-b">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
