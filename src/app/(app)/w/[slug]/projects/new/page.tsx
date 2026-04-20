import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Nový projekt</CardTitle>
          <CardDescription>
            Pomenuj ho a pridaj deadline. Detaily (tasky, členov) vyplníš
            neskôr na board view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewProjectForm slug={slug}>
            <div className="space-y-2">
              <Label htmlFor="name">Názov</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                placeholder="Napr. Redesign webu"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                maxLength={4000}
                placeholder="O čom to je, o čo nám ide"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="color">Farba</Label>
                <Input
                  id="color"
                  name="color"
                  type="color"
                  defaultValue="#22c55e"
                  className="h-9 w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input id="deadline" name="deadline" type="datetime-local" />
              </div>
            </div>
          </NewProjectForm>
        </CardContent>
      </Card>
    </div>
  );
}
