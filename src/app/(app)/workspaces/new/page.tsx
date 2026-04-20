import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function createWorkspace(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const base = slugify(name) || "workspace";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase.rpc("create_workspace", {
    workspace_name: name,
    workspace_slug: slug,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Nepodarilo sa vytvoriť workspace");
  }

  const row = Array.isArray(data) ? data[0] : data;
  redirect(`/w/${row.slug}`);
}

export default function NewWorkspacePage() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Nový workspace</CardTitle>
          <CardDescription>
            Workspace je tvoja tímová bublina. Každý má vlastné projekty,
            členov a nastavenia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createWorkspace} className="space-y-4">
            <Input name="name" placeholder="Napr. Kreatívci s.r.o." required />
            <Button type="submit" className="w-full">
              Vytvoriť
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
