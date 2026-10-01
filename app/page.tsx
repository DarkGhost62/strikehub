import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Tournament = {
  id: string;
  name: string;
  description: string | null;
  tournament_type: string | null;
  game_mode: string | null;
  map: string | null;
  device_restriction: string | null;
  prize_gold: number | null;
  max_players: number | null;
  max_teams: number | null;
  registration_open: boolean | null;
  starts_at: string | null;
  registration_deadline: string | null;
  status: string | null;
  image_url: string | null;
  live_stream_url: string | null;
};

type TournamentCard = Tournament & {
  registration_count: number;
};

type Promotion = {
  id: string;
  advertiser_name: string;
  contact_email: string | null;
  contact_number: string | null;
  title: string;
  description: string;
  image_url: string | null;
  destination_url: string;
  starts_at: string | null;
  expires_at: string | null;
  status: string | null;
  is_featured: boolean | null;
  created_at: string;
};

function formatDate(date: string | null) {
  if (!date) return "Date TBA";

  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function getStatus(tournament: Tournament) {
  const status = (tournament.status || "").toLowerCase();

  if (status === "live") {
    return {
      label: "LIVE NOW",
      className:
        "border-red-500/30 bg-red-500/10 text-red-400",
      dot: true,
    };
  }

  if (tournament.registration_open) {
    return {
      label: "REGISTRATION OPEN",
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
      dot: false,
    };
  }

  return {
    label: "UPCOMING",
    className:
      "border-orange-500/20 bg-orange-500/10 text-orange-400",
    dot: false,
  };
}

async function getTournamentRegistrationCount(
  tournamentId: string
) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_tournament_registration_count",
    {
      p_tournament_id: tournamentId,
    }
  );

  if (error || data === null || data === undefined) {
    return 0;
  }

  return Number(data);
}

async function getTournaments() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tournaments")
    .select(
      `
        id,
        name,
        description,
        tournament_type,
        game_mode,
        map,
        device_restriction,
        prize_gold,
        max_players,
        max_teams,
        registration_open,
        starts_at,
        registration_deadline,
        status,
        image_url,
        live_stream_url
      `
    )
    .in("status", ["upcoming", "live"])
    .order("starts_at", {
      ascending: true,
      nullsFirst: false,
    });

  if (error || !data) {
    return [] as Tournament[];
  }

  return data as Tournament[];
}

function sortTournaments(tournaments: Tournament[]) {
  return [...tournaments].sort((a, b) => {
    const priority = (tournament: Tournament) => {
      if (
        (tournament.status || "").toLowerCase() === "live"
      ) {
        return 0;
      }

      if (tournament.registration_open) {
        return 1;
      }

      return 2;
    };

    const priorityDifference =
      priority(a) - priority(b);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const dateA = a.starts_at
      ? new Date(a.starts_at).getTime()
      : Number.MAX_SAFE_INTEGER;

    const dateB = b.starts_at
      ? new Date(b.starts_at).getTime()
      : Number.MAX_SAFE_INTEGER;

    return dateA - dateB;
  });
}

async function getHomepageTournamentData() {
  const tournaments = await getTournaments();

  const sorted = sortTournaments(tournaments);

  const liveTournament = sorted.find(
    (tournament) =>
      (tournament.status || "").toLowerCase() === "live"
  );

  const registrationTournament = sorted.find(
    (tournament) =>
      tournament.registration_open === true
  );

  const featuredTournament =
    liveTournament ||
    registrationTournament ||
    sorted[0] ||
    null;

  if (!featuredTournament) {
    return {
      featuredTournament: null,
      activeTournaments: [] as TournamentCard[],
    };
  }

  const remaining = sorted.filter(
    (tournament) =>
      tournament.id !== featuredTournament.id
  );

  const activeTournaments = await Promise.all(
    remaining.slice(0, 6).map(async (tournament) => ({
      ...tournament,
      registration_count:
        await getTournamentRegistrationCount(
          tournament.id
        ),
    }))
  );

  return {
    featuredTournament,
    activeTournaments,
  };
}

/*
 * HOMEPAGE PROMOTIONS
 *
 * Only promotions that:
 * - are active
 * - have started
 * - have not expired
 *
 * are displayed.
 *
 * Featured promotions are placed first.
 */
async function getHomepagePromotions() {
  const supabase = await createClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("promotions")
    .select(
      `
        id,
        advertiser_name,
        contact_email,
        contact_number,
        title,
        description,
        image_url,
        destination_url,
        starts_at,
        expires_at,
        status,
        is_featured,
        created_at
      `
    )
    .eq("status", "active")
    .or(
      `starts_at.is.null,starts_at.lte.${now}`
    )
    .or(
      `expires_at.is.null,expires_at.gt.${now}`
    )
    .order("is_featured", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(6);

  if (error || !data) {
    console.error(
      "Failed to load homepage promotions:",
      error
    );

    return [] as Promotion[];
  }

  return data as Promotion[];
}

export default async function Home() {
  const [
    homepageTournamentData,
    promotions,
  ] = await Promise.all([
    getHomepageTournamentData(),
    getHomepagePromotions(),
  ]);

  const {
    featuredTournament,
    activeTournaments,
  } = homepageTournamentData;

  const featuredStatus = featuredTournament
    ? getStatus(featuredTournament)
    : null;

  const featuredRegistrationCount =
    featuredTournament
      ? await getTournamentRegistrationCount(
          featuredTournament.id
        )
      : 0;

  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-white">

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute left-[-180px] top-[80px] h-[420px] w-[420px] rounded-full bg-red-700/10 blur-[140px]" />

        <div className="absolute right-[-160px] top-[180px] h-[480px] w-[480px] rounded-full bg-purple-700/10 blur-[150px]" />

        <div className="absolute bottom-[-200px] left-[30%] h-[400px] w-[500px] rounded-full bg-orange-600/5 blur-[140px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,60,60,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,60,60,0.5) 1px, transparent 1px)",
            backgroundSize: "70px 70px",
          }}
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050507_78%)]" />
      </div>

      {/* Navigation */}
      <header className="relative z-20 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">

          <Link
            href="/"
            className="group flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.12)]">
              <span className="text-xl font-black italic text-red-500">
                S
              </span>
            </div>

            <div>
              <div className="text-lg font-black tracking-[0.16em]">
                STRIKE<span className="text-red-500">
                  HUB
                </span>
              </div>

              <div className="text-[8px] font-bold tracking-[0.32em] text-zinc-500">
                COMPETE. EARN. RISE.
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="/tournaments"
              className="text-sm font-semibold text-zinc-400 transition hover:text-white"
            >
              Tournaments
            </Link>

            <Link
              href="/dashboard/leaderboard"
              className="text-sm font-semibold text-zinc-400 transition hover:text-white"
            >
              Leaderboard
            </Link>

            <Link
              href="/dashboard"
              className="text-sm font-semibold text-zinc-400 transition hover:text-white"
            >
              Community
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-300 transition hover:bg-white/5 hover:text-white sm:block"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="rounded-xl border border-red-500/50 bg-red-600 px-4 py-2.5 text-sm font-black shadow-[0_0_25px_rgba(220,38,38,0.2)] transition hover:bg-red-500 hover:shadow-[0_0_35px_rgba(220,38,38,0.35)]"
            >
              Join Now
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10">
        <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-16">

          <div className="relative z-10 max-w-2xl">

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/[0.07] px-3 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />

              <span className="text-[10px] font-black tracking-[0.22em] text-red-400 sm:text-xs">
                THE NEXT LEVEL OF COMPETITION
              </span>
            </div>

            <h1 className="text-5xl font-black uppercase leading-[0.92] tracking-[-0.04em] sm:text-6xl md:text-7xl lg:text-[76px]">
              COMPETE.
              <br />

              <span className="text-white">
                EARN.
              </span>{" "}

              <span className="bg-gradient-to-r from-red-500 via-orange-400 to-red-500 bg-clip-text text-transparent">
                RISE.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
              Welcome to STRIKEHUB — the competitive gaming platform built
              for players who want to compete, earn rewards, and climb the
              ranks.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group relative flex h-13 items-center justify-center overflow-hidden rounded-xl bg-red-600 px-7 font-black tracking-wide shadow-[0_0_35px_rgba(220,38,38,0.2)] transition hover:bg-red-500 hover:shadow-[0_0_45px_rgba(220,38,38,0.35)]"
              >
                <span className="relative z-10">
                  JOIN STRIKEHUB
                </span>

                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </Link>

              <Link
                href="/tournaments"
                className="flex h-13 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-7 font-black tracking-wide text-white backdrop-blur-sm transition hover:border-red-500/30 hover:bg-white/[0.07]"
              >
                EXPLORE TOURNAMENTS
              </Link>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-3 border-y border-white/[0.07] py-5">
              <div>
                <p className="text-xl font-black text-white sm:text-2xl">
                  24/7
                </p>

                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500 sm:text-[10px]">
                  Competition
                </p>
              </div>

              <div className="border-l border-white/[0.07] pl-4 sm:pl-6">
                <p className="text-xl font-black text-white sm:text-2xl">
                  GOLD
                </p>

                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500 sm:text-[10px]">
                  Rewards
                </p>
              </div>

              <div className="border-l border-white/[0.07] pl-4 sm:pl-6">
                <p className="text-xl font-black text-white sm:text-2xl">
                  RANK
                </p>

                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500 sm:text-[10px]">
                  Your Legacy
                </p>
              </div>
            </div>
          </div>

          {/* Logo animation */}
          <div className="relative flex min-h-[340px] items-center justify-center lg:min-h-[520px]">
            <div className="absolute h-[280px] w-[280px] rounded-full bg-red-600/10 blur-[90px] sm:h-[380px] sm:w-[380px]" />

            <div className="absolute -left-3 top-10 hidden h-24 w-24 rounded-full border border-red-500/10 sm:block" />

            <div className="absolute -right-2 bottom-10 hidden h-32 w-32 rounded-full border border-purple-500/10 sm:block" />

            <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_25px_100px_rgba(0,0,0,0.65)]">
              <div className="absolute left-0 right-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80" />

              <video
                className="aspect-video w-full object-cover"
                src="/strikehub-logo-animation.mp4"
                autoPlay
                muted
                loop
                playsInline
              />

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />

              <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />

                <span className="text-[8px] font-bold tracking-[0.2em] text-white/50">
                  STRIKEHUB // LIVE
                </span>
              </div>

              <div className="absolute bottom-4 right-4 z-10 text-[8px] font-bold tracking-[0.2em] text-white/30">
                EST. COMPETITION
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          PROMOTIONS
          ========================================================= */}
      {promotions.length > 0 && (
        <section className="relative z-10 border-t border-white/[0.06] bg-black/30">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">

            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black tracking-[0.25em] text-orange-400">
                  SPONSORED
                </p>

                <h2 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
                  Featured{" "}
                  <span className="text-orange-400">
                    Promotions
                  </span>
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                  Discover promotions and offers from the STRIKEHUB community.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {promotions.map((promotion) => (
                <article
                  key={promotion.id}
                  className="group overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] transition duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:bg-white/[0.04]"
                >

                  {/* Promotion image */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-orange-950/40 via-black to-red-950/30">

                    {promotion.image_url ? (
                      <img
                        src={promotion.image_url}
                        alt={promotion.title}
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-950/50 via-black to-orange-950/40">
                        <span className="text-5xl font-black text-white/10">
                          AD
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                    {promotion.is_featured && (
                      <div className="absolute left-4 top-4">
                        <span className="rounded-full border border-orange-500/30 bg-orange-500/15 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-orange-300 backdrop-blur-md">
                          Featured
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/60">
                        {promotion.advertiser_name}
                      </p>

                      <h3 className="mt-1 line-clamp-2 text-xl font-black uppercase text-white">
                        {promotion.title}
                      </h3>
                    </div>
                  </div>

                  {/* Promotion content */}
                  <div className="p-5">

                    <p className="line-clamp-3 text-sm leading-6 text-zinc-400">
                      {promotion.description}
                    </p>

                    {promotion.expires_at && (
                      <div className="mt-4 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                        Ends {formatDate(promotion.expires_at)}
                      </div>
                    )}

                    <a
                      href={promotion.destination_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-xs font-black uppercase tracking-wider text-black transition hover:bg-orange-400"
                    >
                      VIEW PROMOTION →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* =========================================================
          COMMUNITY
          ========================================================= */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">

          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025]">

            <div className="grid lg:grid-cols-[1fr_0.9fr]">

              <div className="p-7 sm:p-10">
                <p className="text-xs font-black tracking-[0.25em] text-red-500">
                  JOIN THE COMMUNITY
                </p>

                <h2 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
                  Stay connected with{" "}
                  <span className="text-red-500">
                    STRIKEHUB.
                  </span>
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500 sm:text-base">
                  Join our WhatsApp and Discord communities for tournament
                  announcements, daily fun rooms, updates, discussions,
                  giveaways and more.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">

                  {/* WhatsApp */}
                  <a
                    href="https://chat.whatsapp.com/HTYOc2EROV881hQ51LyU3N?s=cl&p=a&mlu=4&ilr=4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 flex-1 items-center justify-center gap-3 rounded-xl bg-[#25D366] px-5 text-sm font-black text-black transition hover:brightness-110"
                  >
                    <span className="text-lg">
                      WhatsApp
                    </span>

                    <span className="text-xs">
                      →
                    </span>
                  </a>

                  {/* Discord */}
                  <a
                    href="https://discord.gg/q6AeV2C3Z4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 flex-1 items-center justify-center gap-3 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-5 text-sm font-black text-indigo-300 transition hover:bg-indigo-500/20"
                  >
                    <span className="text-lg">
                      Discord
                    </span>

                    <span className="text-xs">
                      →
                    </span>
                  </a>

                </div>
              </div>

              <div className="relative hidden min-h-[260px] overflow-hidden bg-gradient-to-br from-red-950/30 via-black to-purple-950/30 lg:block">

                <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[80px]" />

                <div className="absolute left-10 top-10 h-24 w-24 rounded-full border border-red-500/10" />

                <div className="absolute bottom-10 right-10 h-32 w-32 rounded-full border border-purple-500/10" />

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-5xl font-black italic text-white/10">
                      SH
                    </p>

                    <p className="mt-2 text-[9px] font-black tracking-[0.35em] text-white/20">
                      STRIKEHUB COMMUNITY
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Featured Tournament */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">

          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.25em] text-red-500">
                STRIKEHUB EVENTS
              </p>

              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
                Featured{" "}
                <span className="text-red-500">
                  Tournament
                </span>
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                The tournament currently taking center stage on STRIKEHUB.
              </p>
            </div>

            <Link
              href="/tournaments"
              className="text-sm font-black text-zinc-400 transition hover:text-red-400"
            >
              VIEW ALL TOURNAMENTS →
            </Link>
          </div>

          {featuredTournament ? (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] shadow-[0_25px_100px_rgba(0,0,0,0.35)]">

              <div className="grid lg:grid-cols-[0.9fr_1.1fr]">

                {/* Featured image */}
                <div className="relative min-h-[260px] overflow-hidden bg-gradient-to-br from-red-950/40 via-black to-purple-950/30 lg:min-h-[390px]">

                  {featuredTournament.image_url ? (
                    <img
                      src={featuredTournament.image_url}
                      alt={featuredTournament.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0">
                      <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[70px]" />

                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15),transparent_55%)]" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                  <div className="absolute left-5 top-5">
                    {featuredStatus && (
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black tracking-[0.16em] ${featuredStatus.className}`}
                      >
                        {featuredStatus.dot && (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                        )}

                        {featuredStatus.label}
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-5 left-5 right-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                      {featuredTournament.tournament_type ||
                        "TOURNAMENT"}
                    </p>

                    <h3 className="mt-2 text-2xl font-black uppercase sm:text-3xl">
                      {featuredTournament.name}
                    </h3>
                  </div>
                </div>

                {/* Featured details */}
                <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">

                  <div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                      <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                          Prize
                        </p>

                        <p className="mt-1 text-lg font-black text-yellow-400">
                          {featuredTournament.prize_gold ?? 0} Gold
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                          Game Mode
                        </p>

                        <p className="mt-1 text-sm font-black text-white">
                          {featuredTournament.game_mode || "TBA"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                          Map
                        </p>

                        <p className="mt-1 text-sm font-black text-white">
                          {featuredTournament.map || "TBA"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                          Players
                        </p>

                        <p className="mt-1 text-sm font-black text-white">
                          {featuredRegistrationCount}
                          {featuredTournament.max_players
                            ? ` / ${featuredTournament.max_players}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                        Starts
                      </p>

                      <p className="mt-1 text-base font-bold text-white">
                        {formatDate(
                          featuredTournament.starts_at
                        )}
                      </p>
                    </div>

                    {featuredTournament.description && (
                      <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-500">
                        {featuredTournament.description}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">

                      {featuredTournament.device_restriction && (
                        <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                          {featuredTournament.device_restriction}
                        </span>
                      )}

                      {featuredTournament.max_players && (
                        <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                          Up to{" "}
                          {featuredTournament.max_players}{" "}
                          Players
                        </span>
                      )}

                      {featuredTournament.max_teams && (
                        <span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                          Up to{" "}
                          {featuredTournament.max_teams}{" "}
                          Teams
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">

                    <Link
                      href={`/tournaments/${featuredTournament.id}`}
                      className="flex h-12 flex-1 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-black tracking-wide transition hover:bg-red-500"
                    >
                      VIEW TOURNAMENT
                    </Link>

                    {featuredTournament.live_stream_url ? (
                      <a
                        href={featuredTournament.live_stream_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 text-sm font-black tracking-wide text-red-400 transition hover:bg-red-500/15"
                      >
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        WATCH LIVE
                      </a>
                    ) : (
                      <Link
                        href={`/tournaments/${featuredTournament.id}`}
                        className="flex h-12 flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black tracking-wide transition hover:border-red-500/30 hover:bg-white/[0.07]"
                      >
                        {featuredTournament.registration_open
                          ? "REGISTER NOW"
                          : "VIEW DETAILS"}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] px-6 py-16 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-2xl">
                ⚔
              </div>

              <h3 className="mt-5 text-xl font-black uppercase">
                No Featured Tournament Yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Check back soon for the next STRIKEHUB competition.
              </p>

              <Link
                href="/tournaments"
                className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black transition hover:border-red-500/30"
              >
                EXPLORE TOURNAMENTS
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Active & Upcoming Tournaments */}
      <section className="relative z-10 border-t border-white/[0.06] bg-black/20">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">

          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.25em] text-red-500">
                ON THE BATTLEFIELD
              </p>

              <h2 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
                Active &{" "}
                <span className="text-red-500">
                  Upcoming
                </span>
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                Find your next competition and get ready to rise through the
                ranks.
              </p>
            </div>

            <Link
              href="/tournaments"
              className="text-sm font-black text-zinc-400 transition hover:text-red-400"
            >
              VIEW ALL TOURNAMENTS →
            </Link>
          </div>

          {activeTournaments.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

              {activeTournaments.map((tournament) => {
                const status = getStatus(tournament);

                const limit =
                  tournament.max_players ||
                  tournament.max_teams ||
                  null;

                return (
                  <article
                    key={tournament.id}
                    className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] transition duration-300 hover:-translate-y-1 hover:border-red-500/20 hover:bg-white/[0.04]"
                  >

                    {/* Card image */}
                    <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-red-950/40 via-black to-purple-950/30">

                      {tournament.image_url ? (
                        <img
                          src={tournament.image_url}
                          alt={tournament.name}
                          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15),transparent_55%)]">
                          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[50px]" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                      <div className="absolute left-4 top-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-black tracking-[0.14em] ${status.className}`}
                        >
                          {status.dot && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                          )}

                          {status.label}
                        </span>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4">
                        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">
                          {tournament.tournament_type ||
                            "TOURNAMENT"}
                        </p>

                        <h3 className="mt-1 line-clamp-2 text-xl font-black uppercase">
                          {tournament.name}
                        </h3>
                      </div>
                    </div>

                    {/* Card details */}
                    <div className="p-5">

                      <div className="grid grid-cols-2 gap-2">

                        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                            Prize
                          </p>

                          <p className="mt-1 text-sm font-black text-yellow-400">
                            {tournament.prize_gold ?? 0} Gold
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
                          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                            Players
                          </p>

                          <p className="mt-1 text-sm font-black text-white">
                            {tournament.registration_count}
                            {limit ? ` / ${limit}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">

                        <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-[9px] font-bold uppercase text-zinc-500">
                          {tournament.game_mode || "TBA"}
                        </span>

                        <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-[9px] font-bold uppercase text-zinc-500">
                          {tournament.map || "MAP TBA"}
                        </span>

                        {tournament.device_restriction && (
                          <span className="rounded-lg border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-[9px] font-bold uppercase text-zinc-500">
                            {tournament.device_restriction}
                          </span>
                        )}
                      </div>

                      <div className="mt-4">
                        <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                          Starts
                        </p>

                        <p className="mt-1 text-xs font-bold text-zinc-300">
                          {formatDate(tournament.starts_at)}
                        </p>
                      </div>

                      <div className="mt-5 flex gap-2">

                        <Link
                          href={`/tournaments/${tournament.id}`}
                          className="flex h-10 flex-1 items-center justify-center rounded-xl bg-red-600 px-3 text-[10px] font-black tracking-wide transition hover:bg-red-500"
                        >
                          VIEW TOURNAMENT
                        </Link>

                        {tournament.live_stream_url && (
                          <a
                            href={tournament.live_stream_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3 text-[10px] font-black tracking-wide text-red-400 transition hover:bg-red-500/15"
                          >
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                            LIVE
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-6 py-14 text-center">

              <p className="text-sm font-bold text-zinc-500">
                No additional active or upcoming tournaments right now.
              </p>

              <Link
                href="/tournaments"
                className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-black transition hover:border-red-500/30"
              >
                VIEW TOURNAMENTS
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Foundation cards */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">

          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-black tracking-[0.25em] text-red-500">
              BUILT FOR COMPETITORS
            </p>

            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl">
              Everything you need to{" "}
              <span className="text-red-500">
                rise.
              </span>
            </h2>

            <p className="mt-4 text-sm leading-6 text-zinc-500 sm:text-base">
              STRIKEHUB brings tournaments, rewards, rankings, community and
              competitive gaming into one platform.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">

            <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-red-500/20 hover:bg-white/[0.04]">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-lg text-red-400">
                ⚔
              </div>

              <h3 className="text-lg font-black">
                COMPETE
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Enter tournaments, battle other players and prove yourself on
                the leaderboard.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-orange-500/20 hover:bg-white/[0.04]">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-lg text-orange-400">
                ◆
              </div>

              <h3 className="text-lg font-black">
                EARN
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Earn Gold through tournaments, tasks, daily activity,
                referrals and other platform rewards.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition hover:-translate-y-1 hover:border-purple-500/20 hover:bg-white/[0.04]">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-lg text-purple-400">
                ▲
              </div>

              <h3 className="text-lg font-black">
                RISE
              </h3>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Build your record, climb the rankings and establish your name
                in the STRIKEHUB community.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">

          <div>
            <div className="text-sm font-black tracking-[0.18em]">
              STRIKE<span className="text-red-500">
                HUB
              </span>
            </div>

            <p className="mt-1 text-xs text-zinc-600">
              COMPETE. EARN. RISE.
            </p>
          </div>

          <div className="flex flex-wrap gap-5 text-xs font-semibold text-zinc-500">

            <Link
              href="/tournaments"
              className="transition hover:text-white"
            >
              Tournaments
            </Link>

            <Link
              href="/dashboard/leaderboard"
              className="transition hover:text-white"
            >
              Leaderboard
            </Link>

            <Link
              href="/dashboard"
              className="transition hover:text-white"
            >
              Community
            </Link>

            <a
              href="https://chat.whatsapp.com/HTYOc2EROV881hQ51LyU3N?s=cl&p=a&mlu=4&ilr=4"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-[#25D366]"
            >
              WhatsApp
            </a>

            <a
              href="https://discord.gg/q6AeV2C3Z4"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-indigo-400"
            >
              Discord
            </a>

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
          </div>
        </div>

        <div className="border-t border-white/[0.04] py-4 text-center text-[10px] text-zinc-700">
          © {new Date().getFullYear()} STRIKEHUB. All rights reserved.
        </div>
      </footer>
    </main>
  );
}