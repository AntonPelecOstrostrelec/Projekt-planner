"use client";

import { useState, useTransition } from "react";
import { Copy, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { regenerateIcsToken } from "@/lib/actions/ics";

export function IcsFeedCard({
  workspaceId,
  feedUrl,
}: {
  workspaceId: string;
  feedUrl: string | null;
}) {
  const [url, setUrl] = useState(feedUrl);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copyUrl() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function regenerate() {
    startTransition(async () => {
      const res = await regenerateIcsToken(workspaceId);
      if (res.token) {
        const base = window.location.origin;
        setUrl(`${base}/api/ics/${res.token}`);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalendár feed (ICS)</CardTitle>
        <CardDescription>
          Pridaj túto URL do Google Calendar / Apple Calendar / Outlooku ako
          subscription a deadliny uvidíš priamo tam. Sync jedným smerom:
          appka → tvoj kalendár.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input readOnly value={url ?? "Vytváram token…"} />
          <Button onClick={copyUrl} variant="outline" size="icon" disabled={!url}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {copied ? "Skopírované ✓" : "Túto URL zdieľaj len sebe."}
          </span>
          <Button
            onClick={regenerate}
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-xs"
          >
            <RefreshCcw className="mr-1 h-3 w-3" />
            {pending ? "Generujem…" : "Vygenerovať nový token"}
          </Button>
        </div>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">
            Ako pridať do Google Calendar?
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Google Calendar → ľavé menu → Other calendars → + → From URL</li>
            <li>Vlož tú URL hore</li>
            <li>Add calendar</li>
          </ol>
        </details>
      </CardContent>
    </Card>
  );
}
