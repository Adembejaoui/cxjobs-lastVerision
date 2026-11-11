"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

// Refresh while the tab is visible; no polling in background tabs.
const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** In-app notifications (launch plan A7). */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    try {
      const res = await fetch("/api/notifications", { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      setItems(json.data ?? []);
      setUnread(json.unreadCount ?? 0);
      setLoadFailed(false);
    } catch {
      if (!controller.signal.aborted) setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // Deferred so the first fetch is not a synchronous setState in the effect.
    const first = setTimeout(load, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      inFlight.current?.abort();
    };
  }, [load]);

  const markAllRead = async () => {
    if (unread === 0) return;
    const previous = { items, unread };
    setUnread(0);
    setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setItems(previous.items);
      setUnread(previous.unread);
    }
  };

  const markOneRead = (id: string) => {
    const target = items.find((n) => n.id === id);
    if (!target || target.readAt) return;
    setItems((list) => list.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => undefined);
  };

  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger
        aria-label={label}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#162f67]"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-[18px] text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-medium text-[#162f67] underline-offset-2 hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {loadFailed && items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-600">Notifications could not be loaded.</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-600">You have no notifications yet.</p>
        ) : (
          items.map((n) => {
            const content = (
              <div className="flex w-full flex-col gap-0.5">
                <span className={`text-sm ${n.readAt ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                  {!n.readAt && <span className="sr-only">Unread: </span>}
                  {n.title}
                </span>
                {n.body && <span className="text-xs text-slate-600">{n.body}</span>}
                <span className="text-xs text-slate-500">{timeAgo(n.createdAt)}</span>
              </div>
            );
            return n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? (
              <DropdownMenuItem key={n.id} asChild onSelect={() => markOneRead(n.id)}>
                <Link href={n.link}>{content}</Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={n.id} onSelect={() => markOneRead(n.id)}>
                {content}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
