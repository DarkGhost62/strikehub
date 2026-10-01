'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  display_name: string | null
  in_game_name: string | null
}

type Referral = {
  id: string
  referrer_id: string
  referred_user_id: string
  referral_code: string
  status: 'pending' | 'approved' | 'rejected'
  reward_gold: number
  created_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  rewarded_at: string | null
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function statusClasses(status: Referral['status']) {
  if (status === 'approved') {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  }

  if (status === 'rejected') {
    return 'border-red-500/20 bg-red-500/10 text-red-400'
  }

  return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
}

export default function ReferralsPage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [referredProfiles, setReferredProfiles] = useState<
    Record<string, Profile>
  >({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function loadData(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const [{ data: profileData, error: profileError }, { data, error: referralError }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, in_game_name')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('referral_records')
            .select(
              'id, referrer_id, referred_user_id, referral_code, status, reward_gold, created_at, reviewed_at, rejection_reason, rewarded_at'
            )
            .eq('referrer_id', user.id)
            .order('created_at', { ascending: false }),
        ])

      if (profileError) {
        throw new Error(profileError.message)
      }

      if (referralError) {
        throw new Error(referralError.message)
      }

      const referralRows = (data ?? []) as Referral[]
      setProfile(profileData as Profile | null)
      setReferrals(referralRows)

      const ids = Array.from(
        new Set(referralRows.map((item) => item.referred_user_id))
      )

      if (ids.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, in_game_name')
          .in('id', ids)

        if (profilesError) {
          throw new Error(profilesError.message)
        }

        const profileMap: Record<string, Profile> = {}
        for (const item of (profilesData ?? []) as Profile[]) {
          profileMap[item.id] = item
        }
        setReferredProfiles(profileMap)
      } else {
        setReferredProfiles({})
      }
    } catch (err) {
      console.error('PLAYER REFERRALS LOAD ERROR:', err)
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

  const referralCode = profile?.display_name || 'STRIKEHUB'

  const inviteLink = useMemo(() => {
    if (typeof window === 'undefined') {
      return `/register?ref=${encodeURIComponent(referralCode)}`
    }

    return `${window.location.origin}/register?ref=${encodeURIComponent(referralCode)}`
  }, [referralCode])

  async function copyText(value: string, type: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(type)
      window.setTimeout(() => setCopied(''), 1800)
    } catch {
      setError('Unable to copy. Please copy the text manually.')
    }
  }

  async function shareInvite() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join STRIKEHUB',
          text: 'Join me on STRIKEHUB. Use my invite link to register.',
          url: inviteLink,
        })
      } catch {
        // User cancelled sharing.
      }
      return
    }

    await copyText(inviteLink, 'link')
  }

  const total = referrals.length
  const pending = referrals.filter((item) => item.status === 'pending').length
  const approved = referrals.filter((item) => item.status === 'approved').length
  const rejected = referrals.filter((item) => item.status === 'rejected').length
  const goldEarned = referrals
    .filter((item) => item.status === 'approved')
    .reduce((sum, item) => sum + Number(item.reward_gold || 0), 0)

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5">
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
    <div className="min-h-screen">
      <section className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-xs font-bold text-red-400 transition hover:text-red-300"
          >
            ← Back to Dashboard
          </Link>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-black text-white transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB REFERRALS
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            Referrals
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
            Invite players to STRIKEHUB and earn 10 Gold for every approved
            referral.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-bold text-red-400">
            {error}
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
              className="rounded-2xl border border-white/10 bg-[#0e0d10]/90 p-5"
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

        <div className="mt-4 rounded-2xl border border-yellow-500/10 bg-yellow-500/[0.03] p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-500">
            Gold Earned
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {goldEarned.toLocaleString('en-NG')} Gold
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Paid only after admin approval.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl border border-red-500/20 bg-[#0e0d10]/90 p-7 lg:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-600">
              Your Referral Code
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                <p className="break-all text-xl font-black tracking-wide text-white sm:text-2xl">
                  {referralCode}
                </p>
              </div>

              <button
                type="button"
                onClick={() => copyText(referralCode, 'code')}
                className="shrink-0 rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-xs font-black text-red-400 transition hover:bg-red-500/20"
              >
                {copied === 'code' ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-500">
              Copy your code and share it with new STRIKEHUB players.
            </p>

            <div className="mt-6 rounded-2xl border border-yellow-500/10 bg-yellow-500/[0.03] p-5">
              <p className="text-xs font-bold text-yellow-400">
                Referral Reward
              </p>
              <p className="mt-2 text-2xl font-black text-white">10 Gold</p>
              <p className="mt-1 text-xs text-gray-600">
                Per approved referral
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-7">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-2xl">
              👥
            </div>

            <h2 className="mt-6 text-xl font-black">Invite Players</h2>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Send your personal invite link. New players who register through
              it will have your referral code automatically attached.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                Invite Link
              </p>
              <p className="mt-2 break-all text-xs leading-5 text-gray-400">
                {inviteLink}
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => copyText(inviteLink, 'link')}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-black text-white transition hover:bg-white/[0.06]"
              >
                {copied === 'link' ? '✓ Link Copied' : 'Copy Invite Link'}
              </button>

              <button
                type="button"
                onClick={shareInvite}
                className="rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white transition hover:bg-red-500"
              >
                Share Invite
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
                YOUR REFERRALS
              </p>
              <h2 className="mt-2 text-2xl font-black">Referral History</h2>
            </div>
            <p className="text-xs text-gray-600">
              {total} {total === 1 ? 'referral' : 'referrals'}
            </p>
          </div>

          {referrals.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center">
              <div className="text-4xl">👥</div>
              <p className="mt-4 font-black text-white">No referrals yet.</p>
              <p className="mt-2 text-sm text-gray-600">
                Share your invite link and your referrals will appear here.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {referrals.map((item) => {
                const referred = referredProfiles[item.referred_user_id]
                const name =
                  referred?.in_game_name ||
                  referred?.display_name ||
                  `Player ${item.referred_user_id.slice(0, 8)}`

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-black text-white">{name}</p>
                        <p className="mt-1 text-xs text-gray-600">
                          Joined with code {item.referral_code} •{' '}
                          {formatDate(item.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusClasses(item.status)}`}
                        >
                          {item.status}
                        </span>
                        <span className="text-sm font-black text-yellow-400">
                          {Number(item.reward_gold || 0)} Gold
                        </span>
                      </div>
                    </div>

                    {item.status === 'rejected' && item.rejection_reason && (
                      <div className="mt-4 rounded-xl border border-red-500/10 bg-red-500/[0.04] p-3 text-xs text-red-300">
                        Reason: {item.rejection_reason}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
            HOW IT WORKS
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <p className="text-lg font-black">01</p>
              <h3 className="mt-3 font-black">Share your link</h3>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Copy or share your personal STRIKEHUB invite link.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <p className="text-lg font-black">02</p>
              <h3 className="mt-3 font-black">They register</h3>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Their account is automatically linked to your referral code.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <p className="text-lg font-black">03</p>
              <h3 className="mt-3 font-black">Earn Gold</h3>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Admin reviews the referral and pays 10 Gold when approved.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
