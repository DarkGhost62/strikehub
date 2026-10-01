"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  title: string;
  message: string;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const supabase = createClient();

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  async function loadAnnouncements() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("announcements")
      .select(
        "id, title, message, is_published, created_by, created_at, updated_at"
      )
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

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setMessage("");
    setIsPublished(true);
  }

  function startEdit(announcement: Announcement) {
    setError("");
    setSuccess("");

    setEditingId(announcement.id);
    setTitle(announcement.title);
    setMessage(announcement.message);
    setIsPublished(announcement.is_published);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle) {
      setError("Announcement title is required.");
      return;
    }

    if (!cleanMessage) {
      setError("Announcement message is required.");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { error: updateError } = await supabase.rpc(
        "admin_update_announcement",
        {
          p_id: editingId,
          p_title: cleanTitle,
          p_message: cleanMessage,
          p_is_published: isPublished,
        }
      );

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setSuccess("Announcement updated successfully.");
    } else {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        setSaving(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("announcements")
        .insert({
          title: cleanTitle,
          message: cleanMessage,
          is_published: isPublished,
          created_by: userData.user?.id || null,
        });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setSuccess("Announcement created successfully.");
    }

    resetForm();
    setSaving(false);

    await loadAnnouncements();
  }

  async function togglePublished(announcement: Announcement) {
    setActionId(announcement.id);
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase.rpc(
      "admin_update_announcement",
      {
        p_id: announcement.id,
        p_title: announcement.title,
        p_message: announcement.message,
        p_is_published: !announcement.is_published,
      }
    );

    if (updateError) {
      setError(updateError.message);
      setActionId(null);
      return;
    }

    setSuccess(
      announcement.is_published
        ? "Announcement unpublished successfully."
        : "Announcement published successfully."
    );

    setActionId(null);

    await loadAnnouncements();
  }

  async function handleDelete(announcement: Announcement) {
    const confirmed = window.confirm(
      `Delete this announcement?\n\n"${announcement.title}"\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setActionId(announcement.id);
    setError("");
    setSuccess("");

    const { error: deleteError } = await supabase
      .from("announcements")
      .delete()
      .eq("id", announcement.id);

    if (deleteError) {
      setError(deleteError.message);
      setActionId(null);
      return;
    }

    if (editingId === announcement.id) {
      resetForm();
    }

    setSuccess("Announcement deleted successfully.");
    setActionId(null);

    await loadAnnouncements();
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
              Admin
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Announcements
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Create and manage platform announcements for STRIKEHUB
              players.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/admin"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800"
            >
              ← Back to Admin
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

        {/* ERROR */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {success && (
          <div className="mb-6 rounded-xl border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* CREATE / EDIT FORM */}
        <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {editingId
                  ? "Edit Announcement"
                  : "Create Announcement"}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Published announcements are visible to players.
              </p>
            </div>

            {editingId && (
              <button
                onClick={resetForm}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-5">
            {/* TITLE */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Title
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Enter announcement title"
                maxLength={150}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
              />

              <p className="mt-1 text-right text-xs text-zinc-600">
                {title.length}/150
              </p>
            </div>

            {/* MESSAGE */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Message
              </label>

              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                placeholder="Write the announcement..."
                rows={6}
                className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
              />
            </div>

            {/* PUBLISH */}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) =>
                  setIsPublished(event.target.checked)
                }
                className="h-4 w-4 accent-red-600"
              />

              <span>
                <span className="block text-sm font-semibold text-white">
                  Publish immediately
                </span>

                <span className="block text-xs text-zinc-500">
                  Players will be able to see this announcement.
                </span>
              </span>
            </label>

            {/* BUTTONS */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Save Changes"
                  : "Create Announcement"}
              </button>

              {!editingId && (
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ANNOUNCEMENTS */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                All Announcements
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                {announcements.length} announcement
                {announcements.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
              Loading announcements...
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <p className="font-semibold text-white">
                No announcements yet.
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Create your first announcement above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => {
                const busy = actionId === announcement.id;

                return (
                  <article
                    key={announcement.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold text-white">
                            {announcement.title}
                          </h3>

                          {announcement.is_published ? (
                            <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400">
                              Published
                            </span>
                          ) : (
                            <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-400">
                              Draft
                            </span>
                          )}
                        </div>

                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                          {announcement.message}
                        </p>

                        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">
                          <span>
                            Created:{" "}
                            {formatDate(announcement.created_at)}
                          </span>

                          <span>
                            Updated:{" "}
                            {formatDate(announcement.updated_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:w-[280px] lg:justify-end">
                        <button
                          onClick={() =>
                            togglePublished(announcement)
                          }
                          disabled={busy}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? "Working..."
                            : announcement.is_published
                            ? "Unpublish"
                            : "Publish"}
                        </button>

                        <button
                          onClick={() =>
                            startEdit(announcement)
                          }
                          disabled={busy}
                          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(announcement)
                          }
                          disabled={busy}
                          className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}