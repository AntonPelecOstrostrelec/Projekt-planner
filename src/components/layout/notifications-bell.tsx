"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { sk } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NOTIFICATION_KIND_LABEL, type Notification } from "@/types/notifications";

export function NotificationsBell({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<Notification[]>();
      if (!cancelled && data) setItems(data);
    })();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as Notification, ...prev].slice(0, 20);
            }
            if (payload.eventType === "UPDATE") {
              const updated = payload.new as Notification;
              return prev.map((n) => (n.id === updated.id ? updated : n));
            }
            if (payload.eventType === "DELETE") {
              const removed = payload.old as Notification;
              return prev.filter((n) => n.id !== removed.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const unread = items.filter((n) => !n.read_at).length;

  function markAllRead() {
    startTransition(async () => {
      await supabase.rpc("mark_all_notifications_read", {
        p_workspace_id: null,
      });
      router.refresh();
    });
  }

  async function markOneRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifikácie"
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge
              className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px]"
              variant="destructive"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">Notifikácie</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3 w-3" />
              Všetko prečítané
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            Žiadne notifikácie. Zatiaľ pokoj.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            {items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                asChild
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-0.5 py-2",
                  !n.read_at && "bg-accent/50"
                )}
                onClick={() => !n.read_at && markOneRead(n.id)}
              >
                <Link
                  href={n.url ?? "#"}
                  className="block w-full"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {NOTIFICATION_KIND_LABEL[n.kind]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNowStrict(parseISO(n.created_at), {
                        locale: sk,
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && (
                    <div className="line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </div>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
