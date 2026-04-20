"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/actions/projects";

export function NewProjectForm({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        setError(null);
        const raw = formData.get("deadline");
        if (typeof raw === "string" && raw) {
          formData.set("deadline", new Date(raw).toISOString());
        } else {
          formData.delete("deadline");
        }
        startTransition(async () => {
          const res = await createProject(slug, formData);
          if (res?.error) setError(res.error);
        });
      }}
    >
      {children}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Vytváram…" : "Vytvoriť projekt"}
      </Button>
    </form>
  );
}
