'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type UserRecord = {
  id: string
  bloodstrike_uid: string
  email: string
  phone: string | null
  country: string | null
  in_game_name: string
  display_name: string
  profile_image_url: string | null
  points: number
  matches_won: number
  total_kills: number
  is_blacklisted: boolean
  is_suspended: boolean
  created_at: string
  gold_balance: number
}

type Adjustment = {
  id: string
  stat_type: string
  amount: number
  direction: 'add' | 'remove'
  previous_value: number
  new_value: number
  reason: string
  created_at: string
}

type StatType = 'points' | 'kills' | 'matches_won'

export default function AdminUsersPage() {
  const supabase = createClient()

  const [users, setUsers] = useState<UserRecord[]>([])
  const [selectedUser, setSelectedUser] =
    useState<UserRecord | null>(null)

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [adjusting, setAdjusting] = useState(false)
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [statType, setStatType] =
    useState<StatType>('points')
  const [direction, setDirection] =
    useState<'add' | 'remove'>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const [adjustments, setAdjustments] =
    useState<Adjustment[]>([])
  const [loadingHistory, setLoadingHistory] =
    useState(false)

  const [statusUpdating, setStatusUpdating] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [pendingStatusAction, setPendingStatusAction] = useState<
    'suspend' | 'unsuspend' | 'blacklist' | 'unblacklist' | null
  >(null)
  const [statusReason, setStatusReason] = useState('')

  async function loadUsers(searchTerm = '') {
    setError('')

    if (searchTerm.trim()) {
      setSearching(true)
    } else {
      setLoading(true)
    }

    let query = supabase
      .from('profiles')
      .select(
        `
        id,
        bloodstrike_uid,
        email,
        phone,
        country,
        in_game_name,
        display_name,
        profile_image_url,
        points,
        matches_won,
        total_kills,
        is_blacklisted,
        is_suspended,
        created_at,
        wallets (
          gold_balance
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(100)

    const term = searchTerm.trim()

    if (term) {
      query = query.or(
        `bloodstrike_uid.ilike.%${term}%,email.ilike.%${term}%,display_name.ilike.%${term}%,in_game_name.ilike.%${term}%`
      )
    }

    const { data, error: loadError } = await query

    if (loadError) {
      setError(loadError.message)
      setUsers([])
      setSelectedUser(null)
      setLoading(false)
      setSearching(false)
      return
    }

    const formatted: UserRecord[] = (data || []).map(
      (user: any) => ({
        id: user.id,
        bloodstrike_uid: user.bloodstrike_uid,
        email: user.email,
        phone: user.phone ?? null,
        country: user.country ?? null,
        in_game_name: user.in_game_name,
        display_name: user.display_name,
        profile_image_url:
          user.profile_image_url ?? null,
        points: Number(user.points ?? 0),
        matches_won: Number(user.matches_won ?? 0),
        total_kills: Number(user.total_kills ?? 0),
        is_blacklisted: Boolean(
          user.is_blacklisted
        ),
        is_suspended: Boolean(
          user.is_suspended
        ),
        created_at: user.created_at,
        gold_balance: Number(
          Array.isArray(user.wallets)
            ? user.wallets[0]?.gold_balance ?? 0
            : user.wallets?.gold_balance ?? 0
        ),
      })
    )

    setUsers(formatted)

    if (
      selectedUser &&
      !formatted.some(
        (user) => user.id === selectedUser.id
      )
    ) {
      setSelectedUser(null)
    }

    setLoading(false)
    setSearching(false)
  }

  async function loadAdjustmentHistory(
    userId: string
  ) {
    setLoadingHistory(true)

    const { data, error: historyError } =
      await supabase
        .from('player_stat_adjustments')
        .select(
          `
          id,
          stat_type,
          amount,
          direction,
          previous_value,
          new_value,
          reason,
          created_at
        `
        )
        .eq('user_id', userId)
        .order('created_at', {
          ascending: false,
        })
        .limit(20)

    if (historyError) {
      setAdjustments([])
      setLoadingHistory(false)
      return
    }

    setAdjustments(
      (data || []).map((item: any) => ({
        id: item.id,
        stat_type: item.stat_type,
        amount: Number(item.amount),
        direction: item.direction,
        previous_value: Number(
          item.previous_value
        ),
        new_value: Number(item.new_value),
        reason: item.reason,
        created_at: item.created_at,
      }))
    )

    setLoadingHistory(false)
  }

  function openStatusAction(
    action: 'suspend' | 'unsuspend' | 'blacklist' | 'unblacklist'
  ) {
    if (!selectedUser || statusUpdating) return

    setPendingStatusAction(action)
    setStatusReason('')
    setError('')
    setMessage('')

    if (action === 'unsuspend' || action === 'unblacklist') {
      handleUserStatusChange(action)
      return
    }

    setShowStatusModal(true)
  }

  function closeStatusModal() {
    if (statusUpdating) return
    setShowStatusModal(false)
    setPendingStatusAction(null)
    setStatusReason('')
  }

  async function handleUserStatusChange(
    action: 'suspend' | 'unsuspend' | 'blacklist' | 'unblacklist',
    reasonText = ''
  ) {
    if (!selectedUser || statusUpdating) return

    const reason = reasonText.trim()

    if ((action === 'suspend' || action === 'blacklist') && !reason) {
      setError('A reason is required when suspending or blacklisting an account.')
      return
    }

    if (reason.length > 500) {
      setError('The reason cannot exceed 500 characters.')
      return
    }

    setStatusUpdating(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/admin/user-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          action,
          reason: reason || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error || 'Failed to update account status.'
        )
      }

      const updatedStatus = {
        is_suspended:
          action === 'suspend'
            ? true
            : action === 'unsuspend'
              ? false
              : selectedUser.is_suspended,
        is_blacklisted:
          action === 'blacklist'
            ? true
            : action === 'unblacklist'
              ? false
              : selectedUser.is_blacklisted,
      }

      const updatedUser: UserRecord = {
        ...selectedUser,
        ...updatedStatus,
      }

      setSelectedUser(updatedUser)

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === selectedUser.id
            ? updatedUser
            : user
        )
      )

      const successMessages = {
        suspend: 'User account suspended successfully.',
        unsuspend: 'User account unsuspended successfully.',
        blacklist: 'User account blacklisted successfully.',
        unblacklist: 'User removed from blacklist successfully.',
      }

      setMessage(successMessages[action])
      setShowStatusModal(false)
      setPendingStatusAction(null)
      setStatusReason('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update account status.'
      )
    } finally {
      setStatusUpdating(false)
    }
  }

  async function confirmStatusAction() {
    if (!pendingStatusAction) return

    const reason = statusReason.trim()

    if (!reason) {
      setError('A reason is required when suspending or blacklisting an account.')
      return
    }

    await handleUserStatusChange(pendingStatusAction, reason)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function selectUser(user: UserRecord) {
    setSelectedUser(user)
    setMessage('')
    setError('')
    loadAdjustmentHistory(user.id)
  }

  function openAdjustment(
    type: StatType,
    changeDirection: 'add' | 'remove'
  ) {
    if (!selectedUser) return

    setStatType(type)
    setDirection(changeDirection)
    setAmount('')
    setReason('')
    setError('')
    setMessage('')
    setShowAdjustment(true)
  }

  function getCurrentStatValue(
    user: UserRecord,
    type: StatType
  ) {
    if (type === 'points') {
      return user.points
    }

    if (type === 'kills') {
      return user.total_kills
    }

    return user.matches_won
  }

  function getStatLabel(type: StatType) {
    if (type === 'points') return 'Points'
    if (type === 'kills') return 'Total Kills'
    return 'Matches Won'
  }

  async function submitAdjustment() {
    if (!selectedUser) return

    const adjustmentAmount = Number(amount)

    if (
      !Number.isInteger(adjustmentAmount) ||
      adjustmentAmount <= 0
    ) {
      setError(
        'Enter a valid whole-number amount greater than zero.'
      )
      return
    }

    if (!reason.trim()) {
      setError(
        'A reason is required for every statistic adjustment.'
      )
      return
    }

    const currentValue = getCurrentStatValue(
      selectedUser,
      statType
    )

    if (
      direction === 'remove' &&
      adjustmentAmount > currentValue
    ) {
      setError(
        `You cannot remove ${adjustmentAmount} ${getStatLabel(
          statType
        ).toLowerCase()}. Current value is ${currentValue}.`
      )
      return
    }

    setAdjusting(true)
    setError('')
    setMessage('')

    const { data, error: rpcError } =
      await supabase.rpc(
        'admin_adjust_player_stat',
        {
          p_user_id: selectedUser.id,
          p_stat_type: statType,
          p_amount: adjustmentAmount,
          p_direction: direction,
          p_reason: reason.trim(),
        }
      )

    if (rpcError) {
      setError(rpcError.message)
      setAdjusting(false)
      return
    }

    const result = data as
      | {
          success?: boolean
          message?: string
          new_value?: number
        }
      | null

    if (result?.success === false) {
      setError(
        result.message ||
          'The statistic adjustment failed.'
      )
      setAdjusting(false)
      return
    }

    const newValue = Number(
      result?.new_value ??
        (direction === 'add'
          ? currentValue + adjustmentAmount
          : currentValue - adjustmentAmount)
    )

    const updatedUser: UserRecord = {
      ...selectedUser,
      points:
        statType === 'points'
          ? newValue
          : selectedUser.points,
      total_kills:
        statType === 'kills'
          ? newValue
          : selectedUser.total_kills,
      matches_won:
        statType === 'matches_won'
          ? newValue
          : selectedUser.matches_won,
    }

    setSelectedUser(updatedUser)

    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === selectedUser.id
          ? updatedUser
          : user
      )
    )

    setMessage(
      `${getStatLabel(statType)} ${
        direction === 'add'
          ? 'increased'
          : 'decreased'
      } successfully. New value: ${newValue}.`
    )

    setShowAdjustment(false)
    setAmount('')
    setReason('')

    await loadAdjustmentHistory(
      selectedUser.id
    )

    setAdjusting(false)
  }

  function handleSearch() {
    loadUsers(search)
  }

  function handleClear() {
    setSearch('')
    setSelectedUser(null)
    setAdjustments([])
    setMessage('')
    setError('')
    loadUsers('')
  }

  function formatDate(date: string) {
    try {
      return new Date(date).toLocaleString(
        undefined,
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      )
    } catch {
      return date
    }
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* Header */}
      <header className="border-b border-red-900/30 bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.35em] text-red-500">
              STRIKEHUB
            </p>

            <h1 className="mt-1 text-2xl font-black">
              USERS
            </h1>

            <p className="mt-1 text-xs text-gray-500">
              Manage STRIKEHUB player accounts
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
          >
            Back to Admin
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        {/* Search */}
        <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSearch()
                }
              }}
              placeholder="Search UID, email, display name or in-game name..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-500/50"
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="rounded-xl bg-red-600 px-6 py-3 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching
                ? 'Searching...'
                : 'Search'}
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-gray-400 transition hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-600">
            Search by BloodStrike UID, email, display
            name, or in-game name.
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mt-5 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-5 rounded-xl border border-green-900/40 bg-green-950/20 p-4 text-sm text-green-400">
            {message}
          </div>
        )}

        {/* Main content */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          {/* User list */}
          <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">
                  Player Accounts
                </h2>

                <p className="mt-1 text-xs text-gray-600">
                  {search
                    ? 'Search results'
                    : 'Recently registered players'}
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-gray-500">
                {users.length} users
              </span>
            </div>

            {loading ? (
              <div className="rounded-xl border border-white/5 bg-black/20 p-10 text-center">
                <div className="text-4xl">
                  👥
                </div>

                <p className="mt-3 font-bold">
                  Loading users...
                </p>
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/20 p-10 text-center">
                <div className="text-4xl">
                  🔎
                </div>

                <p className="mt-3 font-bold">
                  No users found
                </p>

                <p className="mt-1 text-xs text-gray-600">
                  Try a different search.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() =>
                      selectUser(user)
                    }
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedUser?.id === user.id
                        ? 'border-red-500/60 bg-red-500/10'
                        : 'border-white/5 bg-black/20 hover:border-red-900/50 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                            {user.profile_image_url ? (
                              <img
                                src={
                                  user.profile_image_url
                                }
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>👤</span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-black">
                              {user.display_name}
                            </p>

                            <p className="truncate text-xs text-gray-500">
                              {user.in_game_name}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-gray-600">
                          UID: {user.bloodstrike_uid}
                        </p>

                        <p className="mt-1 truncate text-xs text-gray-600">
                          {user.email}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:max-w-[230px] sm:justify-end">
                        <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-1.5 text-xs font-black text-yellow-400">
                          🪙{' '}
                          {user.gold_balance.toLocaleString()}
                        </span>

                        {user.is_suspended ? (
                          <span className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400">
                            Suspended
                          </span>
                        ) : user.is_blacklisted ? (
                          <span className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-400">
                            Blacklisted
                          </span>
                        ) : (
                          <span className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-1.5 text-xs font-bold text-green-400">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User details */}
          <aside className="h-fit rounded-2xl border border-red-900/30 bg-gradient-to-br from-[#180607] to-[#0d0d0d] p-6">
            {!selectedUser ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
                  User Details
                </p>

                <div className="mt-8 text-center">
                  <div className="text-5xl">
                    👤
                  </div>

                  <h2 className="mt-4 text-xl font-black">
                    Select a User
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    Select a player from the list to
                    view their account information and
                    available admin actions.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                    {selectedUser.profile_image_url ? (
                      <img
                        src={
                          selectedUser.profile_image_url
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">
                        👤
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xl font-black">
                      {selectedUser.display_name}
                    </p>

                    <p className="truncate text-sm text-gray-500">
                      {selectedUser.in_game_name}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedUser.is_suspended && (
                    <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
                      Suspended
                    </span>
                  )}

                  {selectedUser.is_blacklisted && (
                    <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-400">
                      Blacklisted
                    </span>
                  )}

                  {!selectedUser.is_suspended &&
                    !selectedUser.is_blacklisted && (
                      <span className="rounded-full border border-green-500/20 bg-green-500/5 px-3 py-1 text-xs font-bold text-green-400">
                        Active
                      </span>
                    )}
                </div>

                {/* Account info */}
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="text-[10px] font-bold text-gray-600">
                      BLOODSTRIKE UID
                    </p>

                    <p className="mt-1 break-all text-sm font-bold">
                      {selectedUser.bloodstrike_uid}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="text-[10px] font-bold text-gray-600">
                      EMAIL
                    </p>

                    <p className="mt-1 break-all text-sm font-bold">
                      {selectedUser.email}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Points */}
                    <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                      <p className="text-[10px] font-bold text-gray-600">
                        POINTS
                      </p>

                      <p className="mt-1 text-lg font-black">
                        {selectedUser.points.toLocaleString()}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openAdjustment(
                              'points',
                              'add'
                            )
                          }
                          className="flex-1 rounded-lg bg-green-600 px-2 py-1.5 text-xs font-black transition hover:bg-green-500"
                        >
                          + Add
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openAdjustment(
                              'points',
                              'remove'
                            )
                          }
                          className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-black transition hover:bg-red-500"
                        >
                          − Remove
                        </button>
                      </div>
                    </div>

                    {/* Gold */}
                    <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                      <p className="text-[10px] font-bold text-gray-600">
                        GOLD
                      </p>

                      <p className="mt-1 text-lg font-black text-yellow-400">
                        {selectedUser.gold_balance.toLocaleString()}
                      </p>

                      <Link
                        href="/admin/reward-user"
                        className="mt-3 block rounded-lg bg-yellow-500 px-2 py-1.5 text-center text-xs font-black text-black transition hover:bg-yellow-400"
                      >
                        🎁 Reward
                      </Link>
                    </div>

                    {/* Matches */}
                    <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                      <p className="text-[10px] font-bold text-gray-600">
                        MATCHES WON
                      </p>

                      <p className="mt-1 text-lg font-black">
                        {selectedUser.matches_won.toLocaleString()}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openAdjustment(
                              'matches_won',
                              'add'
                            )
                          }
                          className="flex-1 rounded-lg bg-green-600 px-2 py-1.5 text-xs font-black transition hover:bg-green-500"
                        >
                          + Add
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openAdjustment(
                              'matches_won',
                              'remove'
                            )
                          }
                          className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-black transition hover:bg-red-500"
                        >
                          − Remove
                        </button>
                      </div>
                    </div>

                    {/* Kills */}
                    <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                      <p className="text-[10px] font-bold text-gray-600">
                        TOTAL KILLS
                      </p>

                      <p className="mt-1 text-lg font-black">
                        {selectedUser.total_kills.toLocaleString()}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openAdjustment(
                              'kills',
                              'add'
                            )
                          }
                          className="flex-1 rounded-lg bg-green-600 px-2 py-1.5 text-xs font-black transition hover:bg-green-500"
                        >
                          + Add
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openAdjustment(
                              'kills',
                              'remove'
                            )
                          }
                          className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-black transition hover:bg-red-500"
                        >
                          − Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="text-[10px] font-bold text-gray-600">
                      COUNTRY
                    </p>

                    <p className="mt-1 text-sm font-bold">
                      {selectedUser.country ||
                        'Not provided'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="text-[10px] font-bold text-gray-600">
                      PHONE
                    </p>

                    <p className="mt-1 text-sm font-bold">
                      {selectedUser.phone ||
                        'Not provided'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <p className="text-[10px] font-bold text-gray-600">
                      REGISTERED
                    </p>

                    <p className="mt-1 text-sm font-bold text-gray-300">
                      {formatDate(
                        selectedUser.created_at
                      )}
                    </p>
                  </div>
                </div>

                {/* Admin actions */}
                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
                    Admin Actions
                  </p>
                  <div className="space-y-3">
                    <Link
                      href="/admin/reward-user"
                      className="block w-full rounded-xl bg-yellow-500 px-4 py-3 text-center text-sm font-black text-black transition hover:bg-yellow-400"
                    >
                      🎁 Reward Gold
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        openStatusAction(
                          selectedUser.is_suspended
                            ? 'unsuspend'
                            : 'suspend'
                        )
                      }
                      disabled={statusUpdating}
                      className={`w-full rounded-xl px-4 py-3 text-center text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedUser.is_suspended
                          ? 'bg-green-500 text-black hover:bg-green-400'
                          : 'bg-red-500 text-white hover:bg-red-400'
                      }`}
                    >
                      {statusUpdating
                        ? 'Updating...'
                        : selectedUser.is_suspended
                          ? '🟢 Unsuspend User'
                          : '🔴 Suspend User'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openStatusAction(
                          selectedUser.is_blacklisted
                            ? 'unblacklist'
                            : 'blacklist'
                        )
                      }
                      disabled={statusUpdating}
                      className={`w-full rounded-xl px-4 py-3 text-center text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        selectedUser.is_blacklisted
                          ? 'bg-green-500 text-black hover:bg-green-400'
                          : 'bg-orange-500 text-black hover:bg-orange-400'
                      }`}
                    >
                      {statusUpdating
                        ? 'Updating...'
                        : selectedUser.is_blacklisted
                          ? '🟢 Unblacklist User'
                          : '🟠 Blacklist User'}
                    </button>
                  </div>
                </div>

                {/* Adjustment history */}
                <div className="mt-6 border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
                        Adjustment History
                      </p>

                      <p className="mt-1 text-[11px] text-gray-600">
                        Recent Points, Kills and Wins changes
                      </p>
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-gray-600">
                      {adjustments.length}
                    </span>
                  </div>

                  {loadingHistory ? (
                    <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-5 text-center text-xs text-gray-600">
                      Loading history...
                    </div>
                  ) : adjustments.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-5 text-center text-xs text-gray-600">
                      No statistic adjustments yet.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {adjustments.map(
                        (adjustment) => (
                          <div
                            key={adjustment.id}
                            className="rounded-xl border border-white/5 bg-black/20 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-black">
                                {getStatLabel(
                                  adjustment.stat_type as StatType
                                )}
                              </p>

                              <span
                                className={`text-xs font-black ${
                                  adjustment.direction ===
                                  'add'
                                    ? 'text-green-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {adjustment.direction ===
                                'add'
                                  ? '+'
                                  : '−'}
                                {adjustment.amount}
                              </span>
                            </div>

                            <p className="mt-1 text-[11px] text-gray-500">
                              {adjustment.previous_value}
                              {' → '}
                              {adjustment.new_value}
                            </p>

                            <p className="mt-2 text-[11px] leading-5 text-gray-600">
                              {adjustment.reason}
                            </p>

                            <p className="mt-1 text-[10px] text-gray-700">
                              {formatDate(
                                adjustment.created_at
                              )}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </section>

      {/* Adjustment modal */}
      {showAdjustment &&
        selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-red-900/40 bg-[#101010] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
                    Statistic Adjustment
                  </p>

                  <h2 className="mt-2 text-xl font-black">
                    {direction === 'add'
                      ? 'Add'
                      : 'Remove'}{' '}
                    {getStatLabel(statType)}
                  </h2>

                  <p className="mt-1 text-xs text-gray-600">
                    {selectedUser.display_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAdjustment(false)
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 rounded-xl border border-white/5 bg-black/20 p-4">
                <p className="text-[10px] font-bold text-gray-600">
                  CURRENT {getStatLabel(
                    statType
                  ).toUpperCase()}
                </p>

                <p className="mt-1 text-2xl font-black">
                  {getCurrentStatValue(
                    selectedUser,
                    statType
                  ).toLocaleString()}
                </p>
              </div>

              <div className="mt-5">
                <label className="text-xs font-bold text-gray-400">
                  AMOUNT
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  placeholder="Enter amount"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-500/50"
                />
              </div>

              <div className="mt-4">
                <label className="text-xs font-bold text-gray-400">
                  REASON
                </label>

                <textarea
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                  rows={3}
                  placeholder="Why is this statistic being changed?"
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-500/50"
                />
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowAdjustment(false)
                  }
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-gray-400 transition hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={submitAdjustment}
                  disabled={adjusting}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    direction === 'add'
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-red-600 hover:bg-red-500'
                  }`}
                >
                  {adjusting
                    ? 'Updating...'
                    : direction === 'add'
                      ? 'Add'
                      : 'Remove'}
                </button>
              </div>

              <p className="mt-4 text-center text-[10px] leading-5 text-gray-700">
                This action is recorded in the
                STRIKEHUB administrator audit history.
              </p>
            </div>
          </div>
        )}

      {/* Account restriction reason modal */}
      {showStatusModal &&
        selectedUser &&
        pendingStatusAction && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-red-900/40 bg-[#101010] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
                    Account Restriction
                  </p>
                  <h2 className="mt-2 text-xl font-black">
                    {pendingStatusAction === 'suspend'
                      ? 'Suspend User'
                      : 'Blacklist User'}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedUser.display_name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeStatusModal}
                  disabled={statusUpdating}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 rounded-xl border border-red-500/10 bg-red-500/5 p-4">
                <p className="text-xs leading-5 text-gray-400">
                  A reason is required. The player will receive a notification explaining why the account was restricted.
                </p>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-400">
                    REASON
                  </label>
                  <span className="text-[10px] text-gray-600">
                    {statusReason.length}/500
                  </span>
                </div>

                <textarea
                  value={statusReason}
                  onChange={(event) =>
                    setStatusReason(event.target.value.slice(0, 500))
                  }
                  rows={5}
                  maxLength={500}
                  autoFocus
                  placeholder={
                    pendingStatusAction === 'suspend'
                      ? 'Explain why this account is being suspended...'
                      : 'Explain why this account is being blacklisted...'
                  }
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-500/50"
                />
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={closeStatusModal}
                  disabled={statusUpdating}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={confirmStatusAction}
                  disabled={statusUpdating || !statusReason.trim()}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    pendingStatusAction === 'suspend'
                      ? 'bg-red-600 text-white hover:bg-red-500'
                      : 'bg-orange-500 text-black hover:bg-orange-400'
                  }`}
                >
                  {statusUpdating
                    ? 'Updating...'
                    : pendingStatusAction === 'suspend'
                      ? 'Confirm Suspension'
                      : 'Confirm Blacklist'}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  )
}
