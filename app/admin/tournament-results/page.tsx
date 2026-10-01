'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Tournament = {
  id: string
  name: string
  game_mode: string
  tournament_type: string
  map: string
  prize_gold: number
  status: string
  starts_at: string
}

type Player = {
  id: string
  bloodstrike_uid: string
  in_game_name: string | null
  display_name: string | null
}

type Team = {
  id: string
  name: string
  tournament_id: string
}

type Result = {
  id: string
  tournament_id: string
  user_id: string
  team_id: string | null
  placement: number
  kills: number
  points_awarded: number
  gold_awarded: number
  participation_approved: boolean
  reward_paid: boolean
  notes: string | null
}

type ResultRow = {
  player: Player
  team: Team | null
  result: Result | null
}

type TeamMemberRow = {
  team_id: string
  user_id: string
}

export default function TournamentResultsPage() {
  const supabase = createClient()

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState('')

  const [rows, setRows] = useState<ResultRow[]>([])

  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadingPlayers, setLoadingPlayers] = useState(false)

  const [savingId, setSavingId] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')

  const [resultFilter, setResultFilter] = useState<
    'all' | 'no_result' | 'pending' | 'approved' | 'paid'
  >('all')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  /*
   * Temporary form values are stored separately from the
   * database result so the admin can edit several players
   * before saving.
   */
  const [formValues, setFormValues] = useState<
    Record<
      string,
      {
        placement: string
        kills: string
        points: string
        gold: string
        approved: boolean
        notes: string
      }
    >
  >({})

  /*
   * --------------------------------------------------------
   * LOAD TOURNAMENTS
   * --------------------------------------------------------
   */

  async function loadTournaments() {
  setLoadingTournaments(true)
  setError('')

  const { data, error: loadError } =
    await supabase.rpc(
      'admin_get_tournaments_for_results'
    )

  if (loadError) {
    setError(loadError.message)
    setTournaments([])
  } else {
    setTournaments((data || []) as Tournament[])
  }

  setLoadingTournaments(false)
}

  useEffect(() => {
    loadTournaments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
   * --------------------------------------------------------
   * LOAD TOURNAMENT PARTICIPANTS + RESULTS
   * --------------------------------------------------------
   */

  async function loadTournamentData(tournamentId: string) {
    if (!tournamentId) {
      setRows([])
      setFormValues({})
      return
    }

    setLoadingPlayers(true)
    setError('')
    setMessage('')

    const tournament = tournaments.find(
      (item) => item.id === tournamentId
    )

    if (!tournament) {
      setLoadingPlayers(false)
      return
    }

    try {
      /*
       * First load existing results.
       */
      const { data: resultData, error: resultError } =
        await supabase
          .from('match_results')
          .select(
            'id, tournament_id, user_id, team_id, placement, kills, points_awarded, gold_awarded, participation_approved, reward_paid, notes'
          )
          .eq('tournament_id', tournamentId)

      if (resultError) {
        throw new Error(resultError.message)
      }

      const existingResults = (resultData || []) as Result[]

      /*
       * ------------------------------------------------------
       * SOLO
       * ------------------------------------------------------
       */

      if (tournament.game_mode === 'solo') {
        const {
          data: registrations,
          error: registrationError,
        } = await supabase
          .from('tournament_registrations')
          .select('user_id, status')
          .eq('tournament_id', tournamentId)

        if (registrationError) {
          throw new Error(registrationError.message)
        }

        const validRegistrations = (
          registrations || []
        ).filter((registration) => {
          const status = String(
            registration.status || 'registered'
          ).toLowerCase()

          return !['cancelled', 'rejected'].includes(status)
        })

        const userIds = validRegistrations.map(
          (registration) => registration.user_id
        )

        if (userIds.length === 0) {
          setRows([])
          setFormValues({})
          setLoadingPlayers(false)
          return
        }

        const { data: profiles, error: profileError } =
          await supabase
            .from('profiles')
            .select(
              'id, bloodstrike_uid, in_game_name, display_name'
            )
            .in('id', userIds)

        if (profileError) {
          throw new Error(profileError.message)
        }

        const profileList = (profiles || []) as Player[]

        const newRows: ResultRow[] = profileList.map(
          (player) => ({
            player,
            team: null,
            result:
              existingResults.find(
                (result) => result.user_id === player.id
              ) || null,
          })
        )

        setRows(newRows)

        const newForms: Record<
          string,
          {
            placement: string
            kills: string
            points: string
            gold: string
            approved: boolean
            notes: string
          }
        > = {}

        for (const row of newRows) {
          const result = row.result

          newForms[row.player.id] = {
            placement:
              result?.placement !== undefined
                ? String(result.placement)
                : '',
            kills:
              result?.kills !== undefined
                ? String(result.kills)
                : '',
            points:
              result?.points_awarded !== undefined
                ? String(result.points_awarded)
                : '',
            gold:
              result?.gold_awarded !== undefined
                ? String(result.gold_awarded)
                : '',
            approved:
              result?.participation_approved || false,
            notes: result?.notes || '',
          }
        }

        setFormValues(newForms)
        setLoadingPlayers(false)
        return
      }

      /*
       * ------------------------------------------------------
       * TEAM TOURNAMENT
       * ------------------------------------------------------
       */

      const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('id, name, tournament_id')
        .eq('tournament_id', tournamentId)

      if (teamError) {
        throw new Error(teamError.message)
      }

      const teamList = (teams || []) as Team[]

      if (teamList.length === 0) {
        setRows([])
        setFormValues({})
        setLoadingPlayers(false)
        return
      }

      const teamIds = teamList.map((team) => team.id)

      const {
        data: members,
        error: memberError,
      } = await supabase
        .from('team_members')
        .select('team_id, user_id')
        .in('team_id', teamIds)

      if (memberError) {
        throw new Error(memberError.message)
      }

      const memberList = (members || []) as TeamMemberRow[]

      const userIds = Array.from(
        new Set(memberList.map((member) => member.user_id))
      )

      if (userIds.length === 0) {
        setRows([])
        setFormValues({})
        setLoadingPlayers(false)
        return
      }

      const { data: profiles, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id, bloodstrike_uid, in_game_name, display_name'
          )
          .in('id', userIds)

      if (profileError) {
        throw new Error(profileError.message)
      }

      const profileList = (profiles || []) as Player[]

      const newRows: ResultRow[] = []

      for (const member of memberList) {
        const player = profileList.find(
          (profile) => profile.id === member.user_id
        )

        if (!player) continue

        const team =
          teamList.find(
            (item) => item.id === member.team_id
          ) || null

        const result =
          existingResults.find(
            (item) => item.user_id === player.id
          ) || null

        newRows.push({
          player,
          team,
          result,
        })
      }

      setRows(newRows)

      const newForms: Record<
        string,
        {
          placement: string
          kills: string
          points: string
          gold: string
          approved: boolean
          notes: string
        }
      > = {}

      for (const row of newRows) {
        const result = row.result

        newForms[row.player.id] = {
          placement:
            result?.placement !== undefined
              ? String(result.placement)
              : '',
          kills:
            result?.kills !== undefined
              ? String(result.kills)
              : '',
          points:
            result?.points_awarded !== undefined
              ? String(result.points_awarded)
              : '',
          gold:
            result?.gold_awarded !== undefined
              ? String(result.gold_awarded)
              : '',
          approved:
            result?.participation_approved || false,
          notes: result?.notes || '',
        }
      }

      setFormValues(newForms)
    } catch (loadError) {
      setRows([])
      setFormValues({})

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load tournament participants.'
      )
    }

    setLoadingPlayers(false)
  }

  useEffect(() => {
    loadTournamentData(selectedTournamentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTournamentId])

  /*
   * --------------------------------------------------------
   * UPDATE FORM
   * --------------------------------------------------------
   */

  function updateForm(
    userId: string,
    field:
      | 'placement'
      | 'kills'
      | 'points'
      | 'gold'
      | 'approved'
      | 'notes',
    value: string | boolean
  ) {
    setFormValues((current) => ({
      ...current,
      [userId]: {
        placement: current[userId]?.placement || '',
        kills: current[userId]?.kills || '',
        points: current[userId]?.points || '',
        gold: current[userId]?.gold || '',
        approved: current[userId]?.approved || false,
        notes: current[userId]?.notes || '',
        [field]: value,
      },
    }))
  }

  /*
   * --------------------------------------------------------
   * SAVE RESULT
   * --------------------------------------------------------
   */

  async function saveResult(row: ResultRow) {
    if (!selectedTournamentId) {
      setError('Select a tournament first.')
      return
    }

    const form = formValues[row.player.id]

    if (!form) {
      setError('Result form could not be loaded.')
      return
    }

    if (row.result?.reward_paid) {
      setError(
        'This reward has already been paid. Paid results cannot be edited.'
      )
      return
    }

    const placement =
      form.placement.trim() === ''
        ? 0
        : Number(form.placement)

    const kills =
      form.kills.trim() === ''
        ? 0
        : Number(form.kills)

    const points =
      form.points.trim() === ''
        ? 0
        : Number(form.points)

    const gold =
      form.gold.trim() === ''
        ? 0
        : Number(form.gold)

    if (
      !Number.isInteger(placement) ||
      placement < 0
    ) {
      setError(
        `${row.player.in_game_name || row.player.display_name || row.player.bloodstrike_uid}: placement must be a whole number.`
      )
      return
    }

    if (!Number.isInteger(kills) || kills < 0) {
      setError(
        `${row.player.in_game_name || row.player.display_name || row.player.bloodstrike_uid}: kills must be a whole number.`
      )
      return
    }

    if (!Number.isInteger(points) || points < 0) {
      setError(
        `${row.player.in_game_name || row.player.display_name || row.player.bloodstrike_uid}: points must be a whole number.`
      )
      return
    }

    if (!Number.isInteger(gold) || gold < 0) {
      setError(
        `${row.player.in_game_name || row.player.display_name || row.player.bloodstrike_uid}: Gold must be a whole number.`
      )
      return
    }

    setSavingId(row.player.id)
    setError('')
    setMessage('')

    const { data, error: saveError } =
      await supabase.rpc(
        'admin_save_match_result',
        {
          p_tournament_id: selectedTournamentId,
          p_user_id: row.player.id,
          p_team_id: row.team?.id || null,
          p_placement: placement,
          p_kills: kills,
          p_points_awarded: points,
          p_gold_awarded: gold,
          p_participation_approved:
            form.approved,
          p_notes:
            form.notes.trim() || null,
        }
      )

    setSavingId(null)

    if (saveError) {
      setError(saveError.message)
      return
    }

    if (!data?.success) {
      setError('The result could not be saved.')
      return
    }

    setMessage(
      `Result saved for ${
        row.player.in_game_name ||
        row.player.display_name ||
        row.player.bloodstrike_uid
      }.`
    )

    await loadTournamentData(selectedTournamentId)
  }

  /*
   * --------------------------------------------------------
   * PAY REWARD
   * --------------------------------------------------------
   */

  async function payReward(row: ResultRow) {
    if (!row.result) {
      setError('Save the result before paying the reward.')
      return
    }

    if (!row.result.participation_approved) {
      setError(
        'Participation must be approved before paying the reward.'
      )
      return
    }

    if (row.result.reward_paid) {
      setError('This reward has already been paid.')
      return
    }

    const playerName =
      row.player.in_game_name ||
      row.player.display_name ||
      row.player.bloodstrike_uid

    const confirmed = window.confirm(
      `Pay ${Number(
        row.result.gold_awarded
      ).toLocaleString()} Gold to ${playerName}?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    setPayingId(row.player.id)
    setError('')
    setMessage('')

    const { data, error: payError } =
      await supabase.rpc(
        'admin_pay_match_reward',
        {
          p_result_id: row.result.id,
        }
      )

    setPayingId(null)

    if (payError) {
      setError(payError.message)
      return
    }

    if (!data?.success) {
      setError('The reward could not be paid.')
      return
    }

    setMessage(
      `${Number(
        data.gold_awarded || 0
      ).toLocaleString()} Gold paid to ${playerName}.`
    )

    await loadTournamentData(selectedTournamentId)
  }

  /*
   * --------------------------------------------------------
   * FILTER
   * --------------------------------------------------------
   */

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    let filtered = rows

    if (resultFilter === 'no_result') {
      filtered = filtered.filter(
        (row) => !row.result
      )
    }

    if (resultFilter === 'pending') {
      filtered = filtered.filter(
        (row) =>
          row.result &&
          !row.result.participation_approved &&
          !row.result.reward_paid
      )
    }

    if (resultFilter === 'approved') {
      filtered = filtered.filter(
        (row) =>
          row.result &&
          row.result.participation_approved &&
          !row.result.reward_paid
      )
    }

    if (resultFilter === 'paid') {
      filtered = filtered.filter(
        (row) => row.result?.reward_paid
      )
    }

    if (!query) return filtered

    return filtered.filter((row) => {
      const values = [
        row.player.bloodstrike_uid,
        row.player.in_game_name,
        row.player.display_name,
        row.team?.name,
      ]

      return values.some((value) =>
        value?.toLowerCase().includes(query)
      )
    })
  }, [rows, search, resultFilter])

  const selectedTournament = tournaments.find(
    (tournament) =>
      tournament.id === selectedTournamentId
  )

  /*
   * --------------------------------------------------------
   * COUNTS
   * --------------------------------------------------------
   */

  const resultCount = rows.filter(
    (row) => row.result
  ).length

  const approvedCount = rows.filter(
    (row) => row.result?.participation_approved
  ).length

  const paidCount = rows.filter(
    (row) => row.result?.reward_paid
  ).length

  const pendingCount = rows.filter(
    (row) =>
      row.result &&
      !row.result.participation_approved &&
      !row.result.reward_paid
  ).length

  const approvedUnpaidCount = rows.filter(
    (row) =>
      row.result?.participation_approved &&
      !row.result.reward_paid
  ).length

  const totalGoldToDistribute = rows.reduce(
    (total, row) =>
      total + Number(row.result?.gold_awarded || 0),
    0
  )

  const totalGoldPaid = rows.reduce(
    (total, row) =>
      total +
      (row.result?.reward_paid
        ? Number(row.result.gold_awarded || 0)
        : 0),
    0
  )

  const pendingGold = Math.max(
    totalGoldToDistribute - totalGoldPaid,
    0
  )

  /*
   * --------------------------------------------------------
   * FORMATTERS
   * --------------------------------------------------------
   */

  function formatDate(date: string) {
    try {
      return new Date(date).toLocaleString(
        undefined,
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      )
    } catch {
      return date
    }
  }

  function formatMode(mode: string) {
    return mode
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  }

  /*
   * --------------------------------------------------------
   * RENDER
   * --------------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* Header */}
      <header className="border-b border-red-900/30 bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-red-500">
              STRIKEHUB
            </p>

            <h1 className="mt-1 text-2xl font-black">
              TOURNAMENT RESULTS
            </h1>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
          >
            Back to Admin
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        {/* Heading */}
        <div className="mb-8">
          <p className="text-sm text-gray-400">
            Enter match results, approve participation,
            and pay tournament rewards.
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Results & Rewards
          </h2>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-green-900/40 bg-green-950/20 p-4 text-sm text-green-400">
            {message}
          </div>
        )}

        {/* Tournament Selector */}
        <div className="mb-8 rounded-2xl border border-red-900/30 bg-[#101010] p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-400">
                Select Tournament
              </label>

              <select
                value={selectedTournamentId}
                onChange={(e) => {
                  setSelectedTournamentId(
                    e.target.value
                  )
                  setSearch('')
                  setResultFilter('all')
                  setError('')
                  setMessage('')
                }}
                disabled={loadingTournaments}
                className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
              >
                <option value="">
                  {loadingTournaments
                    ? 'Loading tournaments...'
                    : 'Select a tournament'}
                </option>

                {tournaments.map((tournament) => (
                  <option
                    key={tournament.id}
                    value={tournament.id}
                  >
                    {tournament.name} —{' '}
                    {formatMode(
                      tournament.game_mode
                    )}{' '}
                    — {tournament.status}
                  </option>
                ))}
              </select>
            </div>

            {selectedTournament && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Tournament Start
                </p>

                <p className="mt-1 font-semibold">
                  {formatDate(
                    selectedTournament.starts_at
                  )}
                </p>
              </div>
            )}
          </div>

          {selectedTournament && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500">
                  Game Mode
                </p>

                <p className="mt-1 font-bold">
                  {formatMode(
                    selectedTournament.game_mode
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500">
                  Map
                </p>

                <p className="mt-1 font-bold">
                  {selectedTournament.map}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500">
                  Participants
                </p>

                <p className="mt-1 font-bold">
                  {rows.length}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500">
                  Approved
                </p>

                <p className="mt-1 font-bold text-green-400">
                  {approvedCount}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500">
                  Rewards Paid
                </p>

                <p className="mt-1 font-bold text-yellow-400">
                  {paidCount}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500">
                  Total Gold
                </p>

                <p className="mt-1 font-bold text-yellow-400">
                  {totalGoldToDistribute.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500">
                  Gold Paid
                </p>

                <p className="mt-1 font-bold text-green-400">
                  {totalGoldPaid.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-xs text-gray-500">
                  Gold Pending
                </p>

                <p className="mt-1 font-bold text-yellow-400">
                  {pendingGold.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* No Tournament */}
        {!selectedTournamentId && (
          <div className="rounded-2xl border border-white/10 bg-[#101010] p-12 text-center">
            <div className="text-5xl">🏆</div>

            <h3 className="mt-5 text-xl font-black">
              Select a Tournament
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              Choose a tournament above to load its
              registered players and enter their match
              results.
            </p>
          </div>
        )}

        {/* Loading */}
        {selectedTournamentId &&
          loadingPlayers && (
            <div className="rounded-2xl border border-white/10 bg-[#101010] p-12 text-center">
              <div className="text-4xl">⏳</div>

              <p className="mt-4 font-semibold text-gray-400">
                Loading tournament participants...
              </p>
            </div>
          )}

        {/* Participants */}
        {selectedTournamentId &&
          !loadingPlayers && (
            <div className="rounded-2xl border border-white/10 bg-[#101010]">
              <div className="border-b border-white/10 p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-xl font-black">
                        Participants & Results
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {resultCount} of {rows.length}{' '}
                        participants have saved results.
                      </p>
                    </div>

                    <input
                      value={search}
                      onChange={(e) =>
                        setSearch(e.target.value)
                      }
                      placeholder="Search UID, player or team..."
                      className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-500 lg:w-80"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      ['all', 'All'],
                      ['no_result', 'No Result'],
                      ['pending', 'Pending Approval'],
                      ['approved', 'Approved'],
                      ['paid', 'Paid'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setResultFilter(
                            value as
                              | 'all'
                              | 'no_result'
                              | 'pending'
                              | 'approved'
                              | 'paid'
                          )
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                          resultFilter === value
                            ? 'bg-red-600 text-white'
                            : 'border border-white/10 bg-white/[0.03] text-gray-400 hover:bg-white/[0.07]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl">👥</div>

                  <p className="mt-4 font-bold">
                    No participants found
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    This tournament currently has no
                    registered participants or teams.
                  </p>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  No participants match your search.
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {filteredRows.map((row) => {
                    const form =
                      formValues[row.player.id] || {
                        placement: '',
                        kills: '',
                        points: '',
                        gold: '',
                        approved: false,
                        notes: '',
                      }

                    const paid =
                      row.result?.reward_paid || false

                    const saved =
                      !!row.result

                    const playerName =
                      row.player.in_game_name ||
                      row.player.display_name ||
                      'Unknown Player'

                    return (
                      <div
                        key={`${row.player.id}-${row.team?.id || 'solo'}`}
                        className="p-6"
                      >
                        {/* Player Header */}
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-lg font-black">
                                {playerName}
                              </h4>

                              {row.team && (
                                <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-400">
                                  {row.team.name}
                                </span>
                              )}

                              {paid && (
                                <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold uppercase text-green-400">
                                  Reward Paid
                                </span>
                              )}

                              {!paid &&
                                row.result
                                  ?.participation_approved && (
                                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase text-blue-400">
                                    Approved
                                  </span>
                                )}

                              {!saved && (
                                <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase text-yellow-400">
                                  No Result
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-gray-500">
                              UID:{' '}
                              <span className="font-mono text-gray-400">
                                {row.player.bloodstrike_uid}
                              </span>
                            </p>
                          </div>

                          {/* Existing Result Summary */}
                          {row.result && (
                            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                              <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                                <p className="text-[10px] uppercase text-gray-500">
                                  Place
                                </p>
                                <p className="font-black">
                                  #{row.result.placement}
                                </p>
                              </div>

                              <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                                <p className="text-[10px] uppercase text-gray-500">
                                  Kills
                                </p>
                                <p className="font-black">
                                  {row.result.kills}
                                </p>
                              </div>

                              <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                                <p className="text-[10px] uppercase text-gray-500">
                                  Points
                                </p>
                                <p className="font-black">
                                  {row.result.points_awarded}
                                </p>
                              </div>

                              <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                                <p className="text-[10px] uppercase text-gray-500">
                                  Gold
                                </p>
                                <p className="font-black text-yellow-400">
                                  {Number(
                                    row.result.gold_awarded
                                  ).toLocaleString()}
                                </p>
                              </div>

                              <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                                <p className="text-[10px] uppercase text-gray-500">
                                  Status
                                </p>
                                <p
                                  className={
                                    paid
                                      ? 'font-black text-green-400'
                                      : 'font-black text-yellow-400'
                                  }
                                >
                                  {paid
                                    ? 'PAID'
                                    : 'PENDING'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Result Form */}
                        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                              Placement
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={form.placement}
                              disabled={paid}
                              onChange={(e) =>
                                updateForm(
                                  row.player.id,
                                  'placement',
                                  e.target.value
                                )
                              }
                              placeholder="1"
                              className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                              Kills
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={form.kills}
                              disabled={paid}
                              onChange={(e) =>
                                updateForm(
                                  row.player.id,
                                  'kills',
                                  e.target.value
                                )
                              }
                              placeholder="0"
                              className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                              Points
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={form.points}
                              disabled={paid}
                              onChange={(e) =>
                                updateForm(
                                  row.player.id,
                                  'points',
                                  e.target.value
                                )
                              }
                              placeholder="0"
                              className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                              Gold Reward
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={form.gold}
                              disabled={paid}
                              onChange={(e) =>
                                updateForm(
                                  row.player.id,
                                  'gold',
                                  e.target.value
                                )
                              }
                              placeholder="0"
                              className="w-full rounded-lg border border-yellow-900/30 bg-[#080808] px-4 py-3 text-yellow-300 outline-none focus:border-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </div>
                        </div>

                        {/* Approval + Notes */}
                        <div className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr]">
                          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                            <input
                              type="checkbox"
                              checked={form.approved}
                              disabled={paid}
                              onChange={(e) =>
                                updateForm(
                                  row.player.id,
                                  'approved',
                                  e.target.checked
                                )
                              }
                              className="h-5 w-5"
                            />

                            <span className="text-sm font-semibold">
                              Participation Approved
                            </span>
                          </label>

                          <input
                            value={form.notes}
                            disabled={paid}
                            onChange={(e) =>
                              updateForm(
                                row.player.id,
                                'notes',
                                e.target.value
                              )
                            }
                            placeholder="Optional admin note..."
                            className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>

                        {/* Actions */}
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              saveResult(row)
                            }
                            disabled={
                              paid ||
                              savingId === row.player.id ||
                              payingId === row.player.id
                            }
                            className="rounded-lg bg-red-600 px-5 py-3 text-sm font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingId ===
                            row.player.id
                              ? 'Saving...'
                              : saved
                                ? 'Update Result'
                                : 'Save Result'}
                          </button>

                          {row.result && (
                            <button
                              type="button"
                              onClick={() =>
                                payReward(row)
                              }
                              disabled={
                                paid ||
                                !row.result
                                  .participation_approved ||
                                payingId ===
                                  row.player.id ||
                                savingId === row.player.id
                              }
                              className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-bold text-yellow-400 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {payingId ===
                              row.player.id
                                ? 'Paying...'
                                : paid
                                  ? 'Reward Paid'
                                  : '🪙 Pay Reward'}
                            </button>
                          )}
                        </div>

                        {row.result &&
                          !row.result.participation_approved &&
                          !paid && (
                            <p className="mt-3 text-xs text-yellow-500/80">
                              Approve participation and save
                              the result before the reward can
                              be paid.
                            </p>
                          )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Footer */}
              {rows.length > 0 && (
                <div className="border-t border-white/10 p-6">
                  <div className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Showing {filteredRows.length} of{' '}
                      {rows.length} participants
                    </span>

                    <span>
                      Saved results: {resultCount} •
                      Pending approval: {pendingCount} •
                      Approved: {approvedUnpaidCount} •
                      Paid: {paidCount}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
      </section>
    </main>
  )
}