'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type ReferralStatus = 'pending' | 'approved' | 'rejected'

type Referral = {
  id: string
  referrer_id: string
  referred_user_id: string
  referral_code: string
  status: ReferralStatus
  reward_gold: number
  created_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  rewarded_at: string | null
}

type Profile = {
  id: string
  display_name: string | null
  in_game_name: string | null
  bloodstrike_uid?: string | null
}

type Filter = 'all' | ReferralStatus

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusClasses(status: ReferralStatus) {
  if (status === 'approved') {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  }

  if (status === 'rejected') {
    return 'border-red-500/20 bg-red-500/10 text-red-400'
  }

  return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
}

export default function AdminReferralsPage() {
  const supabase = createClient()

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function checkAdmin() {
    const { data, error: adminError } = await supabase.rpc('is_admin')

    if (adminError || !data) {
      window.location.href = '/dashboard'
      return false
    }

    return true
  }

  async function loadData(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const allowed = await checkAdmin()
      if (!allowed) return

      const { data, error: referralError } = await supabase
        .from('referral_records')
        .select(
          'id, referrer_id, referred_user_id, referral_code, status, reward_gold, created_at, reviewed_at, rejection_reason, rewarded_at'
        )
        .order('created_at', { ascending: false })

      if (referralError) {
        throw new Error(referralError.message)
      }

      const rows = (data ?? []) as Referral[]
      setReferrals(rows)

      const ids = Array.from(
        new Set(
          rows.flatMap((item) => [item.referrer_id, item.referred_user_id])
        )
      )

      if (ids.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, in_game_name, bloodstrike_uid')
          .in('id', ids)

        if (profileError) {
          throw new Error(profileError.message)
        }

        const map: Record<string, Profile> = {}
        for (const item of (profileRows ?? []) as Profile[]) {
          map[item.id] = item
        }
        setProfiles(map)
      } else {
        setProfiles({})
      }
    } catch (err) {
      console.error('ADMIN REFERRALS LOAD ERROR:', err)
      setError(
        err instanceof Error ? err.message : 'Unable to load referrals.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function approveReferral(id: string) {
    setBusyId(id)
    setError('')
    setSuccess('')

    try {
      const { error: rpcError } = await supabase.rpc(
        'admin_approve_referral',
        { p_referral_id: id }
      )

      if (rpcError) {
        throw new Error(rpcError.message)
      }

      setSuccess('Referral approved and 10 Gold has been paid to the referrer.')
      await loadData(true)
    } catch (err) {
      console.error('ADMIN APPROVE REFERRAL ERROR:', err)
      setError(
        err instanceof Error ? err.message : 'Unable to approve referral.'
      )
    } finally {
      setBusyId(null)
    }
  }

  async function rejectReferral(id: string) {
    const reason = window.prompt(
      'Optional rejection reason (leave blank if you do not want to add one):'
    )

    if (reason === null) return

    setBusyId(id)
    setError('')
    setSuccess('')

    try {
      const { error: rpcError } = await supabase.rpc(
        'admin_reject_referral',
        {
          p_referral_id: id,
          p_reason: reason.trim() || null,
        }
      )

      if (rpcError) {
        throw new Error(rpcError.message)
      }

      setSuccess('Referral rejected.')
      await loadData(true)
    } catch (err) {
      console.error('ADMIN REJECT REFERRAL ERROR:', err)
      setError(
        err instanceof Error ? err.message : 'Unable to reject referral.'
      )
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return referrals.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false

      if (!needle) return true

      const referrer = profiles[item.referrer_id]
      const referred = profiles[item.referred_user_id]

      const haystack = [
        item.referral_code,
        item.status,
        referrer?.display_name,
        referrer?.in_game_name,
        referrer?.bloodstrike_uid,
        referred?.display_name,
        referred?.in_game_name,
        referred?.bloodstrike_uid,
        item.referred_user_id,
        item.referrer_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [filter, profiles, referrals, search])

  const total = referrals.length
  const pending = referrals.filter((item) => item.status === 'pending').length
  const approved = referrals.filter((item) => item.status === 'approved').length
  const rejected = referrals.filter((item) => item.status === 'rejected').length
  const goldPaid = referrals
    .filter((item) => item.status === 'approved')
    .reduce((sum, item) => sum + Number(item.reward_gold || 0), 0)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-5 text-white">
        <div className="text-center">
          <div className="text-4xl">👥</div>
          <p className="mt-4 text-sm font-bold text-gray-400">
            Loading referrals...
          </p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/admin"
            className="text-xs font-bold text-red-400 transition hover:text-red-300"
          >
            ← Back to Admin
          </Link>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-black text-white transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB ADMIN
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            Referrals
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500">
            Review player referrals, approve eligible referrals, reject
            suspicious referrals, and manage referral rewards.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-bold text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm font-bold text-emerald-400">
            ✓ {success}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Total Referrals', total, 'text-white'],
            ['Pending', pending, 'text-yellow-400'],
            ['Approved', approved, 'text-emerald-400'],
            ['Rejected', rejected, 'text-red-400'],
          ].map(([label, value, color]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-white/10 bg-[#0e0d10] p-6"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-600">
                {label}
              </p>
              <p className={`mt-3 text-3xl font-black ${color}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-yellow-500/10 bg-yellow-500/[0.03] p-6">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-500">
            Gold Paid
          </p>
          <p className="mt-2 text-3xl font-black text-yellow-400">
            {goldPaid.toLocaleString('en-NG')} Gold
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b0a0d] p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search player, UID, email or referral code..."
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-gray-700 focus:border-red-500/40 lg:max-w-xl"
            />

            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as Filter[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-wider transition ${
                      filter === item
                        ? 'border-red-500/40 bg-red-500/10 text-red-400'
                        : 'border-white/10 bg-white/[0.02] text-gray-500 hover:bg-white/[0.05]'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-16 text-center">
                <div className="text-4xl">👥</div>
                <p className="mt-4 font-black text-white">
                  No referrals found.
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Try changing the search or status filter.
                </p>
              </div>
            ) : (
              filtered.map((item) => {
                const referrer = profiles[item.referrer_id]
                const referred = profiles[item.referred_user_id]

                const referrerName =
                  referrer?.in_game_name ||
                  referrer?.display_name ||
                  `Player ${item.referrer_id.slice(0, 8)}`

                const referredName =
                  referred?.in_game_name ||
                  referred?.display_name ||
                  `Player ${item.referred_user_id.slice(0, 8)}`

                const isBusy = busyId === item.id

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-black/40 p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusClasses(item.status)}`}
                          >
                            {item.status}
                          </span>
                          <span className="text-xs text-gray-600">
                            {formatDate(item.created_at)}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-5 md:grid-cols-2">
                          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                              Referrer
                            </p>
                            <p className="mt-2 font-black text-white">
                              {referrerName}
                            </p>
                            {referrer?.bloodstrike_uid && (
                              <p className="mt-1 text-xs text-gray-500">
                                UID: {referrer.bloodstrike_uid}
                              </p>
                            )}
                            <p className="mt-1 break-all text-xs text-gray-600">
                              Code: {item.referral_code}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                              Referred Player
                            </p>
                            <p className="mt-2 font-black text-white">
                              {referredName}
                            </p>
                            {referred?.bloodstrike_uid && (
                              <p className="mt-1 text-xs text-gray-500">
                                UID: {referred.bloodstrike_uid}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600">
                          <span>Reward: {Number(item.reward_gold || 0)} Gold</span>
                          {item.reviewed_at && (
                            <span>Reviewed: {formatDate(item.reviewed_at)}</span>
                          )}
                          {item.rewarded_at && (
                            <span>Paid: {formatDate(item.rewarded_at)}</span>
                          )}
                        </div>

                        {item.rejection_reason && (
                          <div className="mt-4 rounded-xl border border-red-500/10 bg-red-500/[0.04] p-3 text-xs text-red-300">
                            Rejection reason: {item.rejection_reason}
                          </div>
                        )}
                      </div>

                      {item.status === 'pending' && (
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col">
                          <button
                            type="button"
                            onClick={() => approveReferral(item.id)}
                            disabled={isBusy}
                            className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy ? 'Processing...' : 'Approve +10 Gold'}
                          </button>

                          <button
                            type="button"
                            onClick={() => rejectReferral(item.id)}
                            disabled={isBusy}
                            className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-3 text-xs font-black text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
