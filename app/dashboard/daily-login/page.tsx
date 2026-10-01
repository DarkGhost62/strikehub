'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Reward = {
  streak_day: number
  reward_gold: number
  is_active: boolean
}

type DayStatus = 'claimed' | 'completed' | 'current' | 'next' | 'locked'

type Claim = {
  id: string
  claim_date: string
  streak_day: number
  reward_gold: number
  claimed_at: string
}

export default function DailyLoginPage() {
  const supabase = createClient()

  const [rewards, setRewards] = useState<Reward[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function getNigeriaDate() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  }

  function getDateOffset(days: number) {
    const parts = getNigeriaDate().split('-').map(Number)

    const date = new Date(
      Date.UTC(parts[0], parts[1] - 1, parts[2])
    )

    date.setUTCDate(date.getUTCDate() + days)

    return date.toISOString().slice(0, 10)
  }

  async function loadData() {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const [rewardResult, claimResult] = await Promise.all([
      supabase
        .from('daily_login_rewards')
        .select('streak_day, reward_gold, is_active')
        .eq('is_active', true)
        .order('streak_day', { ascending: true }),

      supabase
        .from('daily_login_claims')
        .select(
          'id, claim_date, streak_day, reward_gold, claimed_at'
        )
        .eq('user_id', user.id)
        .order('claim_date', { ascending: false })
        .limit(30),
    ])

    if (rewardResult.error) {
      setError(
        `Could not load rewards: ${rewardResult.error.message}`
      )
      setLoading(false)
      return
    }

    if (claimResult.error) {
      setError(
        `Could not load claim history: ${claimResult.error.message}`
      )
      setLoading(false)
      return
    }

    setRewards((rewardResult.data ?? []) as Reward[])
    setClaims((claimResult.data ?? []) as Claim[])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const today = getNigeriaDate()

  const todayClaim = useMemo(
    () => claims.find((claim) => claim.claim_date === today),
    [claims, today]
  )

  const claimedDates = useMemo(
    () => new Set(claims.map((claim) => claim.claim_date)),
    [claims]
  )

  const currentStreak = useMemo(() => {
    if (claims.length === 0) return 0

    const claimDates = new Set(claims.map((claim) => claim.claim_date))
    let cursor = claimedDates.has(today) ? today : getDateOffset(-1)

    if (!claimDates.has(cursor)) return 0

    let streak = 0

    while (claimDates.has(cursor)) {
      streak += 1
      cursor = getDateOffset(-(streak + (claimedDates.has(today) ? 0 : 1)))
    }

    return streak
  }, [claims, claimedDates, today])

  const currentCycleDay = currentStreak > 0
    ? ((currentStreak - 1) % 7) + 1
    : 0

  const nextDay = todayClaim
    ? (todayClaim.streak_day % 7) + 1
    : currentStreak > 0
      ? (currentStreak % 7) + 1
      : 1

  const currentReward = rewards.find(
    (reward) => reward.streak_day === nextDay
  )

  async function claimReward() {
    if (claiming || todayClaim) return

    setClaiming(true)
    setMessage('')
    setError('')

    const { data, error: claimError } =
      await supabase.rpc('claim_daily_login')

    if (claimError) {
      setError(claimError.message)
      setClaiming(false)
      return
    }

    if (!data?.success) {
      setError(
        data?.message ||
          'You cannot claim the daily reward right now.'
      )
      setClaiming(false)
      await loadData()
      return
    }

    setMessage(
      data.message ||
        `You received ${data.reward_gold} Gold!`
    )

    setClaiming(false)

    await loadData()
  }

  function formatClaimDate(value: string) {
    const date = new Date(`${value}T00:00:00`)

    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  function getDayStatus(day: number): DayStatus {
    if (todayClaim) {
      if (day === todayClaim.streak_day) return 'claimed'
      if (day < todayClaim.streak_day) return 'completed'
      return 'locked'
    }

    if (currentStreak === 0) {
      return day === 1 ? 'current' : 'locked'
    }

    if (day < nextDay) return 'completed'
    if (day === nextDay) return 'current'
    return 'locked'
  }

  return (
    <main className="min-h-screen pb-24 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        {/* HEADER */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-gray-500 transition hover:text-white"
          >
            ← Back to Dashboard
          </Link>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                REWARDS
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Daily Login
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                Log in every day, maintain your streak, and earn
                Gold rewards.
              </p>
            </div>

            {/* STREAK */}
            <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400">
                CURRENT STREAK
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                <span className="text-3xl font-black">
                  {currentStreak}
                </span>
                <span className="text-xs font-bold text-gray-500">
                  {currentStreak === 1 ? 'day' : 'days'}
                </span>
                <span className="text-[10px] font-bold text-gray-600">
                  overall
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* HERO */}
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-950/60 via-[#13090d] to-[#0b090c] p-6 shadow-2xl shadow-red-950/20 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-600/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">

            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-3xl">
                  🎁
                </div>

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
                    7 DAY REWARD
                  </p>

                  <h2 className="text-2xl font-black">
                    Keep showing up.
                  </h2>
                </div>
              </div>

              <p className="max-w-xl text-sm leading-6 text-gray-400">
                Your rewards get better as your login streak
                continues. Complete all seven days to finish the
                cycle. After Day 7, the rewards repeat from Day 1
                while your overall streak keeps growing.
              </p>

              {message && (
                <div className="mt-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-bold text-green-400">
                  ✓ {message}
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
                  {error}
                </div>
              )}
            </div>

            <div className="min-w-[230px] rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">
                {todayClaim ? 'TODAY CLAIMED' : 'TODAY AVAILABLE'}
              </p>

              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-black text-yellow-400">
                  {todayClaim
                    ? todayClaim.reward_gold
                    : currentReward?.reward_gold ?? 0}
                </span>

                <span className="pb-1 text-sm font-black text-yellow-500">
                  GOLD
                </span>
              </div>

              <p className="mt-2 text-xs text-gray-600">
                {todayClaim
                  ? `Day ${todayClaim.streak_day} reward claimed`
                  : `Day ${nextDay} reward`}
              </p>

              <button
                type="button"
                disabled={claiming || !!todayClaim || loading}
                onClick={claimReward}
                className={`mt-5 w-full rounded-xl px-5 py-3 text-sm font-black transition ${
                  todayClaim
                    ? 'cursor-not-allowed border border-white/10 bg-white/[0.04] text-gray-600'
                    : claiming
                      ? 'cursor-wait bg-red-700 text-white'
                      : 'bg-red-600 text-white shadow-lg shadow-red-950/40 hover:bg-red-500'
                }`}
              >
                {claiming
                  ? 'Claiming...'
                  : todayClaim
                    ? '✓ Already Claimed'
                    : 'Claim Reward'}
              </button>
            </div>
          </div>
        </section>

        {/* 7 DAYS */}
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
                REWARD TRACK
              </p>

              <h2 className="mt-1 text-xl font-black">
                Your 7-Day Journey
              </h2>
            </div>

            <span className="text-xs font-bold text-gray-600">
              Day {todayClaim ? todayClaim.streak_day : nextDay} of 7
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, index) => {
                const day = index + 1
                const reward = rewards.find(
                  (item) => item.streak_day === day
                )

                const status = getDayStatus(day)

                return (
                  <div
                    key={day}
                    className={`relative overflow-hidden rounded-2xl border p-4 transition ${
                      status === 'claimed'
                        ? 'border-green-500/30 bg-green-500/[0.07]'
                        : status === 'current'
                          ? 'border-red-500/40 bg-red-500/[0.08] shadow-lg shadow-red-950/20'
                          : status === 'next'
                            ? 'border-yellow-500/20 bg-yellow-500/[0.04]'
                            : 'border-white/8 bg-white/[0.025]'
                    }`}
                  >
                    {status === 'current' && (
                      <div className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-white">
                        Today
                      </div>
                    )}

                    {status === 'claimed' && (
                      <div className="absolute right-2 top-2 text-sm text-green-400">
                        ✓
                      </div>
                    )}

                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">
                      DAY {day}
                    </p>

                    <div className="mt-5 text-3xl">
                      {status === 'claimed'
                        ? '✅'
                        : status === 'locked'
                          ? '🔒'
                          : day === 7
                            ? '🏆'
                            : '🎁'}
                    </div>

                    <div className="mt-4">
                      <span
                        className={`text-xl font-black ${
                          status === 'locked'
                            ? 'text-gray-700'
                            : status === 'claimed'
                              ? 'text-green-400'
                              : 'text-yellow-400'
                        }`}
                      >
                        {reward?.reward_gold ?? 0}
                      </span>

                      <span className="ml-1 text-[9px] font-black uppercase text-gray-600">
                        Gold
                      </span>
                    </div>

                    <p className="mt-2 text-[9px] font-bold text-gray-600">
                      {status === 'claimed'
                        ? 'Claimed'
                        : status === 'current'
                          ? 'Available now'
                          : status === 'next'
                            ? 'Next reward'
                            : status === 'locked'
                              ? 'Keep your streak'
                              : 'Completed'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* INFO */}
        <section className="grid gap-4 lg:grid-cols-3">

          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <div className="text-2xl">🔥</div>

            <h3 className="mt-4 font-black">
              Build Your Streak
            </h3>

            <p className="mt-2 text-xs leading-5 text-gray-600">
              Claim your reward every day to move through the
              seven-day reward track.
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <div className="text-2xl">🪙</div>

            <h3 className="mt-4 font-black">
              Earn Gold
            </h3>

            <p className="mt-2 text-xs leading-5 text-gray-600">
              Daily Login Gold is added directly to your
              STRIKEHUB wallet after a successful claim.
            </p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
            <div className="text-2xl">⚡</div>

            <h3 className="mt-4 font-black">
              Don't Miss a Day
            </h3>

            <p className="mt-2 text-xs leading-5 text-gray-600">
              Missing a day breaks your current streak. Keep
              logging in to reach the bigger rewards.
            </p>
          </div>

        </section>

        {/* CLAIM HISTORY */}
        <section className="mt-8 rounded-2xl border border-white/8 bg-white/[0.025] p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              HISTORY
            </p>

            <h2 className="mt-1 text-xl font-black">
              Recent Claims
            </h2>
          </div>

          {claims.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-black/10 px-5 py-10 text-center">
              <div className="text-3xl">🎁</div>

              <p className="mt-3 text-sm font-bold text-gray-400">
                No rewards claimed yet
              </p>

              <p className="mt-1 text-xs text-gray-600">
                Claim your first Daily Login reward above.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {claims.slice(0, 10).map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-black/10 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-sm">
                      ✓
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-black">
                        Day {claim.streak_day} Reward
                      </p>

                      <p className="mt-1 text-[10px] text-gray-600">
                        {formatClaimDate(claim.claim_date)}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-yellow-400">
                      +{claim.reward_gold}
                    </p>

                    <p className="text-[8px] font-bold uppercase text-gray-700">
                      Gold
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}