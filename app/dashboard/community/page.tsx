"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type MessageType = "text" | "image" | "gif"

type GiphyGif = {
  id: string
  title: string
  images: {
    fixed_width?: { url?: string }
    preview_gif?: { url?: string }
    original?: { url?: string }
  }
}

type GiphyResponse = {
  data?: GiphyGif[]
}

type CommunityMessage = {
  id: string
  user_id: string
  message: string | null
  message_type: MessageType
  media_url: string | null
  reply_to_id?: string | null
  created_at: string
  profiles:
    | {
        display_name: string | null
        in_game_name: string | null
        profile_image_url: string | null
      }
    | null
}

const BANNED_WORDS = [
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "fuck",
  "motherfucker",
  "bitch",
  "cunt",
]

const EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎",
  "😭", "😡", "🤬", "😱", "🤔", "🙄", "😴", "🤯",
  "🔥", "💀", "👀", "❤️", "💯", "🎯", "🏆", "🎮",
  "⚡", "😈", "🤝", "👍", "👎", "🙏", "🤣", "🥶",
  "🚀", "💥", "🫡", "👏", "😅", "😉", "🤩", "🗿",
  "🫶", "❤️‍🔥", "☠️", "👑", "💪", "🎉", "😤", "😏",
]

const MAX_IMAGE_SIZE = 15 * 1024 * 1024
const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY
const GIPHY_LIMIT = 24

function containsBannedWord(text: string) {
  const normalized = text.toLowerCase()

  return BANNED_WORDS.some((word) => {
    const pattern = new RegExp(
      `(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
      "i"
    )

    return pattern.test(normalized)
  })
}

function formatTime(date: string) {
  return new Date(date).toLocaleString([], {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function getMessagePreview(message: CommunityMessage) {
  if (message.message_type === "image") {
    return message.message?.trim() || "📷 Image"
  }

  if (message.message_type === "gif") {
    return message.message?.trim() || "🎞️ GIF"
  }

  return message.message?.trim() || "Message"
}

export default function CommunityPage() {
  const supabase = createClient()

  const emojiPickerRef = useRef<HTMLDivElement | null>(null)
  const gifPickerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const touchStartXRef = useRef<number | null>(null)
  const imagePreviewRef = useRef<string | null>(null)

  const [messages, setMessages] = useState<CommunityMessage[]>([])
  const [message, setMessage] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [isRestricted, setIsRestricted] = useState(false)
  const [restrictionReason, setRestrictionReason] = useState<"blacklisted" | "suspended" | null>(null)

  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifQuery, setGifQuery] = useState("")
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const [gifError, setGifError] = useState("")
  const [selectedGif, setSelectedGif] = useState<GiphyGif | null>(null)

  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const [replyTo, setReplyTo] = useState<CommunityMessage | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadMessages() {
    const { data, error } = await supabase
      .from("community_messages")
      .select(`
        id,
        user_id,
        message,
        message_type,
        media_url,
        reply_to_id,
        created_at,
        profiles!community_messages_user_id_fkey (
          display_name,
          in_game_name,
          profile_image_url
        )
      `)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("COMMUNITY LOAD ERROR:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })

      setError(
        `Could not load community messages: ${
          error.message || "Unknown database error"
        }`
      )

      return
    }

    const normalizedMessages: CommunityMessage[] = ((data || []) as unknown as Array<{
      id: string
      user_id: string
      message: string | null
      message_type: MessageType
      media_url: string | null
      reply_to_id?: string | null
      created_at: string
      profiles:
        | {
            display_name: string | null
            in_game_name: string | null
            profile_image_url: string | null
          }
        | {
            display_name: string | null
            in_game_name: string | null
            profile_image_url: string | null
          }[]
        | null
    }>).map((row) => ({
      ...row,
      profiles: Array.isArray(row.profiles)
        ? row.profiles[0] ?? null
        : row.profiles,
    }))

    setMessages(normalizedMessages)
  }

  async function loadUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = "/login"
      return
    }

    setUserId(user.id)
    await loadRestrictionStatus(user.id)
  }

  async function loadRestrictionStatus(currentUserId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_blacklisted, is_suspended")
      .eq("id", currentUserId)
      .maybeSingle()

    if (error) {
      // The database trigger remains the final protection.
      // Do not treat a profile-status lookup failure as a page-breaking error.
      console.warn("Could not load community restriction status:", error.message)
      return
    }

    if (data?.is_blacklisted) {
      setIsRestricted(true)
      setRestrictionReason("blacklisted")
      return
    }

    if (data?.is_suspended) {
      setIsRestricted(true)
      setRestrictionReason("suspended")
      return
    }

    setIsRestricted(false)
    setRestrictionReason(null)
  }

  function getRestrictionError(error: {
    message?: string | null
    code?: string | null
  }) {
    const databaseMessage = error?.message || ""

    if (databaseMessage.includes("BLACKLISTED_USER")) {
      setIsRestricted(true)
      setRestrictionReason("blacklisted")
      setSelectedGif(null)
      clearSelectedImage()
      setReplyTo(null)
      return "Your account is blacklisted and cannot send messages in the community."
    }

    if (databaseMessage.includes("SUSPENDED_USER")) {
      setIsRestricted(true)
      setRestrictionReason("suspended")
      setSelectedGif(null)
      clearSelectedImage()
      setReplyTo(null)
      return "Your account is suspended and cannot send messages in the community."
    }

    return null
  }

  useEffect(() => {
    async function initialize() {
      setLoading(true)

      await loadUser()
      await loadMessages()

      setLoading(false)
    }

    initialize()

    const interval = window.setInterval(() => {
      loadMessages()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!userId) {
      return
    }

    loadRestrictionStatus(userId)

    const interval = window.setInterval(() => {
      loadRestrictionStatus(userId)
    }, 5000)

    return () => window.clearInterval(interval)
  }, [userId])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node

      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false)
      }

      if (gifPickerRef.current && !gifPickerRef.current.contains(target)) {
        setShowGifPicker(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (imagePreviewRef.current) {
        URL.revokeObjectURL(imagePreviewRef.current)
      }
    }
  }, [])

  function addEmoji(emoji: string) {
    setMessage((current) => `${current}${emoji}`)
    setShowEmojiPicker(false)
  }

  function clearSelectedImage() {
    if (imagePreviewRef.current) {
      URL.revokeObjectURL(imagePreviewRef.current)
      imagePreviewRef.current = null
    }

    setSelectedImage(null)
    setImagePreview(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function handleImageSelect(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setError("")
    setSuccess("")

    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]

    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG, WebP and GIF images are allowed.")
      event.target.value = ""
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Images/GIFs cannot be larger than 15 MB.")
      event.target.value = ""
      return
    }

    if (imagePreviewRef.current) {
      URL.revokeObjectURL(imagePreviewRef.current)
    }

    const preview = URL.createObjectURL(file)

    imagePreviewRef.current = preview
    setSelectedImage(file)
    setImagePreview(preview)
  }

  async function loadGifs(query = "") {
    if (!GIPHY_API_KEY) {
      setGifError("GIPHY is not configured. Add NEXT_PUBLIC_GIPHY_API_KEY to .env.local.")
      return
    }

    setLoadingGifs(true)
    setGifError("")

    try {
      const endpoint = query.trim()
        ? "https://api.giphy.com/v1/gifs/search"
        : "https://api.giphy.com/v1/gifs/trending"

      const params = new URLSearchParams({
        api_key: GIPHY_API_KEY,
        limit: String(GIPHY_LIMIT),
        rating: "pg-13",
      })

      if (query.trim()) {
        params.set("q", query.trim())
        params.set("lang", "en")
      }

      const response = await fetch(`${endpoint}?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`GIPHY request failed (${response.status})`)
      }

      const result = (await response.json()) as GiphyResponse
      setGifs(result.data || [])
    } catch (error) {
      console.error("GIPHY LOAD ERROR:", error)
      setGifError("Could not load GIFs. Please try again.")
      setGifs([])
    } finally {
      setLoadingGifs(false)
    }
  }

  async function openGifPicker() {
    const nextOpen = !showGifPicker
    setShowEmojiPicker(false)
    setShowGifPicker(nextOpen)
    setGifError("")

    if (nextOpen && gifs.length === 0) {
      await loadGifs("")
    }
  }

  function selectGif(gif: GiphyGif) {
    const url =
      gif.images.fixed_width?.url ||
      gif.images.original?.url ||
      gif.images.preview_gif?.url

    if (!url) {
      setGifError("This GIF is unavailable. Please choose another one.")
      return
    }

    setSelectedGif(gif)
    setShowGifPicker(false)
    setMessage("")
    setError("")
    setSuccess("")
  }

  function clearSelectedGif() {
    setSelectedGif(null)
  }

  async function sendGiphyGif() {
    if (isRestricted) {
      setError(
        restrictionReason === "blacklisted"
          ? "Your account is blacklisted and cannot send messages in the community."
          : "Your account is suspended and cannot send messages in the community."
      )
      return false
    }

    if (!selectedGif || !userId) return false

    const mediaUrl =
      selectedGif.images.original?.url ||
      selectedGif.images.fixed_width?.url ||
      selectedGif.images.preview_gif?.url

    if (!mediaUrl) {
      setError("This GIF is unavailable. Please choose another one.")
      return false
    }

    const caption = message.trim()

    if (caption.length > 500) {
      setError("GIF captions cannot exceed 500 characters.")
      return false
    }

    if (caption && containsBannedWord(caption)) {
      setError("Your GIF caption contains a banned word.")
      return false
    }

    const { error: insertError } = await supabase
      .from("community_messages")
      .insert({
        user_id: userId,
        message: caption || "🎞️ GIF",
        message_type: "gif",
        media_url: mediaUrl,
        reply_to_id: replyTo?.id || null,
      })

    if (insertError) {
      const restrictionMessage = getRestrictionError(insertError)

      if (restrictionMessage) {
        setError(restrictionMessage)
      } else {
        console.error("COMMUNITY GIPHY SEND ERROR:", insertError)
        setError(`GIF could not be sent: ${insertError.message || "Unknown database error"}`)
      }

      return false
    }

    clearSelectedGif()
    return true
  }

  function selectReply(item: CommunityMessage) {
    if (item.id === replyTo?.id) {
      setReplyTo(null)
      return
    }

    setReplyTo(item)
    setError("")
    setSuccess("")
  }

  function handleMessageTouchStart(
    event: React.TouchEvent<HTMLDivElement>
  ) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }

  function handleMessageTouchEnd(
    event: React.TouchEvent<HTMLDivElement>,
    item: CommunityMessage
  ) {
    const startX = touchStartXRef.current
    touchStartXRef.current = null

    if (startX === null) {
      return
    }

    const endX = event.changedTouches[0]?.clientX ?? startX
    const deltaX = endX - startX

    // Swipe left to reply.
    if (deltaX < -60) {
      selectReply(item)
    }
  }

  function getReplyTarget(replyToId: string | null | undefined) {
    if (!replyToId) {
      return null
    }

    return messages.find((item) => item.id === replyToId) || null
  }

  async function sendTextMessage() {
    if (isRestricted) {
      setError(
        restrictionReason === "blacklisted"
          ? "Your account is blacklisted and cannot send messages in the community."
          : "Your account is suspended and cannot send messages in the community."
      )
      return false
    }

    const cleaned = message.trim()

    if (!cleaned) {
      setError("Please enter a message.")
      return false
    }

    if (cleaned.length > 500) {
      setError("Messages cannot exceed 500 characters.")
      return false
    }

    if (containsBannedWord(cleaned)) {
      setError("Your message contains a banned word.")
      return false
    }

    if (!userId) {
      setError("You must be logged in to send a message.")
      return false
    }

    const { error: insertError } = await supabase
      .from("community_messages")
      .insert({
        user_id: userId,
        message: cleaned,
        message_type: "text",
        media_url: null,
        reply_to_id: replyTo?.id || null,
      })

    if (insertError) {
      const restrictionMessage = getRestrictionError(insertError)

      if (restrictionMessage) {
        setError(restrictionMessage)
      } else {
        console.error("COMMUNITY TEXT SEND ERROR:", insertError)
        setError(
          `Your message could not be sent: ${
            insertError.message || "Unknown database error"
          }`
        )
      }

      return false
    }

    return true
  }

  async function sendImageMessage() {
    if (isRestricted) {
      setError(
        restrictionReason === "blacklisted"
          ? "Your account is blacklisted and cannot send messages in the community."
          : "Your account is suspended and cannot send messages in the community."
      )
      return false
    }

    if (!selectedImage || !userId) {
      return false
    }

    setUploadingImage(true)

    const extension =
      selectedImage.name.split(".").pop()?.toLowerCase() || "jpg"

    const fileName = `${crypto.randomUUID()}.${extension}`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from("community-media")
      .upload(filePath, selectedImage, {
        cacheControl: "3600",
        upsert: false,
        contentType: selectedImage.type,
      })

    if (uploadError) {
      console.error("COMMUNITY IMAGE UPLOAD ERROR:", uploadError)

      setError(
        `Image upload failed: ${
          uploadError.message || "Unknown upload error"
        }`
      )

      setUploadingImage(false)
      return false
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("community-media")
      .getPublicUrl(filePath)

    const isGif = selectedImage.type === "image/gif"
    const caption = message.trim()
    const fallbackMessage = isGif ? "🎞️ GIF" : "📷 Image"

    const { error: insertError } = await supabase
      .from("community_messages")
      .insert({
        user_id: userId,
        message: caption || fallbackMessage,
        message_type: isGif ? "gif" : "image",
        media_url: publicUrl,
        reply_to_id: replyTo?.id || null,
      })

    if (insertError) {
      // The message was not created, so remove the uploaded object.
      await supabase.storage.from("community-media").remove([filePath])

      const restrictionMessage = getRestrictionError(insertError)

      if (restrictionMessage) {
        setError(restrictionMessage)
      } else {
        console.error("COMMUNITY IMAGE MESSAGE ERROR:", insertError)
        setError(
          `Image message could not be created: ${
            insertError.message || "Unknown database error"
          }`
        )
      }

      setUploadingImage(false)
      return false
    }

    clearSelectedImage()
    setUploadingImage(false)

    return true
  }

  async function sendMessage() {
    setError("")
    setSuccess("")

    if (isRestricted) {
      setError(
        restrictionReason === "blacklisted"
          ? "Your account is blacklisted and cannot send messages in the community."
          : "Your account is suspended and cannot send messages in the community."
      )
      return
    }

    if (!message.trim() && !selectedImage && !selectedGif) {
      setError("Please enter a message, select an image/GIF, or choose a GIPHY GIF.")
      return
    }

    if (!userId) {
      setError("You must be logged in to send a message.")
      return
    }

    setSending(true)

    let sent = false

    if (selectedGif) {
      sent = await sendGiphyGif()
    } else if (selectedImage) {
      sent = await sendImageMessage()
    } else {
      sent = await sendTextMessage()
    }

    if (sent) {
      setMessage("")
      setReplyTo(null)
      setSuccess("Message sent.")
      await loadMessages()

      window.setTimeout(() => {
        setSuccess("")
      }, 2500)
    }

    setSending(false)
  }

  async function deleteMessage(item: CommunityMessage) {
    if (!userId || item.user_id !== userId) {
      setError("You can only delete your own messages.")
      return
    }

    const confirmed = window.confirm(
      "Delete this message? It will be removed from the community chat."
    )

    if (!confirmed) {
      return
    }

    setError("")
    setSuccess("")
    setDeletingId(item.id)

    const { error: deleteError } = await supabase.rpc(
      "delete_own_community_message",
      {
        p_message_id: item.id,
      }
    )

    if (deleteError) {
      console.error("COMMUNITY DELETE ERROR:", deleteError)

      setError(
        `Message could not be deleted: ${
          deleteError.message || "Unknown database error"
        }`
      )

      setDeletingId(null)
      return
    }

    if (replyTo?.id === item.id) {
      setReplyTo(null)
    }

    setMessages((current) =>
      current.filter((messageItem) => messageItem.id !== item.id)
    )

    setSuccess("Message deleted.")

    window.setTimeout(() => {
      setSuccess("")
    }, 2500)

    setDeletingId(null)
  }

  function getDisplayName(item: CommunityMessage) {
    return (
      item.profiles?.in_game_name ||
      item.profiles?.display_name ||
      "STRIKEHUB Player"
    )
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.35em] text-red-500">
              STRIKEHUB
            </p>

            <h1 className="text-3xl font-black uppercase">
              Community
            </h1>

            <p className="mt-1 text-sm text-gray-400">
              Chat with the STRIKEHUB community.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-center text-sm font-bold hover:bg-gray-800"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Chat */}
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0d0d0d]">
          <div className="border-b border-gray-800 px-5 py-4">
            <h2 className="font-bold">Community Chat</h2>

            <p className="text-xs text-gray-500">
              Keep the conversation respectful.
            </p>
          </div>

          {/* Messages */}
          <div className="h-[55vh] overflow-y-auto px-4 py-5">
            {loading ? (
              <div className="flex h-full items-center justify-center text-gray-500">
                Loading community...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-gray-500">
                <div>
                  <p className="font-semibold text-gray-300">
                    No messages yet.
                  </p>

                  <p className="mt-1 text-sm">
                    Be the first person to start the conversation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((item) => {
                  const name = getDisplayName(item)
                  const isMine = item.user_id === userId
                  const replyTarget = getReplyTarget(item.reply_to_id)

                  return (
                    <div
                      key={item.id}
                      className={`flex ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                      onTouchStart={(event) =>
                        handleMessageTouchStart(event)
                      }
                      onTouchEnd={(event) =>
                        handleMessageTouchEnd(event, item)
                      }
                    >
                      <div
                        className={`group max-w-[88%] rounded-2xl px-4 py-3 ${
                          isMine
                            ? "bg-red-600"
                            : "border border-gray-800 bg-[#181818]"
                        }`}
                      >
                        {/* Reply action row */}
                        <div
                          className={`mb-1 flex items-center gap-2 ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => selectReply(item)}
                            className={`text-[10px] font-bold transition ${
                              isMine
                                ? "text-red-100 hover:text-white"
                                : "text-gray-500 hover:text-white"
                            }`}
                            title="Reply to this message"
                          >
                            Reply
                          </button>

                          <span className="text-xs font-bold">
                            {name}
                          </span>

                          <span
                            className={`text-[10px] ${
                              isMine
                                ? "text-red-100"
                                : "text-gray-500"
                            }`}
                          >
                            {formatTime(item.created_at)}
                          </span>

                          {isMine && (
                            <>
                              <button
                                type="button"
                                onClick={() => selectReply(item)}
                                className="text-[10px] font-bold text-red-100 transition hover:text-white"
                                title="Reply to this message"
                              >
                                Reply
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteMessage(item)}
                                disabled={deletingId === item.id}
                                className="text-[10px] font-bold text-red-100 transition hover:text-white disabled:opacity-50"
                                title="Delete your message"
                              >
                                {deletingId === item.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </>
                          )}
                        </div>

                        {/* Reply preview inside message */}
                        {replyTarget && (
                          <button
                            type="button"
                            onClick={() => selectReply(replyTarget)}
                            className={`mb-2 w-full rounded-lg border-l-2 px-3 py-2 text-left ${
                              isMine
                                ? "border-red-200 bg-red-700/70"
                                : "border-red-500 bg-black/30"
                            }`}
                          >
                            <div
                              className={`text-[10px] font-bold ${
                                isMine
                                  ? "text-red-100"
                                  : "text-red-400"
                              }`}
                            >
                              Replying to {getDisplayName(replyTarget)}
                            </div>

                            <div
                              className={`mt-0.5 truncate text-[11px] ${
                                isMine
                                  ? "text-red-100"
                                  : "text-gray-400"
                              }`}
                            >
                              {getMessagePreview(replyTarget)}
                            </div>
                          </button>
                        )}

                        {/* Media */}
                        {(item.message_type === "image" ||
                          item.message_type === "gif") &&
                          item.media_url && (
                            <div>
                              <img
                                src={item.media_url}
                                alt={
                                  item.message_type === "gif"
                                    ? "Community GIF"
                                    : "Community image"
                                }
                                className="max-h-[400px] max-w-full rounded-xl object-contain"
                              />

                              {item.message &&
                                item.message !== "📷 Image" &&
                                item.message !== "🎞️ GIF" && (
                                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                                    {item.message}
                                  </p>
                                )}
                            </div>
                          )}

                        {/* Text */}
                        {item.message_type === "text" && (
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {item.message}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-800 p-4">
            {isRestricted && (
              <div className="mb-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-3 text-sm text-red-300">
                <p className="font-bold">
                  {restrictionReason === "blacklisted"
                    ? "Account Blacklisted"
                    : "Account Suspended"}
                </p>
                <p className="mt-1">
                  {restrictionReason === "blacklisted"
                    ? "You cannot send messages, images or GIFs in the community while your account is blacklisted."
                    : "You cannot send messages, images or GIFs in the community while your account is suspended."}
                </p>
              </div>
            )}

            {error && (!isRestricted || !error.includes("cannot send messages")) && (
              <div className="mb-3 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-3 rounded-lg border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-400">
                {success}
              </div>
            )}

            {/* Reply composer */}
            {replyTo && (
              <div className="mb-3 rounded-xl border border-gray-700 bg-[#111111] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                      Replying to {getDisplayName(replyTo)}
                    </p>

                    <p className="mt-1 truncate text-xs text-gray-400">
                      {getMessagePreview(replyTo)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="shrink-0 text-xs font-bold text-gray-500 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* GIPHY preview */}
            {selectedGif && (
              <div className="mb-3 rounded-xl border border-gray-700 bg-black p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">GIF preview</span>
                  <button
                    type="button"
                    onClick={clearSelectedGif}
                    className="text-xs font-bold text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
                <img
                  src={
                    selectedGif.images.fixed_width?.url ||
                    selectedGif.images.original?.url ||
                    selectedGif.images.preview_gif?.url ||
                    ""
                  }
                  alt={selectedGif.title || "Selected GIF"}
                  className="max-h-56 max-w-full rounded-lg object-contain"
                />
                <p className="mt-2 text-[10px] text-gray-600">Powered by GIPHY</p>
              </div>
            )}

            {/* Image preview */}
            {imagePreview && selectedImage && (
              <div className="mb-3 rounded-xl border border-gray-700 bg-black p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">
                    {selectedImage.type === "image/gif"
                      ? "GIF preview"
                      : "Image preview"}
                  </span>

                  <button
                    type="button"
                    onClick={clearSelectedImage}
                    className="text-xs font-bold text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>

                <img
                  src={imagePreview}
                  alt="Selected media preview"
                  className="max-h-56 rounded-lg object-contain"
                />
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              {/* Emoji */}
              <div ref={emojiPickerRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setShowEmojiPicker((current) => !current)
                  }
                  disabled={isRestricted || sending || uploadingImage}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-700 bg-gray-900 text-xl transition hover:border-red-500 hover:bg-gray-800"
                  aria-label="Open emoji picker"
                >
                  🙂
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-14 left-0 z-50 w-72 rounded-2xl border border-gray-700 bg-[#111111] p-3 shadow-2xl">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Emojis
                      </span>

                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(false)}
                        className="text-xs text-gray-500 hover:text-white"
                      >
                        Close
                      </button>
                    </div>

                    <div className="grid grid-cols-8 gap-1">
                      {EMOJIS.map((emoji, index) => (
                        <button
                          key={`${emoji}-${index}`}
                          type="button"
                          onClick={() => addEmoji(emoji)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:bg-gray-800"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* GIPHY GIF picker */}
              <div ref={gifPickerRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={openGifPicker}
                  disabled={isRestricted || sending || uploadingImage}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-700 bg-gray-900 text-xs font-black text-white transition hover:border-red-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Open GIF picker"
                  title="Search GIPHY GIFs"
                >
                  GIF
                </button>

                {showGifPicker && (
                  <div className="absolute bottom-14 left-0 z-50 w-[min(92vw,380px)] rounded-2xl border border-gray-700 bg-[#111111] p-3 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">GIFs</span>
                        <p className="text-[10px] text-gray-600">Trending GIFs</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGifPicker(false)}
                        className="text-xs text-gray-500 hover:text-white"
                      >
                        Close
                      </button>
                    </div>

                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        loadGifs(gifQuery)
                      }}
                      className="mb-3 flex gap-2"
                    >
                      <input
                        value={gifQuery}
                        onChange={(event) => setGifQuery(event.target.value)}
                        placeholder="Search GIFs..."
                        className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-black px-3 py-2 text-xs text-white outline-none focus:border-red-500"
                        aria-label="Search GIFs"
                      />
                      <button
                        type="submit"
                        disabled={loadingGifs}
                        className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                      >
                        Search
                      </button>
                    </form>

                    {gifError && (
                      <div className="mb-3 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-[11px] text-red-400">
                        {gifError}
                      </div>
                    )}

                    {loadingGifs ? (
                      <div className="flex h-48 items-center justify-center text-xs text-gray-500">
                        Loading GIFs...
                      </div>
                    ) : gifs.length === 0 ? (
                      <div className="flex h-48 items-center justify-center text-xs text-gray-500">
                        No GIFs found.
                      </div>
                    ) : (
                      <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto pr-1">
                        {gifs.map((gif) => {
                          const previewUrl =
                            gif.images.fixed_width?.url ||
                            gif.images.preview_gif?.url ||
                            gif.images.original?.url

                          if (!previewUrl) return null

                          return (
                            <button
                              key={gif.id}
                              type="button"
                              onClick={() => selectGif(gif)}
                              className="group overflow-hidden rounded-lg border border-gray-800 bg-black transition hover:border-red-500"
                              title={gif.title || "GIF"}
                            >
                              <img
                                src={previewUrl}
                                alt={gif.title || "GIPHY GIF"}
                                loading="lazy"
                                className="h-24 w-full object-cover transition group-hover:scale-105"
                              />
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <p className="mt-2 text-center text-[10px] text-gray-600">Powered by GIPHY</p>
                  </div>
                )}
              </div>

              {/* Image/GIF upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageSelect}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploadingImage || Boolean(selectedGif)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-700 bg-gray-900 text-lg transition hover:border-red-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Upload image or GIF"
                title="Upload image or GIF"
              >
                🖼️
              </button>

              {/* Text */}
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
                maxLength={500}
                placeholder={
                  selectedGif
                    ? "Add a GIF caption (optional)..."
                    : selectedImage
                      ? "Add a caption (optional)..."
                      : replyTo
                        ? "Write your reply..."
                        : "Type a message..."
                }
                className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-black px-4 py-3 text-sm text-white outline-none focus:border-red-500"
              />

              {/* Send */}
              <button
                type="button"
                onClick={sendMessage}
                disabled={sending || uploadingImage}
                className="rounded-xl bg-red-600 px-6 py-3 font-bold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadingImage
                  ? "Uploading..."
                  : sending
                    ? "Sending..."
                    : "Send"}
              </button>
            </div>

            <div className="mt-2 flex justify-between text-[11px] text-gray-600">
              <span>
                Swipe left on a message to reply. You can delete only your
                own messages.
              </span>

              <span>{message.length}/500</span>
            </div>

            <p className="mt-1 text-[10px] text-gray-700">
              Images/GIFs: JPG, PNG, WebP or GIF • Maximum 15 MB
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
