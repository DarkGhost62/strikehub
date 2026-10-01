import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type LeaderboardPlayer = {
  rank: number
  display_name: string
  in_game_name: string
  profile_image_url: string | null
  points: number
  matches_won: number
  total_kills: number
}

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase.rpc('get_leaderboard')

  const players: LeaderboardPlayer[] = (data ?? []).map(
    (player: LeaderboardPlayer) => ({
      rank: Number(player.rank),
      display_name: player.display_name || 'STRIKEHUB Player',
      in_game_name: player.in_game_name || 'Unknown Player',
      profile_image_url: player.profile_image_url,
      points: Number(player.points ?? 0),
      matches_won: Number(player.matches_won ?? 0),
      total_kills: Number(player.total_kills ?? 0),
    }),
  )

  return (
    <div className="min-h-screen">
      <section className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8">

        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-xs font-bold text-red-400 transition hover:text-red-300"
          >
            ← Back to Dashboard
          </Link>

          <p className="mt-7 text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB RANKINGS
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            Leaderboard
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
            Compete, earn points, win matches and rise through the STRIKEHUB
            rankings.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="text-sm font-bold text-red-400">
              Unable to load the leaderboard.
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Please refresh the page and try again.
            </p>
          </div>
        )}

        {!error && players.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-12 text-center">
            <div className="text-5xl">🏆</div>

            <h2 className="mt-5 text-xl font-black">
              No rankings yet
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Player rankings will appear here as STRIKEHUB competitions begin.
            </p>
          </div>
        )}

        {players.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0e0d10]/90">

            <div className="hidden grid-cols-[70px_minmax(0,1fr)_120px_130px_130px] gap-4 border-b border-white/10 px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-600 sm:grid">
              <span>Rank</span>
              <span>Player</span>
              <span>Points</span>
              <span>Wins</span>
              <span>Kills</span>
            </div>

            <div>
              {players.map((player) => {
                const isTopThree = player.rank <= 3

                return (
                  <div
                    key={`${player.rank}-${player.display_name}`}
                    className="border-b border-white/5 px-5 py-5 transition last:border-b-0 hover:bg-white/[0.02] sm:grid sm:grid-cols-[70px_minmax(0,1fr)_120px_130px_130px] sm:items-center sm:gap-4 sm:px-6"
                  >
                    <div className="flex items-center gap-3 sm:block">
                      <span
                        className={`text-lg font-black ${
                          player.rank === 1
                            ? 'text-yellow-400'
                            : player.rank === 2
                              ? 'text-gray-300'
                              : player.rank === 3
                                ? 'text-orange-400'
                                : 'text-gray-600'
                        }`}
                      >
                        {isTopThree
                          ? player.rank === 1
                            ? '🥇'
                            : player.rank === 2
                              ? '🥈'
                              : '🥉'
                          : `#${player.rank}`}
                      </span>

                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-700 sm:hidden">
                        Rank
                      </span>
                    </div>

                    <div className="mt-4 flex min-w-0 items-center gap-4 sm:mt-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-red-500/20 bg-red-500/10 text-lg font-black text-red-400">
                        {player.profile_image_url ? (
                          <img
                            src={player.profile_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          player.display_name.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-black text-white">
                          {player.in_game_name}
                        </p>

                        <p className="mt-1 truncate text-[10px] font-semibold text-gray-600">
                          {player.display_name}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3 sm:mt-0 sm:contents">
                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 sm:hidden">
                          Points
                        </p>

                        <p className="mt-1 text-sm font-black text-yellow-400 sm:mt-0">
                          {player.points.toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 sm:hidden">
                          Wins
                        </p>

                        <p className="mt-1 text-sm font-black sm:mt-0">
                          {player.matches_won.toLocaleString()}
                        </p>
                      </div>

                      <div>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-gray-600 sm:hidden">
                          Kills
                        </p>

                        <p className="mt-1 text-sm font-black sm:mt-0">
                          {player.total_kills.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <p className="text-xs leading-6 text-gray-600">
            Rankings are based on STRIKEHUB player statistics. Players are
            ranked by points, followed by matches won and total kills.
          </p>
        </div>

      </section>
    </div>
  )
}
