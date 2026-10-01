"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LeaderboardPlayer = {
  id?: string;
  user_id?: string;
  bloodstrike_uid?: string | null;
  in_game_name?: string | null;
  display_name?: string | null;
  profile_image_url?: string | null;
  points?: number | null;
  matches_won?: number | null;
  total_kills?: number | null;
};

const supabase = createClient();

export default function AdminLeaderboardPage() {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<
    "points" | "matches_won" | "total_kills"
  >("points");

  async function loadLeaderboard() {
    setLoading(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc(
      "get_leaderboard"
    );

    if (rpcError) {
      setError(rpcError.message);
      setPlayers([]);
      setLoading(false);
      return;
    }

    setPlayers((data || []) as LeaderboardPlayer[]);
    setLoading(false);
  }

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = [...players];

    if (query) {
      result = result.filter((player) => {
        const name = (
          player.in_game_name ||
          player.display_name ||
          ""
        ).toLowerCase();

        const uid = String(player.bloodstrike_uid || "").toLowerCase();

        return name.includes(query) || uid.includes(query);
      });
    }

    result.sort((a, b) => {
      if (sortBy === "matches_won") {
        return (
          Number(b.matches_won || 0) -
          Number(a.matches_won || 0)
        );
      }

      if (sortBy === "total_kills") {
        return (
          Number(b.total_kills || 0) -
          Number(a.total_kills || 0)
        );
      }

      return Number(b.points || 0) - Number(a.points || 0);
    });

    return result;
  }, [players, search, sortBy]);

  const totalPoints = players.reduce(
    (sum, player) => sum + Number(player.points || 0),
    0
  );

  const totalKills = players.reduce(
    (sum, player) => sum + Number(player.total_kills || 0),
    0
  );

  const totalWins = players.reduce(
    (sum, player) => sum + Number(player.matches_won || 0),
    0
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
              Admin
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Leaderboard
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              View player points, wins and kills across STRIKEHUB.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/admin"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800"
            >
              ← Back to Admin
            </a>

            <button
              onClick={loadLeaderboard}
              disabled={loading}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Players Ranked"
            value={players.length.toLocaleString("en-NG")}
          />

          <StatCard
            label="Total Points"
            value={totalPoints.toLocaleString("en-NG")}
          />

          <StatCard
            label="Total Wins"
            value={totalWins.toLocaleString("en-NG")}
          />

          <StatCard
            label="Total Kills"
            value={totalKills.toLocaleString("en-NG")}
          />
        </div>

        {/* Controls */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Search Player
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by in-game name or BloodStrike UID..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-300">
                Sort By
              </label>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value as
                      | "points"
                      | "matches_won"
                      | "total_kills"
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-red-500 md:min-w-[180px]"
              >
                <option value="points">Points</option>
                <option value="matches_won">Wins</option>
                <option value="total_kills">Kills</option>
              </select>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
            Loading leaderboard...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="font-semibold text-white">
              No players found.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Try another search or refresh the leaderboard.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-zinc-800 bg-zinc-950">
                  <tr>
                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Rank
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Player
                    </th>

                    <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-zinc-500">
                      BloodStrike UID
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Points
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Wins
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Kills
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPlayers.map((player, index) => {
                    const name =
                      player.in_game_name ||
                      player.display_name ||
                      "Unknown Player";

                    const points = Number(player.points || 0);
                    const wins = Number(player.matches_won || 0);
                    const kills = Number(player.total_kills || 0);

                    return (
                      <tr
                        key={
                          player.id ||
                          player.user_id ||
                          player.bloodstrike_uid ||
                          `${name}-${index}`
                        }
                        className="border-b border-zinc-800/70 transition hover:bg-zinc-800/40"
                      >
                        <td className="px-5 py-4">
                          <RankBadge rank={index + 1} />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {player.profile_image_url ? (
                              <img
                                src={player.profile_image_url}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-400">
                                {name
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}

                            <div>
                              <p className="font-semibold text-white">
                                {name}
                              </p>

                              {player.display_name &&
                                player.in_game_name &&
                                player.display_name !==
                                  player.in_game_name && (
                                  <p className="text-xs text-zinc-500">
                                    {player.display_name}
                                  </p>
                                )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-zinc-400">
                          {player.bloodstrike_uid || "—"}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className="font-bold text-yellow-400">
                            {points.toLocaleString("en-NG")}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-zinc-200">
                          {wins.toLocaleString("en-NG")}
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-zinc-200">
                          {kills.toLocaleString("en-NG")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-zinc-800 px-5 py-4 text-sm text-zinc-500">
              Showing {filteredPlayers.length.toLocaleString("en-NG")}{" "}
              player
              {filteredPlayers.length === 1 ? "" : "s"}.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">{label}</p>

      <p className="mt-2 text-2xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500/15 font-bold text-yellow-400">
        1
      </span>
    );
  }

  if (rank === 2) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-500/15 font-bold text-zinc-300">
        2
      </span>
    );
  }

  if (rank === 3) {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 font-bold text-orange-400">
        3
      </span>
    );
  }

  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-400">
      {rank}
    </span>
  );
}