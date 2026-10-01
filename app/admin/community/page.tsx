"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type MessageType = "text" | "image" | "gif"

type CommunityMessage = {
  id: string
  user_id: string
  message: string | null
  message_type: MessageType
  media_url: string | null
  reply_to_id: string | null
  created_at: string
  is_deleted: boolean
  profiles:
    | {
        display_name: string | null
        in_game_name: string | null
        profile_image_url: string | null
      }
    | null
}

type FilterType = "all" | "text" | "image" | "gif"

function formatTime(date: string) {
  return new Date(date).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function getDisplayName(item: CommunityMessage) {
  return (
    item.profiles?.in_game_name ||
    item.profiles?.display_name ||
    "STRIKEHUB Player"
  )
}

function getMessagePreview(item: CommunityMessage) {
  if (item.message_type === "image") {
    return item.message?.trim() || "📷 Image"
  }

  if (item.message_type === "gif") {
    return item.message?.trim() || "🎞️ GIF"
  }

  return item.message?.trim() || "Message"
}

export default function AdminCommunityPage() {
  const supabase = createClient()

  const [messages, setMessages] = useState<CommunityMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<CommunityMessage | null>(null)
  const [deleteReason, setDeleteReason] = useState("")

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [showDeleted, setShowDeleted] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [selectedMessage, setSelectedMessage] =
    useState<CommunityMessage | null>(null)

  async function checkAdmin() {
    const { data: adminCheck, error: adminError } =
      await supabase.rpc("is_admin")

    if (adminError || !adminCheck) {
      window.location.href = "/dashboard"
      return false
    }

    return true
  }

  async function loadMessages(isRefresh = false) {
    setError("")

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    const allowed = await checkAdmin()

    if (!allowed) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data, error: loadError } = await supabase
      .from("community_messages")
      .select(
        `
        id,
        user_id,
        message,
        message_type,
        media_url,
        reply_to_id,
        created_at,
        is_deleted,
        profiles!community_messages_user_id_fkey (
          display_name,
          in_game_name,
          profile_image_url
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(300)

    if (loadError) {
      console.error("ADMIN COMMUNITY LOAD ERROR:", loadError)

      setError(
        `Could not load community messages: ${
          loadError.message || "Unknown database error"
        }`
      )

      setMessages([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const normalized: CommunityMessage[] = (data || []).map(
      (item: any) => ({
        id: item.id,
        user_id: item.user_id,
        message: item.message ?? null,
        message_type: item.message_type,
        media_url: item.media_url ?? null,
        reply_to_id: item.reply_to_id ?? null,
        created_at: item.created_at,
        is_deleted: Boolean(item.is_deleted),
        profiles: Array.isArray(item.profiles)
          ? item.profiles[0] ?? null
          : item.profiles ?? null,
      })
    )

    setMessages(normalized)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    loadMessages()
  }, [])

  function openDeleteDialog(item: CommunityMessage) {
    if (item.is_deleted || deletingId) return

    setError("")
    setSuccess("")
    setDeleteReason("")
    setDeleteTarget(item)
  }

  function closeDeleteDialog() {
    if (deletingId) return
    setDeleteTarget(null)
    setDeleteReason("")
  }

  async function confirmDeleteMessage() {
    const item = deleteTarget

    if (!item || item.is_deleted || deletingId) return

    const reason = deleteReason.trim()

    if (!reason) {
      setError("A reason is required when deleting a community message.")
      return
    }

    if (reason.length > 500) {
      setError("The deletion reason cannot exceed 500 characters.")
      return
    }

    setError("")
    setSuccess("")
    setDeletingId(item.id)

    const {
      data: deleteResult,
      error: deleteError,
    } = await supabase.rpc("admin_delete_community_message", {
      p_message_id: item.id,
      p_reason: reason,
    })

    if (deleteError) {
      console.error("ADMIN COMMUNITY DELETE ERROR:", deleteError)

      setError(
        `Message could not be deleted: ${
          deleteError.message || "Unknown database error"
        }`
      )

      setDeletingId(null)
      return
    }

    if (deleteResult === false) {
      setError("Message was already deleted or could not be found.")
      setDeletingId(null)
      return
    }

    setMessages((current) =>
      current.map((messageItem) =>
        messageItem.id === item.id
          ? { ...messageItem, is_deleted: true }
          : messageItem
      )
    )

    if (selectedMessage?.id === item.id) {
      setSelectedMessage({
        ...selectedMessage,
        is_deleted: true,
      })
    }

    setDeleteTarget(null)
    setDeleteReason("")
    setSuccess("Message deleted successfully.")

    window.setTimeout(() => setSuccess(""), 2500)
    setDeletingId(null)
  }

  const visibleMessages = useMemo(() => {
    const term = search.trim().toLowerCase()

    return messages.filter((item) => {
      if (!showDeleted && item.is_deleted) {
        return false
      }

      if (
        filter !== "all" &&
        item.message_type !== filter
      ) {
        return false
      }

      if (!term) {
        return true
      }

      const name = getDisplayName(item).toLowerCase()
      const message = (item.message || "").toLowerCase()
      const userId = item.user_id.toLowerCase()

      return (
        name.includes(term) ||
        message.includes(term) ||
        userId.includes(term)
      )
    })
  }, [messages, search, filter, showDeleted])

  const stats = useMemo(() => {
    const active = messages.filter(
      (item) => !item.is_deleted
    )

    return {
      total: active.length,
      text: active.filter(
        (item) => item.message_type === "text"
      ).length,
      image: active.filter(
        (item) => item.message_type === "image"
      ).length,
      gif: active.filter(
        (item) => item.message_type === "gif"
      ).length,
      deleted: messages.filter(
        (item) => item.is_deleted
      ).length,
    }
  }, [messages])

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-red-500">
              STRIKEHUB ADMIN
            </p>

            <h1 className="mt-1 text-3xl font-black uppercase sm:text-4xl">
              Community Moderation
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              Manage and moderate messages posted in the community chat.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-bold transition hover:border-red-500 hover:bg-gray-800"
            >
              ← Admin Dashboard
            </Link>

            <button
              type="button"
              onClick={() => loadMessages(true)}
              disabled={refreshing}
              className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </button>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-900 bg-green-950/30 px-4 py-3 text-sm text-green-400">
            {success}
          </div>
        )}

        {/* STATS */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-gray-800 bg-[#0d0d0d] p-4">
            <p className="text-xs font-bold uppercase text-gray-500">
              Active
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.total}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#0d0d0d] p-4">
            <p className="text-xs font-bold uppercase text-gray-500">
              Text
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.text}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#0d0d0d] p-4">
            <p className="text-xs font-bold uppercase text-gray-500">
              Images
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.image}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#0d0d0d] p-4">
            <p className="text-xs font-bold uppercase text-gray-500">
              GIFs
            </p>

            <p className="mt-2 text-2xl font-black">
              {stats.gif}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-[#0d0d0d] p-4">
            <p className="text-xs font-bold uppercase text-gray-500">
              Deleted
            </p>

            <p className="mt-2 text-2xl font-black text-red-400">
              {stats.deleted}
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="mb-6 rounded-2xl border border-gray-800 bg-[#0d0d0d] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Search
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search player name, message or user ID..."
                className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-red-500"
              />
            </div>

            <div className="w-full lg:w-48">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Message Type
              </label>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target.value as FilterType
                  )
                }
                className="w-full rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-500"
              >
                <option value="all">
                  All Messages
                </option>

                <option value="text">
                  Text
                </option>

                <option value="image">
                  Images
                </option>

                <option value="gif">
                  GIFs
                </option>
              </select>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm lg:mt-6">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(event) =>
                  setShowDeleted(
                    event.target.checked
                  )
                }
                className="h-4 w-4 accent-red-600"
              />

              <span className="font-semibold">
                Show deleted
              </span>
            </label>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            Showing {visibleMessages.length} of{" "}
            {messages.length} loaded messages.
          </div>
        </div>

        {/* CONTENT */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* MESSAGE LIST */}
          <section className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0d0d0d]">
            <div className="border-b border-gray-800 px-5 py-4">
              <h2 className="font-bold">
                Community Messages
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Select a message to inspect it or remove it from public chat.
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center text-sm text-gray-500">
                Loading community messages...
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center px-6 text-center text-sm text-gray-500">
                No messages match your current filters.
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {visibleMessages.map((item) => {
                  const name = getDisplayName(item)

                  const isSelected =
                    selectedMessage?.id === item.id

                  return (
                    <div
                      key={item.id}
                      className={`p-4 transition ${
                        isSelected
                          ? "bg-red-950/20"
                          : "hover:bg-white/[0.02]"
                      } ${
                        item.is_deleted
                          ? "opacity-60"
                          : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* AVATAR */}
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-700 bg-gray-900">
                          {item.profiles
                            ?.profile_image_url ? (
                            <img
                              src={
                                item.profiles
                                  .profile_image_url
                              }
                              alt={name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-black text-red-400">
                              {name
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* MESSAGE */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold">
                              {name}
                            </span>

                            <span className="text-[10px] text-gray-600">
                              {formatTime(
                                item.created_at
                              )}
                            </span>

                            <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[9px] font-bold uppercase text-gray-500">
                              {item.message_type}
                            </span>

                            {item.is_deleted && (
                              <span className="rounded-full border border-red-900 bg-red-950/30 px-2 py-0.5 text-[9px] font-bold uppercase text-red-400">
                                Deleted
                              </span>
                            )}
                          </div>

                          {item.message_type ===
                            "image" &&
                          item.media_url ? (
                            <div className="mt-3">
                              <img
                                src={item.media_url}
                                alt="Community upload"
                                className="max-h-72 max-w-full rounded-xl border border-gray-800 object-contain"
                              />

                              {item.message &&
                                item.message !==
                                  "📷 Image" && (
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-300">
                                    {item.message}
                                  </p>
                                )}
                            </div>
                          ) : item.message_type ===
                              "gif" &&
                            item.media_url ? (
                            <div className="mt-3">
                              <img
                                src={item.media_url}
                                alt="Community GIF"
                                className="max-h-72 max-w-full rounded-xl border border-gray-800 object-contain"
                              />

                              {item.message &&
                                item.message !==
                                  "🎞️ GIF" && (
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-300">
                                    {item.message}
                                  </p>
                                )}
                            </div>
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-300">
                              {getMessagePreview(item)}
                            </p>
                          )}

                          {item.reply_to_id && (
                            <p className="mt-2 text-[10px] text-gray-600">
                              ↳ This message is a reply.
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedMessage(
                                  item
                                )
                              }
                              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-gray-500 hover:text-white"
                            >
                              Inspect
                            </button>

                            {!item.is_deleted && (
                              <button
                                type="button"
                                onClick={() => openDeleteDialog(item)}
                                disabled={
                                  deletingId ===
                                  item.id
                                }
                                className="rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingId ===
                                item.id
                                  ? "Deleting..."
                                  : "Delete Message"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* INSPECTOR */}
          <aside className="h-fit rounded-2xl border border-gray-800 bg-[#0d0d0d] lg:sticky lg:top-6">
            <div className="border-b border-gray-800 px-5 py-4">
              <h2 className="font-bold">
                Message Inspector
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Details for the selected message.
              </p>
            </div>

            {!selectedMessage ? (
              <div className="p-6 text-center text-sm text-gray-600">
                Select a message from the list.
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    Player
                  </p>

                  <p className="mt-1 font-bold">
                    {getDisplayName(
                      selectedMessage
                    )}
                  </p>

                  <p className="mt-1 break-all text-[10px] text-gray-600">
                    User ID:{" "}
                    {selectedMessage.user_id}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    Message ID
                  </p>

                  <p className="mt-1 break-all text-xs text-gray-400">
                    {selectedMessage.id}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    Type
                  </p>

                  <p className="mt-1 text-sm font-bold uppercase">
                    {
                      selectedMessage.message_type
                    }
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    Sent
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    {formatTime(
                      selectedMessage.created_at
                    )}
                  </p>
                </div>

                {selectedMessage.reply_to_id && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      Reply To
                    </p>

                    <p className="mt-1 break-all text-xs text-gray-400">
                      {
                        selectedMessage.reply_to_id
                      }
                    </p>
                  </div>
                )}

                {selectedMessage.message && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      Caption / Text
                    </p>

                    <div className="mt-2 rounded-xl border border-gray-800 bg-black p-3 text-sm text-gray-300">
                      {
                        selectedMessage.message
                      }
                    </div>
                  </div>
                )}

                {selectedMessage.media_url && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      Media
                    </p>

                    <img
                      src={
                        selectedMessage.media_url
                      }
                      alt="Selected community media"
                      className="mt-2 max-h-64 w-full rounded-xl border border-gray-800 object-contain"
                    />
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    Status
                  </p>

                  <p
                    className={`mt-1 text-sm font-bold ${
                      selectedMessage.is_deleted
                        ? "text-red-400"
                        : "text-green-400"
                    }`}
                  >
                    {selectedMessage.is_deleted
                      ? "Deleted"
                      : "Visible"}
                  </p>
                </div>

                {!selectedMessage.is_deleted && (
                  <button
                    type="button"
                    onClick={() => openDeleteDialog(selectedMessage)}
                    disabled={
                      deletingId ===
                      selectedMessage.id
                    }
                    className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId ===
                    selectedMessage.id
                      ? "Deleting..."
                      : "Delete This Message"}
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteDialog()
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-red-900/50 bg-[#101010] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
                  MODERATION ACTION
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Delete Community Message
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  The player will be notified and the message will be
                  removed from the public community chat.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={Boolean(deletingId)}
                className="rounded-lg border border-gray-700 px-3 py-2 text-gray-400 transition hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                Player
              </p>
              <p className="mt-1 font-bold">{getDisplayName(deleteTarget)}</p>

              <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                Message
              </p>
              <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-sm text-gray-300">
                {getMessagePreview(deleteTarget)}
              </p>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Reason <span className="text-red-500">*</span>
              </label>

              <textarea
                value={deleteReason}
                onChange={(event) => {
                  setDeleteReason(event.target.value)
                  if (error) setError("")
                }}
                maxLength={500}
                rows={5}
                placeholder="Enter the reason for deleting this message..."
                disabled={Boolean(deletingId)}
                className="w-full resize-none rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              />

              <div className="mt-2 flex justify-between text-[10px] text-gray-600">
                <span>Required for moderation records.</span>
                <span>{deleteReason.length}/500</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={Boolean(deletingId)}
                className="rounded-xl border border-gray-700 bg-gray-900 px-5 py-3 text-sm font-bold text-gray-300 transition hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteMessage}
                disabled={Boolean(deletingId) || !deleteReason.trim()}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Delete Message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}