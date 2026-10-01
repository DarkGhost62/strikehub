'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Tournament = {
  id: string
  name: string
  image_url: string | null
  timezone: string
  description: string | null
  tournament_type: string
  game_mode: string
  map: string
  device_restriction: string
  prize_gold: number
  max_players: number | null
  max_teams: number | null
  players_per_team: number | null
  registration_open: boolean
  starts_at: string
  registration_deadline: string | null
  rules: string | null
  status: string
}

export default function TournamentsPage() {
  const supabase = createClient()

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  async function loadTournaments() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('tournaments')
      .select('*')
      .in('status', ['draft', 'upcoming', 'live', 'completed'])
      .order('starts_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setTournaments([])
    } else {
      setTournaments((data || []) as Tournament[])
    }

    setLoading(false)
  }

  async function checkAuth() {
    setAuthLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    setIsLoggedIn(Boolean(user))
    setAuthLoading(false)
  }

  useEffect(() => {
    loadTournaments()
    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  function formatDate(date: string, timezone: string) {
    try {
      return new Date(date).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone || 'Africa/Lagos',
      })
    } catch {
      return new Date(date).toLocaleString()
    }
  }

  function formatType(value: string) {
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  function formatDevice(value: string) {
    if (value === 'mobile') return 'Mobile Only'
    if (value === 'pc') return 'PC Only'
    if (value === 'both') return 'Mobile & PC'
    return value
  }

  function getStatusClass(status: string) {
    if (status === 'live') {
      return 'bg-red-600 text-white'
    }

    if (status === 'upcoming') {
      return 'bg-green-500/10 text-green-400'
    }

    if (status === 'completed') {
      return 'bg-white/10 text-gray-400'
    }

    if (status === 'cancelled') {
      return 'bg-red-500/10 text-red-400'
    }

    return 'bg-yellow-500/10 text-yellow-400'
  }

  const filteredTournaments =
    filter === 'all'
      ? tournaments
      : tournaments.filter(
          (tournament) => tournament.status === filter
        )

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-red-900/30 bg-[#080808]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="group">
            <p className="text-xs font-bold tracking-[0.35em] text-red-500">
              STRIKEHUB
            </p>

            <p className="text-xs font-semibold text-gray-500">
              COMPETE. EARN. RISE.
            </p>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {authLoading ? (
              <div className="h-10 w-24 animate-pulse rounded-lg border border-white/10 bg-white/5" />
            ) : isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
                >
                  Dashboard
                </Link>

                <Link
                  href="/dashboard/tournaments"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold transition hover:bg-red-500"
                >
                  My Tournaments
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
                >
                  Login
                </Link>

                <Link
                  href="/register"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold transition hover:bg-red-500"
                >
                  Join Now
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-white/5 bg-gradient-to-b from-red-950/20 to-transparent">
        <div className="mx-auto max-w-7xl px-5 py-12 md:py-16">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB COMPETITIONS
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
            TOURNAMENTS
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-400 md:text-lg">
            Enter the battlefield, compete against other
            players, earn Gold, and rise through the
            STRIKEHUB leaderboard.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-5 py-8 md:py-10">
        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-2">
          {[
            ['all', 'All'],
            ['live', 'Live'],
            ['upcoming', 'Upcoming'],
            ['completed', 'Completed'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={
                filter === value
                  ? 'rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold'
                  : 'rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-gray-400 transition hover:bg-white/10 hover:text-white'
              }
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#101010] p-12 text-center">
            <div className="text-4xl">🏆</div>

            <p className="mt-4 font-bold">
              Loading tournaments...
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Getting the latest STRIKEHUB competitions.
            </p>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#101010] p-12 text-center">
            <div className="text-5xl">🏆</div>

            <h2 className="mt-5 text-2xl font-black">
              No Tournaments Found
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              There are currently no tournaments matching
              this filter. Check back soon for the next
              STRIKEHUB competition.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredTournaments.map((tournament) => (
              <article
                key={tournament.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-[#101010] transition hover:-translate-y-1 hover:border-red-900/50"
              >
                {/* Image */}
                <div className="relative h-52 overflow-hidden bg-[#080808]">
                  {tournament.image_url ? (
                    <img
                      src={tournament.image_url}
                      alt={tournament.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-red-950/30 to-[#080808]">
                      <div className="text-6xl">🏆</div>
                    </div>
                  )}

                  {/* Status */}
                  <div className="absolute left-4 top-4">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ${getStatusClass(
                        tournament.status
                      )}`}
                    >
                      {tournament.status}
                    </span>
                  </div>

                  {/* Prize */}
                  <div className="absolute right-4 top-4 rounded-full border border-yellow-500/20 bg-black/70 px-3 py-1.5 text-xs font-black text-yellow-400 backdrop-blur">
                    🪙{' '}
                    {Number(
                      tournament.prize_gold
                    ).toLocaleString()}{' '}
                    Gold
                  </div>
                </div>

                {/* Details */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-black">
                        {tournament.name}
                      </h2>

                      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-red-400">
                        {tournament.game_mode}
                      </p>
                    </div>
                  </div>

                  {tournament.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">
                      {tournament.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <p className="text-xs text-gray-600">
                        MAP
                      </p>

                      <p className="mt-1 truncate text-sm font-bold text-gray-300">
                        {tournament.map}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <p className="text-xs text-gray-600">
                        DEVICE
                      </p>

                      <p className="mt-1 truncate text-sm font-bold text-gray-300">
                        {formatDevice(
                          tournament.device_restriction
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <p className="text-xs text-gray-600">
                        TYPE
                      </p>

                      <p className="mt-1 truncate text-sm font-bold text-gray-300">
                        {formatType(
                          tournament.tournament_type
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <p className="text-xs text-gray-600">
                        STARTS
                      </p>

                      <p className="mt-1 text-sm font-bold text-gray-300">
                        {formatDate(
                          tournament.starts_at,
                          tournament.timezone
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
                    {tournament.max_players && (
                      <span>
                        👤 Max Players:{' '}
                        {tournament.max_players}
                      </span>
                    )}

                    {tournament.max_teams && (
                      <span>
                        👥 Max Teams:{' '}
                        {tournament.max_teams}
                      </span>
                    )}

                    {tournament.players_per_team && (
                      <span>
                        👥 Players/Team:{' '}
                        {tournament.players_per_team}
                      </span>
                    )}
                  </div>

                  {/* Registration */}
                  <div className="mt-5 border-t border-white/10 pt-5">
                    {tournament.registration_open &&
                    tournament.status !== 'completed' &&
                    tournament.status !== 'cancelled' ? (
                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="block w-full rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-black transition hover:bg-red-500"
                      >
                        View Tournament & Register
                      </Link>
                    ) : (
                      <Link
                        href={`/tournaments/${tournament.id}`}
                        className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-gray-300 transition hover:bg-white/10"
                      >
                        View Tournament
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-white/10 bg-[#090909]">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black tracking-[0.2em] text-red-500">
                STRIKEHUB
              </p>

              <p className="mt-1 text-xs text-gray-600">
                COMPETE. EARN. RISE.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <Link
                href="/"
                className="transition hover:text-white"
              >
                Home
              </Link>

              <Link
                href="/terms"
                className="transition hover:text-white"
              >
                Terms
              </Link>

              {!authLoading && !isLoggedIn && (
                <>
                  <Link
                    href="/login"
                    className="transition hover:text-white"
                  >
                    Login
                  </Link>

                  <Link
                    href="/register"
                    className="transition hover:text-white"
                  >
                    Register
                  </Link>
                </>
              )}

              {isLoggedIn && (
                <Link
                  href="/dashboard"
                  className="transition hover:text-white"
                >
                  Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}