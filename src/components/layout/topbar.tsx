"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Topbar({ userEmail }: { userEmail?: string }) {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="text-sm text-muted-foreground">
        {userEmail ? `Prihlásený ako ${userEmail}` : ""}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Prepnúť tému"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <form action="/auth/signout" method="post">
          <Button type="submit" variant="outline" size="sm">
            Odhlásiť
          </Button>
        </form>
      </div>
    </header>
  );
}
