import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CurrencySwitcher from './currency-switcher'
import NotificationButton from './notification-button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [
    { data: profile },
    { data: wallet },
    { data: roleData },
    { data: rates },
    { data: tournaments },
    { data: latestDailyLogin },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'bloodstrike_uid, in_game_name, display_name, profile_image_url, points, matches_won, total_kills'
      )
      .eq('id', user.id)
      .maybeSingle(),

    supabase
      .from('wallets')
      .select('gold_balance, naira_balance')
      .eq('user_id', user.id)
      .maybeSingle(),

    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle(),

    supabase
      .from('conversion_rates')
      .select('naira_per_gold, usd_per_gold')
      .eq('id', 1)
      .maybeSingle(),

    supabase
      .from('tournaments')
      .select(
        'id, name, description, tournament_type, game_mode, map, device_restriction, prize_gold, max_players, max_teams, players_per_team, registration_open, starts_at, registration_deadline, status, image_url'
      )
      .in('status', ['live', 'upcoming'])
      .order('starts_at', { ascending: true })
      .limit(7),

    supabase
      .from('daily_login_claims')
      .select('streak_day, claim_date, claimed_at')
      .eq('user_id', user.id)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const gold = Number(wallet?.gold_balance ?? 0)

  const points = Number(profile?.points ?? 0)
  const wins = Number(profile?.matches_won ?? 0)
  const kills = Number(profile?.total_kills ?? 0)

  const nairaPerGold = Number(rates?.naira_per_gold ?? 0)
  const usdPerGold = Number(rates?.usd_per_gold ?? 0)

  const naira = gold * nairaPerGold
  const usd = gold * usdPerGold

  const isAdmin = roleData?.role === 'admin'

  const latestClaimDate = latestDailyLogin?.claim_date
    ? String(latestDailyLogin.claim_date)
    : null

  const lagosToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
  }).format(new Date())

  const lagosYesterday = new Date(
    `${lagosToday}T12:00:00+01:00`
  )
  lagosYesterday.setDate(lagosYesterday.getDate() - 1)

  const lagosYesterdayString = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
  }).format(lagosYesterday)

  const currentStreak =
    latestClaimDate === lagosToday ||
    latestClaimDate === lagosYesterdayString
      ? Number(latestDailyLogin?.streak_day ?? 0)
      : 0

  const dailyLoginClaimedToday = latestClaimDate === lagosToday

  const tournamentList = tournaments ?? []

  const featuredTournament = tournamentList[0] ?? null
  const upcomingTournaments = tournamentList.slice(1, 4)

  return (
    <div className="min-h-screen">
      {/* ===================================================== */}
      {/* TOP HEADER                                            */}
      {/* ===================================================== */}

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09080c]/75 backdrop-blur-xl">
        <div className="flex h-[76px] items-center justify-between px-5 sm:px-8">
          <div className="hidden lg:block">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-gray-600">
              Player Dashboard
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <CurrencySwitcher
              gold={gold}
              naira={naira}
              usd={usd}
            />

            {/* Notifications */}
            <div className="block">
              <NotificationButton />
            </div>

            {/* Avatar */}
            <Link
              href="/dashboard/profile"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 font-black text-red-400 transition hover:border-red-500/60"
            >
              {profile?.display_name?.charAt(0).toUpperCase() || 'S'}
            </Link>
          </div>
        </div>
      </header>

      {/* ===================================================== */}
      {/* MAIN CONTENT                                           */}
      {/* ===================================================== */}

      <section className="mx-auto max-w-[1450px] px-5 py-8 sm:px-8">

        {/* WELCOME */}
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-500">
            Welcome back
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
            {profile?.display_name || 'STRIKEHUB Player'}
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Compete. Earn. Rise.
          </p>
        </div>

        {/* =================================================== */}
        {/* WALLET HERO                                         */}
        {/* =================================================== */}

        <div className="relative overflow-hidden rounded-3xl border border-red-500/25 bg-gradient-to-br from-[#300b12] via-[#17090e] to-[#0d0b11] p-6 shadow-2xl shadow-red-950/30 sm:p-8">

          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-red-500/20 blur-[110px]" />

          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-orange-500/10 blur-[100px]" />

          <div className="relative">
            <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-start">

              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-500">
                  Total Gold Balance
                </p>

                <div className="mt-3 flex items-end gap-3">
                  <span className="text-5xl font-black text-yellow-400 sm:text-6xl">
                    {gold.toLocaleString()}
                  </span>

                  <span className="mb-2 font-black text-yellow-500">
                    GOLD
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">

                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-gray-300">
                    ₦
                    {naira.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-gray-300">
                    ${usd.toFixed(2)}
                  </div>

                </div>
              </div>

              <div className="flex flex-wrap gap-3">

                <Link
                  href="/tournaments"
                  className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-300"
                >
                  Find Tournaments
                </Link>

                <Link
                  href="/dashboard"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                >
                  Wallet
                </Link>

              </div>
            </div>
          </div>
        </div>

        {/* =================================================== */}
        {/* STATS                                                */}
        {/* =================================================== */}

        <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">

          <StatCard
            icon="⭐"
            title="Points"
            value={points}
          />

          <StatCard
            icon="🏆"
            title="Matches Won"
            value={wins}
          />

          <StatCard
            icon="🎯"
            title="Total Kills"
            value={kills}
          />

          <StatCard
            icon="🔥"
            title="Current Streak"
            value={`${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`}
          />

        </div>

        {/* =================================================== */}
        {/* QUICK ACTIONS                                        */}
        {/* =================================================== */}

        <div className="mt-10">

          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                Shortcuts
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Quick Actions
              </h2>
            </div>

            <span className="hidden text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600 sm:block">
              STRIKEHUB
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">

            <QuickAction
              href="/tournaments"
              icon="🏆"
              title="Tournaments"
            />

            <QuickAction
              href="/dashboard/tasks"
              icon="✓"
              title="Tasks"
            />

            <QuickAction
              href="/dashboard/daily-login"
              icon="🔥"
              title="Daily Login"
            />

            <QuickAction
              href="/dashboard/shop"
              icon="🛒"
              title="Shop"
            />

            <ComingSoonAction
              icon="🎯"
              title="Stake"
            />

            <ComingSoonAction
              icon="💰"
              title="Withdraw"
            />

          </div>
        </div>

        {/* =================================================== */}
        {/* FEATURED TOURNAMENT                                   */}
        {/* =================================================== */}

        <div className="mt-10">

          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                Compete
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Featured Tournament
              </h2>
            </div>

            <Link
              href="/tournaments"
              className="text-xs font-bold text-red-400 transition hover:text-red-300"
            >
              View All →
            </Link>
          </div>

          {featuredTournament ? (

            <Link
              href={`/tournaments/${featuredTournament.id}`}
              className="group relative block min-h-[340px] overflow-hidden rounded-3xl border border-red-500/25 bg-[#12090c] shadow-2xl shadow-red-950/20"
            >

              {featuredTournament.image_url ? (
                <img
                  src={featuredTournament.image_url}
                  alt={featuredTournament.name}
                  className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-700 group-hover:scale-105 group-hover:opacity-75"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-[#16080c] to-black" />
              )}

              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />

              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

              <div className="absolute -right-20 top-[-100px] h-80 w-80 rounded-full bg-red-500/20 blur-[120px]" />

              <div className="relative flex min-h-[340px] flex-col justify-end p-7 sm:p-10">

                <div className="flex flex-wrap gap-2">

                  <span className="rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-red-300 backdrop-blur">
                    {featuredTournament.status === 'live'
                      ? '● Live Now'
                      : 'Upcoming'}
                  </span>

                  {featuredTournament.device_restriction && (
                    <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-300 backdrop-blur">
                      {formatDevice(
                        featuredTournament.device_restriction
                      )}
                    </span>
                  )}

                </div>

                <h3 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
                  {featuredTournament.name}
                </h3>

                <p className="mt-3 max-w-2xl line-clamp-2 text-sm leading-6 text-gray-300">
                  {featuredTournament.description ||
                    'Compete, earn Gold and rise on the STRIKEHUB leaderboard.'}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-semibold text-gray-300">

                  <span>
                    🗺️ {featuredTournament.map || 'Map TBA'}
                  </span>

                  <span>
                    🎮 {formatGameMode(
                      featuredTournament.game_mode
                    )}
                  </span>

                  <span>
                    🪙{' '}
                    {Number(
                      featuredTournament.prize_gold ?? 0
                    ).toLocaleString()}{' '}
                    Gold
                  </span>

                  {featuredTournament.max_players && (
                    <span>
                      👥 {featuredTournament.max_players} Players
                    </span>
                  )}

                </div>

                <div className="mt-6 flex flex-wrap items-center gap-4">

                  <span className="rounded-xl bg-red-600 px-6 py-3 text-sm font-black transition group-hover:bg-red-500">
                    View Tournament
                  </span>

                  <span className="text-xs font-bold text-gray-400">
                    {formatDate(featuredTournament.starts_at)}
                  </span>

                </div>
              </div>
            </Link>

          ) : (
            <EmptyTournament />
          )}

        </div>

        {/* =================================================== */}
        {/* UPCOMING TOURNAMENTS                                  */}
        {/* =================================================== */}

        {upcomingTournaments.length > 0 && (

          <div className="mt-10">

            <div className="mb-5 flex items-end justify-between">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
                  More Matches
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  Upcoming Tournaments
                </h2>
              </div>

              <Link
                href="/tournaments"
                className="text-xs font-bold text-red-400 transition hover:text-red-300"
              >
                View All →
              </Link>

            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

              {upcomingTournaments.map((tournament) => (

                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.id}`}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0e0d10]/90 transition hover:-translate-y-1 hover:border-red-500/30 hover:shadow-xl hover:shadow-red-950/20"
                >

                  <div className="relative h-48 overflow-hidden bg-[#17090c]">

                    {tournament.image_url ? (
                      <img
                        src={tournament.image_url}
                        alt={tournament.name}
                        className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-red-950 to-black text-5xl">
                        🏆
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#0e0d10] via-transparent to-transparent" />

                    <span className="absolute left-4 top-4 rounded-full border border-red-500/30 bg-black/60 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-red-300 backdrop-blur">
                      {tournament.status === 'live'
                        ? '● Live'
                        : 'Upcoming'}
                    </span>

                    <span className="absolute bottom-4 right-4 rounded-lg bg-yellow-400 px-3 py-1 text-[10px] font-black text-black">
                      🪙{' '}
                      {Number(
                        tournament.prize_gold ?? 0
                      ).toLocaleString()}
                    </span>

                  </div>

                  <div className="p-5">

                    <h3 className="truncate font-black">
                      {tournament.name}
                    </h3>

                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[11px] text-gray-500">

                      <span>
                        🗺️ {tournament.map || 'Map TBA'}
                      </span>

                      <span>
                        🎮 {formatGameMode(
                          tournament.game_mode
                        )}
                      </span>

                      <span>
                        📱 {formatDevice(
                          tournament.device_restriction
                        )}
                      </span>

                      <span>
                        👥{' '}
                        {tournament.max_players
                          ? `${tournament.max_players} players`
                          : 'Open'}
                      </span>

                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">

                      <span className="text-[10px] font-bold text-gray-600">
                        {formatDateShort(
                          tournament.starts_at
                        )}
                      </span>

                      <span className="text-xs font-black text-red-400 transition group-hover:text-red-300">
                        View →
                      </span>

                    </div>

                  </div>
                </Link>

              ))}

            </div>
          </div>
        )}

        {/* =================================================== */}
        {/* PLAYER PROFILE                                       */}
        {/* =================================================== */}

        <div className="mt-10">

          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">
              Account
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Player Profile
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-6 backdrop-blur sm:p-7">

            <div className="flex flex-col gap-7 sm:flex-row sm:items-start">

              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-red-500/30 bg-red-500/10 text-3xl font-black text-red-400">

                {profile?.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt={profile.display_name || 'Player'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  profile?.display_name
                    ?.charAt(0)
                    .toUpperCase() || 'S'
                )}

              </div>

              <div className="min-w-0 flex-1">

                <div className="flex flex-col justify-between gap-4 sm:flex-row">

                  <div>
                    <h3 className="text-xl font-black">
                      {profile?.display_name || 'Player'}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      {profile?.in_game_name ||
                        'BloodStrike Player'}
                    </p>
                  </div>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="inline-flex w-fit rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10"
                    >
                      🔐 Admin Panel
                    </Link>
                  )}

                </div>

                <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                  <ProfileInfo
                    title="BloodStrike UID"
                    value={profile?.bloodstrike_uid}
                  />

                  <ProfileInfo
                    title="Account"
                    value={
                      isAdmin
                        ? 'Administrator'
                        : 'Player'
                    }
                  />

                  <ProfileInfo
                    title="Email"
                    value={user.email}
                  />

                  <ProfileInfo
                    title="Gold"
                    value={gold.toLocaleString()}
                  />

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================== */}
        {/* BADGES + DAILY LOGIN                                 */}
        {/* =================================================== */}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          {/* BADGES */}

          <DashboardCard
            title="My Badges"
            subtitle="Achievements you earn on STRIKEHUB"
          >

            <div className="grid grid-cols-4 gap-3">

              {['🏆', '🎯', '🔥', '⚡'].map(
                (icon, index) => (

                  <div
                    key={index}
                    className="flex h-24 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] opacity-40"
                  >

                    <span className="text-2xl grayscale">
                      {icon}
                    </span>

                    <span className="mt-2 text-[9px] font-bold tracking-wider text-gray-500">
                      LOCKED
                    </span>

                  </div>
                )
              )}

            </div>

            <p className="mt-4 text-xs text-gray-600">
              Badges will be awarded for tournaments,
              achievements and special events.
            </p>

          </DashboardCard>

          {/* DAILY LOGIN */}

          <DashboardCard
            title="Daily Login"
            subtitle="Keep your streak alive and earn rewards."
          >

            <div className="grid grid-cols-7 gap-2">

              {[1, 2, 3, 4, 5, 6, 7].map(
                (day) => {
                  const isCompleted =
                    currentStreak > 0 && day <= currentStreak
                  const isToday =
                    !dailyLoginClaimedToday &&
                    currentStreak > 0 &&
                    day === Math.min(currentStreak + 1, 7)

                  return (
                    <div
                      key={day}
                      className={`rounded-xl border p-3 text-center ${
                        isCompleted
                          ? 'border-yellow-400/30 bg-yellow-400/10'
                          : isToday
                            ? 'border-red-500/30 bg-red-500/10'
                            : 'border-white/10 bg-white/[0.02]'
                      }`}
                    >
                      <p className="text-[8px] text-gray-600">
                        DAY
                      </p>

                      <p className="mt-1 font-black">
                        {day}
                      </p>

                      <span className="text-sm">
                        {isCompleted ? '✓' : isToday ? '🔥' : '🔒'}
                      </span>
                    </div>
                  )
                }
              )}

            </div>

            <Link
              href="/dashboard/daily-login"
              className="mt-5 block w-full rounded-xl bg-yellow-400 py-3 text-center text-sm font-black text-black transition hover:bg-yellow-300"
            >
              Open Daily Login →
            </Link>

          </DashboardCard>

        </div>

      </section>
    </div>
  )
}

/* ========================================================= */
/* COMING SOON ACTION                                         */
/* ========================================================= */

function ComingSoonAction({
  icon,
  title,
}: {
  icon: string
  title: string
}) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-[#0e0d10]/90 p-5 text-center opacity-60 transition hover:border-white/15 hover:opacity-75">
      <div className="text-2xl grayscale">{icon}</div>

      <p className="mt-3 text-xs font-bold text-gray-300">
        {title}
      </p>

      <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-600">
        Coming Soon
      </p>
    </div>
  )
}

/* ========================================================= */
/* STAT CARD                                                  */
/* ========================================================= */

function StatCard({
  icon,
  title,
  value,
}: {
  icon: string
  title: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0e0d10]/90 p-5 backdrop-blur transition hover:-translate-y-0.5 hover:border-red-500/20">

      <div className="flex items-center justify-between">

        <span className="text-xl">
          {icon}
        </span>

        <span className="text-[9px] font-bold tracking-widest text-gray-600">
          STATS
        </span>

      </div>

      <p className="mt-5 text-xs text-gray-500">
        {title}
      </p>

      <p className="mt-1 text-2xl font-black">
        {typeof value === 'number'
          ? value.toLocaleString()
          : value}
      </p>

    </div>
  )
}

/* ========================================================= */
/* QUICK ACTION                                              */
/* ========================================================= */

function QuickAction({
  href,
  icon,
  title,
}: {
  href: string
  icon: string
  title: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/10 bg-[#0e0d10]/90 p-5 text-center transition hover:-translate-y-1 hover:border-red-500/30 hover:bg-red-500/5"
    >

      <div className="text-2xl transition group-hover:scale-110">
        {icon}
      </div>

      <p className="mt-3 text-xs font-bold">
        {title}
      </p>

    </Link>
  )
}

/* ========================================================= */
/* DASHBOARD CARD                                            */
/* ========================================================= */

function DashboardCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-6 backdrop-blur sm:p-7">

      <h2 className="text-xl font-black">
        {title}
      </h2>

      <p className="mt-1 text-xs text-gray-500">
        {subtitle}
      </p>

      <div className="mt-6">
        {children}
      </div>

    </div>
  )
}

/* ========================================================= */
/* PROFILE INFO                                              */
/* ========================================================= */

function ProfileInfo({
  title,
  value,
}: {
  title: string
  value?: string | null
}) {
  return (
    <div className="min-w-0">

      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">
        {title}
      </p>

      <p className="mt-1 truncate text-sm font-bold text-gray-300">
        {value || '—'}
      </p>

    </div>
  )
}

/* ========================================================= */
/* EMPTY TOURNAMENT                                          */
/* ========================================================= */

function EmptyTournament() {
  return (
    <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#16090c] to-[#0d0b0e]">

      <div className="px-6 text-center">

        <div className="text-5xl">
          🏆
        </div>

        <h3 className="mt-4 text-xl font-black">
          No tournaments available
        </h3>

        <p className="mt-2 text-sm text-gray-500">
          New competitions will appear here when they are published.
        </p>

        <Link
          href="/tournaments"
          className="mt-6 inline-block rounded-xl border border-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/5"
        >
          Browse Tournaments
        </Link>

      </div>
    </div>
  )
}

/* ========================================================= */
/* FORMAT DEVICE                                             */
/* ========================================================= */

function formatDevice(device?: string | null) {
  if (!device) {
    return 'All Devices'
  }

  if (device === 'mobile') {
    return 'Mobile Only'
  }

  if (device === 'pc') {
    return 'PC Only'
  }

  return device
}

/* ========================================================= */
/* FORMAT GAME MODE                                          */
/* ========================================================= */

function formatGameMode(mode?: string | null) {
  if (!mode) {
    return 'Tournament'
  }

  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

/* ========================================================= */
/* DATE FORMAT                                                */
/* ========================================================= */

function formatDate(date?: string | null) {
  if (!date) {
    return 'Date TBA'
  }

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return 'Date TBA'
  }

  return parsed.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/* ========================================================= */
/* SHORT DATE                                                */
/* ========================================================= */

function formatDateShort(date?: string | null) {
  if (!date) {
    return 'Date TBA'
  }

  const parsed = new Date(date)

  if (Number.isNaN(parsed.getTime())) {
    return 'Date TBA'
  }

  return parsed.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}