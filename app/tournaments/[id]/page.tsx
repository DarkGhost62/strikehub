'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
  stream_url: string | null
}

type PublicTournamentResult = {
  placement: number | null
  kills: number
  points_awarded: number
  gold_awarded: number
  reward_paid: boolean
  player_name: string
}


type RegistrationResult = {
  success: boolean
  registration_id: string
  tournament_id: string
  user_id: string
  device: string
  status: string
}

type ExistingRegistration = {
  id: string
  device: string
  status: string
  registered_at: string
}

export default function TournamentDetailsPage() {
  const params = useParams()
  const router = useRouter()

  const tournamentId = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [publicResults, setPublicResults] = useState<PublicTournamentResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [userId, setUserId] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [device, setDevice] = useState('mobile')
  const [registering, setRegistering] = useState(false)

  const [registrationSuccess, setRegistrationSuccess] =
    useState<RegistrationResult | null>(null)

  const [existingRegistration, setExistingRegistration] =
    useState<ExistingRegistration | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      if (!tournamentId) return

      setLoading(true)
      setError('')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (cancelled) return

      setUserId(user?.id ?? null)
      setCheckingAuth(false)

      const {
        data: tournamentData,
        error: tournamentError,
      } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .maybeSingle()

      if (cancelled) return

      if (tournamentError) {
        setError(tournamentError.message)
        setTournament(null)
        setLoading(false)
        return
      }

      if (!tournamentData) {
        setError('Tournament not found.')
        setTournament(null)
        setLoading(false)
        return
      }

      setTournament(tournamentData as Tournament)

      if (tournamentData.device_restriction === 'pc') {
        setDevice('pc')
      } else {
        setDevice('mobile')
      }

      if (user?.id) {
        const { data: registrationData } =
          await supabase
            .from('tournament_registrations')
            .select(
              'id, device, status, registered_at'
            )
            .eq('tournament_id', tournamentId)
            .eq('user_id', user.id)
            .eq('status', 'registered')
            .maybeSingle()

        if (!cancelled && registrationData) {
          setExistingRegistration(
            registrationData as ExistingRegistration
          )
        }
      }

      setLoading(false)
    }

    loadPage()

    return () => {
      cancelled = true
    }
  }, [tournamentId, supabase])

  async function handleRegister() {
    setError('')
    setRegistrationSuccess(null)

    if (!userId) {
      router.push(
        `/login?redirect=/tournaments/${tournamentId}`
      )
      return
    }

    if (!tournament) {
      setError(
        'Tournament information is unavailable.'
      )
      return
    }

    if (tournament.game_mode !== 'solo') {
      setError(
        'This tournament requires a team registration. Team registration will be handled from the team system.'
      )
      return
    }

    if (!tournament.registration_open) {
      setError(
        'Registration is currently closed.'
      )
      return
    }

    if (
      tournament.status !== 'upcoming' &&
      tournament.status !== 'live'
    ) {
      setError(
        'This tournament is not accepting registrations.'
      )
      return
    }

    if (existingRegistration) {
      setError(
        'You are already registered for this tournament.'
      )
      return
    }

    setRegistering(true)

    const {
      data,
      error: registrationError,
    } = await supabase.rpc(
      'register_solo_tournament',
      {
        p_tournament_id: tournament.id,
        p_device: device,
      }
    )

    setRegistering(false)

    if (registrationError) {
      setError(
        cleanSupabaseError(
          registrationError.message
        )
      )
      return
    }

    if (!data?.success) {
      setError(
        'Registration could not be completed.'
      )
      return
    }

    const result = data as RegistrationResult

    setRegistrationSuccess(result)

    setExistingRegistration({
      id: result.registration_id,
      device: result.device,
      status: result.status,
      registered_at: new Date().toISOString(),
    })
  }

  function formatDate(
    date: string,
    timezone: string
  ) {
    try {
      return new Date(date).toLocaleString(
        'en-NG',
        {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone:
            timezone || 'Africa/Lagos',
        }
      )
    } catch {
      return new Date(date).toLocaleString(
        'en-NG'
      )
    }
  }

  function formatType(value: string) {
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  }

  function formatGameMode(value: string) {
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  }

  function formatDevice(value: string) {
    if (value === 'mobile') {
      return 'Mobile Only'
    }

    if (value === 'pc') {
      return 'PC Only'
    }

    if (value === 'both') {
      return 'Mobile & PC'
    }

    return value
  }

  function statusClass(status: string) {
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


  useEffect(() => {
    if (!tournament?.id || tournament.status !== 'completed') {
      setPublicResults([])
      return
    }

    let cancelled = false

    const loadResults = async () => {
      setResultsLoading(true)

      const { data, error } = await supabase.rpc(
        'get_public_tournament_results',
        { p_tournament_id: tournament.id }
      )

      if (!cancelled) {
        if (error) {
          console.error('Failed to load tournament results:', error)
          setPublicResults([])
        } else {
          setPublicResults((data ?? []) as PublicTournamentResult[])
        }
        setResultsLoading(false)
      }
    }

    loadResults()

    return () => {
      cancelled = true
    }
  }, [tournament?.id, tournament?.status])

  const canRegister =
    !!tournament &&
    tournament.registration_open &&
    (tournament.status === 'upcoming' ||
      tournament.status === 'live') &&
    !existingRegistration

  if (loading || checkingAuth) {
    return (
      <main className="min-h-screen bg-[#070707] text-white">
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
          <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-red-600/10 blur-[120px]" />
          <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-orange-500/10 blur-[120px]" />

          <div className="relative text-center">
            <div className="text-5xl">🏆</div>

            <p className="mt-4 font-bold">
              Loading tournament...
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Please wait.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (error && !tournament) {
    return (
      <main className="min-h-screen bg-[#070707] text-white">
        <header className="border-b border-red-900/30 bg-[#080808]">
          <div className="mx-auto max-w-7xl px-5 py-5">
            <Link href="/tournaments">
              <p className="text-xs font-black tracking-[0.35em] text-red-500">
                STRIKEHUB
              </p>

              <p className="mt-1 text-xs text-gray-500">
                COMPETE. EARN. RISE.
              </p>
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <div className="text-6xl">🏆</div>

          <h1 className="mt-5 text-3xl font-black">
            Tournament Not Found
          </h1>

          <p className="mt-3 text-gray-500">
            {error}
          </p>

          <Link
            href="/tournaments"
            className="mt-7 inline-block rounded-xl bg-red-600 px-6 py-3 font-bold transition hover:bg-red-500"
          >
            Back to Tournaments
          </Link>
        </section>
      </main>
    )
  }

  if (!tournament) {
    return null
  }




  return (
    <main className="min-h-screen overflow-hidden bg-[#070707] text-white">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-red-700/10 blur-[150px]" />

        <div className="absolute right-[-200px] top-[30%] h-[600px] w-[600px] rounded-full bg-orange-500/5 blur-[170px]" />

        <div className="absolute bottom-[-250px] left-[35%] h-[500px] w-[500px] rounded-full bg-red-500/5 blur-[150px]" />

        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '45px 45px',
          }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080808]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/">
            <p className="text-lg font-black tracking-tight">
              STRIKE
              <span className="text-red-500">
                HUB
              </span>
            </p>

            <p className="text-[9px] font-bold tracking-[0.25em] text-gray-600">
              COMPETE. EARN. RISE.
            </p>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/tournaments"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold transition hover:bg-white/[0.08]"
            >
              Tournaments
            </Link>

            {userId ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold transition hover:bg-red-500"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href={`/login?redirect=/tournaments/${tournament.id}`}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-bold transition hover:bg-white/[0.08]"
                >
                  Login
                </Link>

                <Link
                  href="/register"
                  className="hidden rounded-xl bg-red-600 px-4 py-2 text-sm font-bold transition hover:bg-red-500 sm:block"
                >
                  Join Now
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative border-b border-white/5">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <Link
            href="/tournaments"
            className="text-sm font-semibold text-gray-500 transition hover:text-white"
          >
            ← Back to Tournaments
          </Link>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#101010] shadow-2xl shadow-black/40">
            <div className="relative h-64 bg-[#080808] sm:h-80 md:h-[460px]">
              {tournament.image_url ? (
                <img
                  src={tournament.image_url}
                  alt={tournament.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-red-950/40 via-[#10090b] to-[#080808]">
                  <span className="text-8xl">🏆</span>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ${statusClass(
                      tournament.status
                    )}`}
                  >
                    {tournament.status === 'live'
                      ? '● Live Now'
                      : tournament.status}
                  </span>

                  <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 text-xs font-black uppercase text-yellow-400">
                    {formatGameMode(
                      tournament.game_mode
                    )}
                  </span>

                  <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs font-bold text-gray-300 backdrop-blur">
                    {formatDevice(
                      tournament.device_restriction
                    )}
                  </span>
                </div>

                <h1 className="mt-4 max-w-5xl text-3xl font-black leading-tight sm:text-4xl md:text-6xl">
                  {tournament.name}
                </h1>

                {tournament.status === 'live' &&
                  tournament.stream_url?.trim() && (
                    <a
                      href={tournament.stream_url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black shadow-lg shadow-red-950/40 transition hover:bg-red-500"
                    >
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
                      WATCH LIVE
                    </a>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-y divide-white/10 border-t border-white/10 sm:grid-cols-4 sm:divide-y-0">
              <QuickStat
                label="PRIZE"
                value={
                  <>
                    🪙{' '}
                    {Number(
                      tournament.prize_gold
                    ).toLocaleString()}{' '}
                    Gold
                  </>
                }
                gold
              />

              <QuickStat
                label="MAP"
                value={
                  tournament.map || 'Map TBA'
                }
              />

              <QuickStat
                label="GAME MODE"
                value={formatGameMode(
                  tournament.game_mode
                )}
              />

              <QuickStat
                label="DEVICE"
                value={formatDevice(
                  tournament.device_restriction
                )}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <InfoCard title="About This Tournament">
              <p className="whitespace-pre-wrap text-sm leading-7 text-gray-400">
                {tournament.description ||
                  'No tournament description has been provided.'}
              </p>
            </InfoCard>

            <InfoCard title="Schedule">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                    START DATE & TIME
                  </p>

                  <p className="mt-2 font-bold text-gray-200">
                    {formatDate(
                      tournament.starts_at,
                      tournament.timezone
                    )}
                  </p>

                  <p className="mt-1 text-xs text-gray-600">
                    {tournament.timezone}
                  </p>
                </div>

                {tournament.registration_deadline && (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                      REGISTRATION DEADLINE
                    </p>

                    <p className="mt-2 font-bold text-gray-200">
                      {formatDate(
                        tournament.registration_deadline,
                        tournament.timezone
                      )}
                    </p>
                  </div>
                )}
              </div>
            </InfoCard>

            <InfoCard title="Tournament Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailBox
                  label="TOURNAMENT TYPE"
                  value={formatType(
                    tournament.tournament_type
                  )}
                />

                <DetailBox
                  label="GAME MODE"
                  value={formatGameMode(
                    tournament.game_mode
                  )}
                />

                <DetailBox
                  label="DEVICE"
                  value={formatDevice(
                    tournament.device_restriction
                  )}
                />

                {tournament.max_players !==
                  null && (
                  <DetailBox
                    label="MAXIMUM PLAYERS"
                    value={String(
                      tournament.max_players
                    )}
                  />
                )}

                {tournament.max_teams !==
                  null && (
                  <DetailBox
                    label="MAXIMUM TEAMS"
                    value={String(
                      tournament.max_teams
                    )}
                  />
                )}

                {tournament.players_per_team !==
                  null && (
                  <DetailBox
                    label="PLAYERS PER TEAM"
                    value={String(
                      tournament.players_per_team
                    )}
                  />
                )}
              </div>
            </InfoCard>

            <InfoCard title="Tournament Rules">
              {tournament.rules ? (
                <div className="whitespace-pre-wrap rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-sm leading-7 text-gray-400">
                  {tournament.rules}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No specific rules have been published
                  yet.
                </p>
              )}
            </InfoCard>
          </div>

          {/* Registration */}
          <aside>
            <div className="sticky top-24 rounded-3xl border border-red-500/20 bg-gradient-to-b from-[#16090c] to-[#0e0d10] p-6 shadow-2xl shadow-red-950/20">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                Registration
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Join This Tournament
              </h2>

              <div className="mt-6 rounded-2xl border border-yellow-500/15 bg-yellow-500/5 p-5 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  PRIZE POOL
                </p>

                <p className="mt-2 text-4xl font-black text-yellow-400">
                  {Number(
                    tournament.prize_gold
                  ).toLocaleString()}
                </p>

                <p className="text-sm font-black text-yellow-500/70">
                  GOLD
                </p>
              </div>

              {tournament.status === 'live' &&
                tournament.stream_url?.trim() && (
                  <a
                    href={tournament.stream_url.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-600/10 px-5 py-3 text-sm font-black text-red-400 transition hover:border-red-500/50 hover:bg-red-600/20 hover:text-red-300"
                  >
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    🔴 WATCH LIVE
                  </a>
                )}

              <div className="mt-5 space-y-3 text-sm">
                <InfoRow
                  label="Status"
                  value={
                    tournament.status === 'live'
                      ? 'Live Now'
                      : tournament.status
                  }
                />

                <InfoRow
                  label="Mode"
                  value={formatGameMode(
                    tournament.game_mode
                  )}
                />

                <InfoRow
                  label="Device"
                  value={formatDevice(
                    tournament.device_restriction
                  )}
                />
              </div>

              {error && (
                <div className="mt-5 rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm leading-6 text-red-400">
                  {error}
                </div>
              )}

              {/* IMPORTANT:
                  Only ONE registration state is shown at a time.
              */}

              {existingRegistration ? (
                <div className="mt-6 rounded-2xl border border-green-900/40 bg-green-950/20 p-5">
                  <div className="text-center">
                    <div className="text-4xl">
                      ✓
                    </div>

                    <h3 className="mt-3 text-lg font-black text-green-400">
                      {registrationSuccess
                        ? 'Registration Successful'
                        : 'You Are Registered'}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-gray-400">
                      {registrationSuccess
                        ? 'You are officially registered for this tournament.'
                        : 'You are already registered for this tournament.'}
                    </p>
                  </div>

                  <div className="mt-5 space-y-3 border-t border-green-900/30 pt-4 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-600">
                        Device
                      </span>

                      <span className="font-bold capitalize text-gray-300">
                        {existingRegistration.device}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-gray-600">
                        Status
                      </span>

                      <span className="font-bold text-green-400">
                        Registered
                      </span>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    className="mt-5 block w-full rounded-xl bg-red-600 px-5 py-3 text-center text-sm font-black transition hover:bg-red-500"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              ) : canRegister ? (
                <div className="mt-6">
                  {tournament.device_restriction ===
                    'both' &&
                    tournament.game_mode ===
                      'solo' && (
                      <div className="mb-5">
                        <p className="mb-3 text-sm font-bold text-gray-400">
                          Select Your Device
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <DeviceButton
                            active={
                              device === 'mobile'
                            }
                            onClick={() =>
                              setDevice('mobile')
                            }
                          >
                            📱 Mobile
                          </DeviceButton>

                          <DeviceButton
                            active={
                              device === 'pc'
                            }
                            onClick={() =>
                              setDevice('pc')
                            }
                          >
                            💻 PC
                          </DeviceButton>
                        </div>
                      </div>
                    )}

                  {tournament.device_restriction !==
                    'both' && (
                    <div className="mb-5 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-600">
                        YOUR DEVICE
                      </p>

                      <p className="mt-2 font-bold text-gray-300">
                        {formatDevice(
                          tournament.device_restriction
                        )}
                      </p>
                    </div>
                  )}

                  {tournament.game_mode ===
                  'solo' ? (
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={registering}
                      className="w-full rounded-xl bg-red-600 px-5 py-4 font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {registering
                        ? 'Registering...'
                        : 'Register Now'}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-yellow-900/40 bg-yellow-950/20 px-5 py-4 text-center">
                      <p className="font-bold text-yellow-400">
                        Team Registration
                      </p>

                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        This tournament requires a team.
                        Team registration will be connected
                        to the team system.
                      </p>
                    </div>
                  )}

                  <p className="mt-4 text-center text-xs leading-5 text-gray-600">
                    Your registration is checked against
                    STRIKEHUB tournament rules.
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center">
                  <p className="font-bold text-gray-400">
                    {tournament.status ===
                      'completed'
                      ? 'Tournament Completed'
                      : tournament.status ===
                          'cancelled'
                        ? 'Tournament Cancelled'
                        : 'Registration Closed'}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-gray-600">
                    This tournament is not currently
                    accepting registrations.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 border-t border-white/10 bg-[#090909]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
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
              href="/tournaments"
              className="transition hover:text-white"
            >
              Tournaments
            </Link>

            <Link
              href="/terms"
              className="transition hover:text-white"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    
        {tournament.status === 'completed' && (
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
                Final standings
              </p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">
                🏆 Tournament Results
              </h2>
              <p className="mt-1 text-sm text-white/50">
                Approved results and rewards for this completed tournament.
              </p>
            </div>

            {resultsLoading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/50">
                Loading results...
              </div>
            ) : publicResults.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-sm text-white/50">
                Results have not been published yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[680px] text-left">
                  <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-white/40">
                    <tr>
                      <th className="px-4 py-3 font-black">Place</th>
                      <th className="px-4 py-3 font-black">Player / Team</th>
                      <th className="px-4 py-3 font-black">Kills</th>
                      <th className="px-4 py-3 font-black">Points</th>
                      <th className="px-4 py-3 font-black">Gold</th>
                      <th className="px-4 py-3 font-black">Reward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {publicResults.map((result, index) => {
                      const place = result.placement ?? index + 1
                      const medal =
                        place === 1 ? '🥇' :
                        place === 2 ? '🥈' :
                        place === 3 ? '🥉' :
                        `#${place}`

                      return (
                        <tr
                          key={`${result.player_name}-${place}-${index}`}
                          className="transition hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-4 font-black text-white">{medal}</td>
                          <td className="px-4 py-4 font-bold text-white">
                            {result.player_name || 'Player'}
                          </td>
                          <td className="px-4 py-4 text-white/70">{result.kills}</td>
                          <td className="px-4 py-4 font-bold text-white">
                            {result.points_awarded}
                          </td>
                          <td className="px-4 py-4 font-bold text-yellow-400">
                            {result.gold_awarded}
                          </td>
                          <td className="px-4 py-4">
                            {result.reward_paid ? (
                              <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-400">
                                PAID
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-white/5 px-3 py-1 text-xs font-black text-white/40">
                                PENDING
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

</main>
  )
}

/* ---------------- COMPONENTS ---------------- */

function QuickStat({
  label,
  value,
  gold,
}: {
  label: string
  value: React.ReactNode
  gold?: boolean
}) {
  return (
    <div className="p-5">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-600">
        {label}
      </p>

      <p
        className={`mt-2 font-black ${
          gold
            ? 'text-xl text-yellow-400'
            : 'text-gray-300'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function InfoCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#101010]/90 p-6 backdrop-blur sm:p-7">
      <h2 className="text-xl font-black">
        {title}
      </h2>

      <div className="mt-5">
        {children}
      </div>
    </div>
  )
}

function DetailBox({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-600">
        {label}
      </p>

      <p className="mt-2 font-bold text-gray-300">
        {value}
      </p>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">
        {label}
      </span>

      <span className="text-right font-bold capitalize text-gray-300">
        {value}
      </span>
    </div>
  )
}

function DeviceButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-xl border border-red-500 bg-red-500/10 px-4 py-3 text-sm font-black text-red-400'
          : 'rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-gray-400 transition hover:bg-white/10'
      }
    >
      {children}
    </button>
  )
}

function cleanSupabaseError(
  message: string
) {
  const cleaned = message
    .replace(/^.*?ERROR:\s*/i, '')
    .trim()

  return cleaned || message
}