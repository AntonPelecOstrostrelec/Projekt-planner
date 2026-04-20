"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { upsertNotificationPrefs } from "@/lib/actions/notifications";

type Prefs = {
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  deadline_alerts: boolean;
  task_assigned: boolean;
  task_comments: boolean;
  daily_digest: boolean;
};

const CHANNELS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "in_app_enabled", label: "In-app (bell v appke)", desc: "Funguje vždy." },
  { key: "email_enabled", label: "Email", desc: "Vyžaduje nastavené SMTP." },
  { key: "push_enabled", label: "Web push", desc: "Notifikácie cez prehliadač." },
];

const TOPICS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "deadline_alerts", label: "Deadliny", desc: "72h / 24h pred, overdue." },
  { key: "task_assigned", label: "Priradenie tasku", desc: "Niekto ti zavalil robotu." },
  { key: "task_comments", label: "Komentáre", desc: "Reakcie na tvoje tasky." },
  { key: "daily_digest", label: "Denný súhrn", desc: "Ranný report čo ťa čaká." },
];

export function NotificationPrefsForm({
  slug,
  prefs,
}: {
  slug: string;
  prefs: Prefs;
}) {
  const [state, setState] = useState<Prefs>(prefs);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: keyof Prefs) {
    setState((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await upsertNotificationPrefs(slug, state);
      if (res?.error) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <Section title="Kanály" items={CHANNELS} state={state} onToggle={toggle} />
      <Section title="Čo dostávať" items={TOPICS} state={state} onToggle={toggle} />

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Ukladám…" : "Uložiť"}
        </Button>
        {saved && <span className="text-xs text-muted-foreground">Uložené ✓</span>}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  state,
  onToggle,
}: {
  title: string;
  items: { key: keyof Prefs; label: string; desc: string }[];
  state: Prefs;
  onToggle: (key: keyof Prefs) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex cursor-pointer items-center justify-between rounded-md border p-3"
          >
            <div>
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </div>
            <Switch
              checked={state[item.key]}
              onCheckedChange={() => onToggle(item.key)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
