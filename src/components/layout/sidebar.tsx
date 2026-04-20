"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, FolderKanban, Home, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  // If inside a workspace, show workspace-scoped shortcuts
  const match = pathname.match(/^\/w\/([^/]+)/);
  const wsSlug = match?.[1];

  const nav = wsSlug
    ? [
        { href: `/w/${wsSlug}`, label: "Prehľad", icon: Home, exact: true },
        {
          href: `/w/${wsSlug}/projects`,
          label: "Projekty",
          icon: FolderKanban,
        },
        { href: `/w/${wsSlug}/calendar`, label: "Kalendár", icon: Calendar },
        {
          href: `/w/${wsSlug}/settings/notifications`,
          label: "Notifikácie",
          icon: Settings,
        },
      ]
    : [{ href: "/", label: "Prehľad", icon: Home, exact: true }];

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-muted/20 md:flex md:flex-col">
      <div className="flex h-14 items-center border-b px-5">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Pushnik
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
