'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export default function NotificationButton() {
  const supabase = createClient()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)

  async function loadNotifications() {
    setLoading(true)
    setErrorMessage(null)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        setErrorMessage(`Authentication error: ${userError.message}`)
        setLoading(false)
        return
      }

      if (!user) {
        setErrorMessage('No logged-in user was found.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, message, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Notification query error:', error)
        setErrorMessage(`Database error: ${error.message}`)
        setLoading(false)
        return
      }

      setNotifications(data ?? [])
      setUnreadCount(
        (data ?? []).filter(
          (notification) => !notification.is_read
        ).length
      )
    } catch (error) {
      console.error('Notification loading error:', error)

      if (error instanceof Error) {
        setErrorMessage(`Unexpected error: ${error.message}`)
      } else {
        setErrorMessage('An unexpected error occurred.')
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  async function markAsRead(id: string) {
    setErrorMessage(null)

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    if (error) {
      console.error('Mark as read error:', error)
      setErrorMessage(`Could not mark notification as read: ${error.message}`)
      return
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification
      )
    )

    setUnreadCount((current) => Math.max(0, current - 1))
  }

  async function markAllAsRead() {
    setErrorMessage(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      setErrorMessage(`Authentication error: ${userError.message}`)
      return
    }

    if (!user) {
      setErrorMessage('No logged-in user was found.')
      return
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      console.error('Mark all as read error:', error)
      setErrorMessage(`Could not mark notifications as read: ${error.message}`)
      return
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    )

    setUnreadCount(0)
  }

  function formatTime(value: string) {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return date.toLocaleString('en-NG', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function getIcon(type: string) {
    switch (type) {
      case 'task':
        return '🎯'
      case 'tournament':
        return '🏆'
      case 'wallet':
        return '🪙'
      case 'referral':
        return '👥'
      case 'withdrawal':
        return '💰'
      case 'stake':
        return '🎲'
      case 'shop':
        return '🛒'
      case 'promotion':
        return '📣'
      case 'moderation':
        return '🛡️'
      default:
        return '🔔'
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current)

          if (!open) {
            loadNotifications()
          }
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-lg transition hover:border-red-500/30 hover:bg-red-500/5"
      >
        🔔

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#09080c] bg-red-600 px-1 text-[9px] font-black text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-[100] w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-white/10 bg-[#100d11]/98 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">
                STRIKEHUB
              </p>

              <h3 className="mt-1 text-lg font-black">
                Notifications
              </h3>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[10px] font-bold text-red-400 transition hover:text-red-300"
              >
                Mark all read
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-red-400">
                Notification Error
              </p>

              <p className="mt-1 text-xs leading-5 text-red-200">
                {errorMessage}
              </p>
            </div>
          )}

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="px-5 py-10 text-center">
                <div className="animate-pulse text-2xl">
                  🔔
                </div>

                <p className="mt-3 text-xs text-gray-500">
                  Loading notifications...
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="text-3xl">
                  🔕
                </div>

                <p className="mt-3 text-sm font-bold text-gray-300">
                  No notifications
                </p>

                <p className="mt-1 text-xs text-gray-600">
                  You&apos;re all caught up.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id)
                    }
                  }}
                  className={`w-full border-b border-white/5 px-5 py-4 text-left transition hover:bg-white/[0.03] ${
                    !notification.is_read
                      ? 'bg-red-500/[0.04]'
                      : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        !notification.is_read
                          ? 'border-red-500/30 bg-red-500/10'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      {getIcon(notification.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm font-bold ${
                            !notification.is_read
                              ? 'text-white'
                              : 'text-gray-400'
                          }`}
                        >
                          {notification.title}
                        </p>

                        {!notification.is_read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {notification.message}
                      </p>

                      <p className="mt-2 text-[9px] font-semibold text-gray-700">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-white/10 px-5 py-3">
              <button
                type="button"
                onClick={loadNotifications}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 text-[10px] font-bold text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                ↻ Refresh Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}