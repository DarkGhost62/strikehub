"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  updated_at: string;
};

const supabase = createClient();

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAnnouncements() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("announcements")
      .select("id, title, message, created_at, updated_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setAnnouncements([]);
      setLoading(false);
      return;
    }

    setAnnouncements((data || []) as Announcement[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  function formatDate(value: string) {
    return new Date(value).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
              STRIKEHUB
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Announcements
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Stay updated with the latest STRIKEHUB news, events,
              tournaments and important notices.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/dashboard"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800"
            >
              ← Dashboard
            </a>

            <button
              onClick={loadAnnouncements}
              disabled={loading}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            Unable to load announcements: {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-sm text-zinc-400">
              Loading announcements...
            </p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <div className="text-5xl">📢</div>

            <h2 className="mt-4 text-xl font-bold">
              No announcements yet
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              There are currently no published announcements.
              Check back later for updates.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {announcements.map((announcement, index) => (
              <article
                key={announcement.id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
              >
                {/* Top accent */}
                <div className="h-1 bg-red-600" />

                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        {index === 0 && (
                          <span className="rounded-full bg-red-950 px-3 py-1 text-xs font-bold text-red-400">
                            Latest
                          </span>
                        )}

                        <span className="text-xs text-zinc-600">
                          {formatDate(announcement.created_at)}
                        </span>
                      </div>

                      <h2 className="text-xl font-bold text-white sm:text-2xl">
                        {announcement.title}
                      </h2>
                    </div>

                    <div className="hidden text-3xl sm:block">
                      📢
                    </div>
                  </div>

                  <div className="mt-5 border-t border-zinc-800 pt-5">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                      {announcement.message}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-zinc-600">
            STRIKEHUB announcements are managed by the platform
            administration.
          </p>
        </div>
      </div>
    </main>
  );
}