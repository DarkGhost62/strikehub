'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type UserResult = {
  id: string
  bloodstrike_uid: string
  email: string
  display_name: string
  in_game_name: string
  points: number
  matches_won: number
  total_kills: number
  is_blacklisted: boolean
  is_suspended: boolean
  gold_balance: number
}

export default function RewardUserPage() {
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<UserResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('Manual admin reward')

  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    searchUsers()
  }, [])

  async function searchUsers() {
    setSearching(true)
    setError('')
    setMessage('')

    const query = search.trim()

    let request = supabase
      .from('profiles')
      .select(
        `
        id,
        bloodstrike_uid,
        email,
        display_name,
        in_game_name,
        points,
        matches_won,
        total_kills,
        is_blacklisted,
        is_suspended,
        wallets (
          gold_balance
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(20)

    if (query) {
      request = request.or(
        `bloodstrike_uid.ilike.%${query}%,email.ilike.%${query}%,display_name.ilike.%${query}%,in_game_name.ilike.%${query}%`
      )
    }

    const { data, error: searchError } = await request

    if (searchError) {
      setError(searchError.message)
      setUsers([])
      setSearching(false)
      return
    }

    const formattedUsers: UserResult[] = (data || []).map(
      (user: any) => ({
        id: user.id,
        bloodstrike_uid: user.bloodstrike_uid,
        email: user.email,
        display_name: user.display_name,
        in_game_name: user.in_game_name,
        points: Number(user.points ?? 0),
        matches_won: Number(user.matches_won ?? 0),
        total_kills: Number(user.total_kills ?? 0),
        is_blacklisted: Boolean(user.is_blacklisted),
        is_suspended: Boolean(user.is_suspended),
        gold_balance: Number(
          Array.isArray(user.wallets)
            ? user.wallets[0]?.gold_balance ?? 0
            : user.wallets?.gold_balance ?? 0
        ),
      })
    )

    setUsers(formattedUsers)
    setSearching(false)
  }

  function selectUser(user: UserResult) {
    setSelectedUser(user)
    setAmount('')
    setMessage('')
    setError('')
  }

  async function rewardUser() {
    if (!selectedUser) {
      setError('Please select a user first.')
      return
    }

    const rewardAmount = Number(amount)

    if (!Number.isInteger(rewardAmount) || rewardAmount <= 0) {
      setError('Enter a valid whole-number Gold amount.')
      return
    }

    if (!description.trim()) {
      setError('Please enter a reward description.')
      return
    }

    if (selectedUser.is_suspended) {
      setError('This account is suspended. Reward cannot be sent.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    const { data, error: rewardError } = await supabase.rpc(
      'admin_reward_user',
      {
        p_user_id: selectedUser.id,
        p_amount: rewardAmount,
        p_reward_type: 'adjustment',
        p_description: description.trim(),
        p_reference_type: 'manual_reward',
        p_reference_id: null,
      }
    )

    if (rewardError) {
      setError(rewardError.message)
      setLoading(false)
      return
    }

    const result = data as
      | {
          success?: boolean
          message?: string
        }
      | null

    if (result?.success === false) {
      setError(result.message || 'Reward could not be completed.')
      setLoading(false)
      return
    }

    setMessage(
      `Successfully rewarded ${rewardAmount.toLocaleString()} Gold to ${selectedUser.display_name}.`
    )

    setAmount('')

    await searchUsers()

    const refreshedUser = users.find(
      (user) => user.id === selectedUser.id
    )

    if (refreshedUser) {
      setSelectedUser({
        ...refreshedUser,
        gold_balance:
          refreshedUser.gold_balance + rewardAmount,
      })
    }

    setLoading(false)
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
              REWARD USER
            </h1>

            <p className="mt-1 text-xs text-gray-500">
              Send Gold from the Admin Wallet
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
          <div className="flex flex-col gap-4 md:flex-row">
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  searchUsers()
                }
              }}
              placeholder="Search UID, email, display name or in-game name..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-500/50"
            />

            <button
              type="button"
              onClick={searchUsers}
              disabled={searching}
              className="rounded-xl bg-red-600 px-6 py-3 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search Users'}
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-600">
            Search using a BloodStrike UID, email, display name,
            or in-game name.
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

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          {/* Users */}
          <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black">
                  Users
                </h2>

                <p className="mt-1 text-xs text-gray-600">
                  Select a user to reward.
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-gray-500">
                {users.length} shown
              </span>
            </div>

            {users.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-black/20 p-8 text-center">
                <div className="text-4xl">👥</div>

                <p className="mt-3 font-bold">
                  No users found
                </p>

                <p className="mt-1 text-xs text-gray-600">
                  Try another search.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => selectUser(user)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedUser?.id === user.id
                        ? 'border-red-500/60 bg-red-500/10'
                        : 'border-white/5 bg-black/20 hover:border-red-900/50 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-black">
                          {user.display_name}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {user.in_game_name}
                        </p>

                        <p className="mt-1 text-xs text-gray-600">
                          UID: {user.bloodstrike_uid}
                        </p>

                        <p className="mt-1 truncate text-xs text-gray-600">
                          {user.email}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-1.5 text-xs font-black text-yellow-400">
                          🪙 {user.gold_balance.toLocaleString()} Gold
                        </span>

                        {user.is_suspended && (
                          <span className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-400">
                            Suspended
                          </span>
                        )}

                        {user.is_blacklisted && (
                          <span className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-orange-400">
                            Blacklisted
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reward */}
          <div className="h-fit rounded-2xl border border-red-900/30 bg-gradient-to-br from-[#180607] to-[#0d0d0d] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
              Gold Reward
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Reward Player
            </h2>

            {!selectedUser ? (
              <div className="mt-6 rounded-xl border border-white/5 bg-black/20 p-6 text-center">
                <div className="text-4xl">🎁</div>

                <p className="mt-3 text-sm font-bold">
                  Select a user
                </p>

                <p className="mt-1 text-xs leading-5 text-gray-600">
                  Choose a player from the list to send Gold.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-gray-600">
                    SELECTED USER
                  </p>

                  <p className="mt-2 text-lg font-black">
                    {selectedUser.display_name}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {selectedUser.in_game_name}
                  </p>

                  <p className="mt-2 text-xs text-gray-600">
                    UID: {selectedUser.bloodstrike_uid}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <p className="text-[10px] text-gray-600">
                        CURRENT GOLD
                      </p>

                      <p className="mt-1 font-black text-yellow-400">
                        {selectedUser.gold_balance.toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <p className="text-[10px] text-gray-600">
                        POINTS
                      </p>

                      <p className="mt-1 font-black">
                        {selectedUser.points.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedUser.is_suspended && (
                  <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-xs leading-5 text-red-400">
                    This account is suspended. Gold rewards are
                    disabled for this user.
                  </div>
                )}

                <div className="mt-5">
                  <label className="text-xs font-bold text-gray-400">
                    GOLD AMOUNT
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value)
                    }
                    placeholder="Enter Gold amount"
                    disabled={selectedUser.is_suspended}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-yellow-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold text-gray-400">
                    REASON / DESCRIPTION
                  </label>

                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    rows={3}
                    disabled={selectedUser.is_suspended}
                    className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-yellow-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Why is this user receiving Gold?"
                  />
                </div>

                <button
                  type="button"
                  onClick={rewardUser}
                  disabled={
                    loading ||
                    selectedUser.is_suspended
                  }
                  className="mt-5 w-full rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? 'Sending Gold...'
                    : `Reward ${
                        amount
                          ? Number(amount).toLocaleString()
                          : '0'
                      } Gold`}
                </button>

                <p className="mt-3 text-center text-[11px] leading-5 text-gray-600">
                  Gold is deducted from the Admin Wallet and
                  recorded in the user's wallet transaction history.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}