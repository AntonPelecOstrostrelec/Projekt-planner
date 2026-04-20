"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { sk } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { disconnectGoogleCalendar, toggleSync } from "@/lib/actions/calendar";

type Integration = {
  id: string;
  account_email: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
};

export function GoogleCalendarCard({
  enabled,
  integration,
}: {
  enabled: boolean;
  integration: Integration | null;
}) {
  const [pending, startTransition] = useTransition();
  const [syncState, setSyncState] = useState(integration?.sync_enabled ?? true);

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Calendar sync</CardTitle>
          <CardDescription>
            Zatiaľ nie je nakonfigurovaný server-side (GOOGLE_OAUTH_*). Zatiaľ
            používaj ICS feed.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!integration) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Calendar sync</CardTitle>
          <CardDescription>
            Pripoj svoj Google účet a tasky sa budú pushovať do tvojho
            kalendára ako eventy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/api/calendar/google/connect">
            <Button>Pripojiť Google Calendar</Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  function onToggle() {
    const next = !syncState;
    setSyncState(next);
    startTransition(async () => {
      await toggleSync(next);
    });
  }

  function onDisconnect() {
    if (!confirm("Odpojiť Google Calendar?")) return;
    startTransition(async () => {
      await disconnectGoogleCalendar();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendar</CardTitle>
        <CardDescription>
          Pripojený ako <b>{integration.account_email ?? "neznámy účet"}</b>.
          {integration.last_synced_at
            ? ` Posledný sync ${formatDistanceToNow(parseISO(integration.last_synced_at), { locale: sk, addSuffix: true })}.`
            : " Sync ešte nebežal."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Auto-sync</div>
            <div className="text-xs text-muted-foreground">
              Cron každých 6 hodín pushne tasky do kalendára.
            </div>
          </div>
          <input
            type="checkbox"
            checked={syncState}
            onChange={onToggle}
            className="h-4 w-4"
          />
        </label>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDisconnect}
          disabled={pending}
        >
          Odpojiť
        </Button>
      </CardContent>
    </Card>
  );
}
