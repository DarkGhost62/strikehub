import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Registration = {
  id: string
  tournament_id: string
  device: string
  status: string
  registered_at: string
}

type Tournament = {
  id: string
  name: string
  description: string | null
  tournament_type: string | null
  game_mode: string | null
  map: string | null
  device_restriction: string | null
  prize_gold: number | null
  max_players: number | null
  starts_at: string | null
  status: string
  image_url: string | null
}

type MatchResult = {
  id: string
  tournament_id: string
  placement: number
  kills: number
  points_awarded: number
  gold_awarded: number
  participation_approved: boolean
  reward_paid: boolean
}

export default async function MyTournamentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // =====================================================
  // LOAD REGISTRATIONS
  // =====================================================

  const { data: registrations, error } = await supabase
    .from('tournament_registrations')
    .select(
      'id, tournament_id, device, status, registered_at'
    )
    .eq('user_id', user.id)
    .order('registered_at', { ascending: false })

  if (error) {
    console.error('MY TOURNAMENTS ERROR:', error)
  }

  const registrationList =
    (registrations as Registration[]) ?? []

  const tournamentIds = registrationList.map(
    (registration) => registration.tournament_id
  )

  // =====================================================
  // LOAD TOURNAMENTS
  // =====================================================

  let tournaments: Tournament[] = []

  if (tournamentIds.length > 0) {
    const { data, error: tournamentError } = await supabase
      .from('tournaments')
      .select(
        'id, name, description, tournament_type, game_mode, map, device_restriction, prize_gold, max_players, starts_at, status, image_url'
      )
      .in('id', tournamentIds)

    if (tournamentError) {
      console.error(
        'MY TOURNAMENTS TOURNAMENT ERROR:',
        tournamentError
      )
    }

    tournaments = (data as Tournament[]) ?? []
  }

  // =====================================================
  // LOAD PLAYER RESULTS
  // =====================================================

  let results: MatchResult[] = []

  if (tournamentIds.length > 0) {
    const { data, error: resultError } = await supabase
      .from('match_results')
      .select(
        'id, tournament_id, placement, kills, points_awarded, gold_awarded, participation_approved, reward_paid'
      )
      .eq('user_id', user.id)
      .in('tournament_id', tournamentIds)

    if (resultError) {
      console.error(
        'MY TOURNAMENT RESULTS ERROR:',
        resultError
      )
    }

    results = (data as MatchResult[]) ?? []
  }

  const tournamentMap = new Map(
    tournaments.map((tournament) => [
      tournament.id,
      tournament,
    ])
  )

  const resultMap = new Map(
    results.map((result) => [
      result.tournament_id,
      result,
    ])
  )

  // =====================================================
  // SUMMARY
  // =====================================================

  const completedTournaments = registrationList.filter(
    (registration) =>
      tournamentMap.get(registration.tournament_id)
        ?.status === 'completed'
  ).length

  const resultsCount = results.filter(
    (result) => result.participation_approved
  ).length

  const totalGoldEarned = results.reduce(
    (total, result) =>
      total +
      (result.reward_paid
        ? Number(result.gold_awarded ?? 0)
        : 0),
    0
  )

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
              Compete
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              My Tournaments
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Tournaments you have registered to compete in.
            </p>
          </div>

          <Link
            href="/tournaments"
            className="w-fit rounded-xl bg-red-600 px-5 py-3 text-sm font-black transition hover:bg-red-500"
          >
            Find Tournaments →
          </Link>

        </div>

        {/* SUMMARY */}

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">

          <SummaryCard
            title="Registrations"
            value={registrationList.length}
            icon="🏆"
          />

          <SummaryCard
            title="Active"
            value={
              registrationList.filter(
                (item) =>
                  item.status === 'registered'
              ).length
            }
            icon="⚡"
          />

          <SummaryCard
            title="Results"
            value={resultsCount}
            icon="📊"
          />

          <SummaryCard
            title="Gold Earned"
            value={totalGoldEarned}
            icon="🪙"
          />

        </div>

        {/* TOURNAMENT LIST */}

        <div className="mt-10">

          {registrationList.length === 0 ? (

            <div className="rounded-3xl border border-white/10 bg-[#0e0d10]/90 px-6 py-20 text-center">

              <div className="text-6xl">
                🏆
              </div>

              <h2 className="mt-5 text-2xl font-black">
                No tournaments yet
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                You haven't registered for a tournament yet.
                Find a competition and start your STRIKEHUB journey.
              </p>

              <Link
                href="/tournaments"
                className="mt-7 inline-block rounded-xl bg-yellow-400 px-6 py-3 text-sm font-black text-black transition hover:bg-yellow-300"
              >
                Browse Tournaments
              </Link>

            </div>

          ) : (

            <div className="grid gap-5 lg:grid-cols-2">

              {registrationList.map(
                (registration) => {

                  const tournament =
                    tournamentMap.get(
                      registration.tournament_id
                    )

                  const result =
                    resultMap.get(
                      registration.tournament_id
                    )

                  if (!tournament) {
                    return (
                      <div
                        key={registration.id}
                        className="rounded-2xl border border-red-500/20 bg-[#100b0e] p-6"
                      >
                        <p className="font-bold text-red-400">
                          Tournament unavailable
                        </p>

                        <p className="mt-2 text-xs text-gray-500">
                          This tournament could not be loaded.
                        </p>
                      </div>
                    )
                  }

                  return (
                    <TournamentCard
                      key={registration.id}
                      tournament={tournament}
                      registration={registration}
                      result={result}
                    />
                  )
                }
              )}

            </div>

          )}

        </div>

      </div>
    </main>
  )
}

function TournamentCard({
  tournament,
  registration,
  result,
}: {
  tournament: Tournament
  registration: Registration
  result?: MatchResult
}) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0e0d10]/90 transition hover:border-red-500/30 hover:shadow-2xl hover:shadow-red-950/20">

      {/* IMAGE */}

      <div className="relative h-52 overflow-hidden bg-[#17090c]">

        {tournament.image_url ? (
          <img
            src={tournament.image_url}
            alt={tournament.name}
            className="h-full w-full object-cover opacity-75 transition duration-700 group-hover:scale-105 group-hover:opacity-90"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-red-950 via-[#17090d] to-black text-6xl">
            🏆
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0d10] via-transparent to-transparent" />

        <div className="absolute left-5 top-5">
          <StatusBadge status={tournament.status} />
        </div>

        <div className="absolute bottom-5 right-5 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-black text-black">
          🪙{' '}
          {Number(
            tournament.prize_gold ?? 0
          ).toLocaleString()}{' '}
          GOLD
        </div>

      </div>

      {/* CONTENT */}

      <div className="p-6">

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">

            <h2 className="truncate text-xl font-black">
              {tournament.name}
            </h2>

            <p className="mt-1 line-clamp-2 text-sm text-gray-500">
              {tournament.description ||
                'STRIKEHUB tournament'}
            </p>

          </div>

          <span className="shrink-0 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-green-400">
            Registered
          </span>

        </div>

        {/* DETAILS */}

        <div className="mt-6 grid grid-cols-2 gap-3">

          <Detail
            label="Map"
            value={tournament.map || 'TBA'}
          />

          <Detail
            label="Mode"
            value={formatMode(tournament.game_mode)}
          />

          <Detail
            label="Device"
            value={formatDevice(
              registration.device
            )}
          />

          <Detail
            label="Players"
            value={
              tournament.max_players
                ? String(
                    tournament.max_players
                  )
                : 'Open'
            }
          />

        </div>

        {/* DATE */}

        <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4">

          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">
            Tournament Starts
          </p>

          <p className="mt-1 text-sm font-bold text-gray-300">
            {formatDate(tournament.starts_at)}
          </p>

        </div>

        {/* RESULT */}

        {tournament.status === 'completed' && (
          <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.03] p-4">

            <div className="flex items-center justify-between gap-3">

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-500">
                  Tournament Result
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  {result
                    ? result.participation_approved
                      ? 'Your final performance'
                      : 'Result recorded — awaiting approval'
                    : 'Results are not available yet'}
                </p>
              </div>

              {result && (
                <RewardBadge
                  paid={result.reward_paid}
                />
              )}

            </div>

            {result ? (

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">

                <ResultStat
                  label="Place"
                  value={`#${result.placement}`}
                  icon="🏆"
                />

                <ResultStat
                  label="Kills"
                  value={result.kills.toLocaleString()}
                  icon="🔫"
                />

                <ResultStat
                  label="Points"
                  value={result.points_awarded.toLocaleString()}
                  icon="⭐"
                />

                <ResultStat
                  label="Gold"
                  value={result.gold_awarded.toLocaleString()}
                  icon="🪙"
                />

              </div>

            ) : (

              <div className="mt-4 rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-center">

                <p className="text-xs font-bold text-gray-500">
                  ⏳ Results pending
                </p>

                <p className="mt-1 text-[10px] text-gray-700">
                  Your tournament result will appear here when it is published.
                </p>

              </div>

            )}

          </div>
        )}

        {/* ACTION */}

        <Link
          href={`/tournaments/${tournament.id}`}
          className="mt-5 block rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-center text-sm font-black transition hover:border-red-500/30 hover:bg-red-500/10"
        >
          View Tournament →
        </Link>

      </div>

    </div>
  )
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string
  value: number
  icon: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0e0d10]/90 p-5">

      <div className="flex items-center justify-between">

        <span className="text-xl">
          {icon}
        </span>

        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
          STRIKEHUB
        </span>

      </div>

      <p className="mt-5 text-xs text-gray-500">
        {title}
      </p>

      <p className="mt-1 text-2xl font-black">
        {value.toLocaleString()}
      </p>

    </div>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">

      <p className="text-[8px] font-bold uppercase tracking-wider text-gray-600">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-bold text-gray-300">
        {value}
      </p>

    </div>
  )
}

function ResultStat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">

      <p className="text-[8px] font-bold uppercase tracking-wider text-gray-600">
        {icon} {label}
      </p>

      <p className="mt-1 text-sm font-black text-gray-200">
        {value}
      </p>

    </div>
  )
}

function RewardBadge({
  paid,
}: {
  paid: boolean
}) {
  if (paid) {
    return (
      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-green-400">
        ✓ Paid
      </span>
    )
  }

  return (
    <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-yellow-400">
      Pending
    </span>
  )
}

function StatusBadge({
  status,
}: {
  status: string
}) {
  if (status === 'live') {
    return (
      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-green-400 backdrop-blur">
        ● Live Now
      </span>
    )
  }

  if (status === 'completed') {
    return (
      <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-gray-300 backdrop-blur">
        Completed
      </span>
    )
  }

  if (status === 'cancelled') {
    return (
      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-red-300 backdrop-blur">
        Cancelled
      </span>
    )
  }

  return (
    <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-red-300 backdrop-blur">
      Upcoming
    </span>
  )
}

function formatDevice(device: string) {
  if (device === 'mobile') {
    return 'Mobile'
  }

  if (device === 'pc') {
    return 'PC'
  }

  return device || 'All'
}

function formatMode(mode: string | null) {
  if (!mode) {
    return 'Tournament'
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

function formatDate(date: string | null) {
  if (!date) {
    return 'Date TBA'
  }

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return 'Date TBA'
  }

  return parsed.toLocaleString('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
}