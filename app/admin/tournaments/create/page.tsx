'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function CreateTournamentPage() {
  const supabase = createClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tournamentType, setTournamentType] = useState('single_day')
  const [gameMode, setGameMode] = useState('solo')
  const [map, setMap] = useState('')
  const [deviceRestriction, setDeviceRestriction] = useState('mobile')
  const [prizeGold, setPrizeGold] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('')
  const [maxTeams, setMaxTeams] = useState('')
  const [playersPerTeam, setPlayersPerTeam] = useState('1')
  const [startsAt, setStartsAt] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [rules, setRules] = useState('')
  const [registrationOpen, setRegistrationOpen] = useState(true)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function createTournament(e: React.FormEvent) {
    e.preventDefault()

    setMessage('')
    setError('')

    if (!name.trim()) {
      setError('Tournament name is required.')
      return
    }

    if (!map.trim()) {
      setError('Map name is required.')
      return
    }

    if (!startsAt) {
      setError('Tournament start date and time are required.')
      return
    }

    const prize = Number(prizeGold || 0)
    const players = maxPlayers ? Number(maxPlayers) : null
    const teams = maxTeams ? Number(maxTeams) : null
    const perTeam = Number(playersPerTeam)

    if (prize < 0) {
      setError('Prize Gold cannot be negative.')
      return
    }

    if (players !== null && players <= 0) {
      setError('Maximum players must be greater than 0.')
      return
    }

    if (teams !== null && teams <= 0) {
      setError('Maximum teams must be greater than 0.')
      return
    }

    if (perTeam <= 0) {
      setError('Players per team must be greater than 0.')
      return
    }

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      setError('You must be logged in as an administrator.')
      return
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleError || roleData?.role !== 'admin') {
      setLoading(false)
      setError('Administrator access required.')
      return
    }

    const { error: insertError } = await supabase
      .from('tournaments')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        tournament_type: tournamentType,
        game_mode: gameMode,
        map: map.trim(),
        device_restriction: deviceRestriction,
        prize_gold: prize,
        max_players: players,
        max_teams: teams,
        players_per_team: perTeam,
        registration_open: registrationOpen,
        starts_at: new Date(startsAt).toISOString(),
        registration_deadline: registrationDeadline
          ? new Date(registrationDeadline).toISOString()
          : null,
        rules: rules.trim() || null,
        status: 'upcoming',
        created_by: user.id,
      })

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setMessage('Tournament created successfully.')

    setTimeout(() => {
      window.location.href = '/admin/tournaments'
    }, 1000)
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">

      <header className="border-b border-red-900/30 bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">

          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-red-500">
              STRIKEHUB
            </p>

            <h1 className="mt-1 text-2xl font-black">
              CREATE TOURNAMENT
            </h1>
          </div>

          <Link
            href="/admin/tournaments"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
          >
            Back to Tournaments
          </Link>

        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">

        <div className="mb-8">
          <p className="text-sm text-gray-400">
            Create and configure a new STRIKEHUB competition.
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Tournament Details
          </h2>
        </div>

        <form
          onSubmit={createTournament}
          className="space-y-6"
        >

          {/* Basic Information */}

          <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">

            <h3 className="mb-6 text-xl font-black">
              Basic Information
            </h3>

            <div className="grid gap-5 md:grid-cols-2">

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Tournament Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. BloodStrike Weekly Showdown"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the tournament..."
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Tournament Type
                </label>

                <select
                  value={tournamentType}
                  onChange={(e) => setTournamentType(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
                >
                  <option value="single_day">Single Day</option>
                  <option value="multi_day">Multi Day</option>
                  <option value="stage">Stage Tournament</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Game Mode
                </label>

                <select
                  value={gameMode}
                  onChange={(e) => setGameMode(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
                >
                  <option value="solo">Solo</option>
                  <option value="duo">Duo</option>
                  <option value="trio">Trio</option>
                  <option value="quad">Quad</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Map
                </label>

                <input
                  type="text"
                  value={map}
                  onChange={(e) => setMap(e.target.value)}
                  placeholder="e.g. Shutter Island"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Device Restriction
                </label>

                <select
                  value={deviceRestriction}
                  onChange={(e) => setDeviceRestriction(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
                >
                  <option value="mobile">Mobile Only</option>
                  <option value="pc">PC Only</option>
                  <option value="both">Mobile + PC</option>
                </select>
              </div>

            </div>

          </div>

          {/* Prize & Capacity */}

          <div className="rounded-2xl border border-yellow-900/30 bg-[#101010] p-6">

            <h3 className="mb-6 text-xl font-black">
              Prize & Capacity
            </h3>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Prize Gold
                </label>

                <div className="flex">
                  <span className="rounded-l-lg border border-white/10 bg-yellow-500/10 px-4 py-3 text-yellow-400">
                    🪙
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={prizeGold}
                    onChange={(e) => setPrizeGold(e.target.value)}
                    placeholder="300"
                    className="w-full rounded-r-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-yellow-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Maximum Players
                </label>

                <input
                  type="number"
                  min="1"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value)}
                  placeholder="100"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Maximum Teams
                </label>

                <input
                  type="number"
                  min="1"
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(e.target.value)}
                  placeholder="25"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Players Per Team
                </label>

                <input
                  type="number"
                  min="1"
                  value={playersPerTeam}
                  onChange={(e) => setPlayersPerTeam(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-yellow-500"
                />
              </div>

            </div>

          </div>

          {/* Schedule */}

          <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">

            <h3 className="mb-6 text-xl font-black">
              Schedule
            </h3>

            <div className="grid gap-5 md:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Tournament Start
                </label>

                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-400">
                  Registration Deadline
                </label>

                <input
                  type="datetime-local"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

            </div>

            <label className="mt-6 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={registrationOpen}
                onChange={(e) => setRegistrationOpen(e.target.checked)}
                className="h-5 w-5 accent-red-600"
              />

              <span className="text-sm font-semibold">
                Open registration immediately
              </span>
            </label>

          </div>

          {/* Rules */}

          <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">

            <h3 className="mb-6 text-xl font-black">
              Tournament Rules
            </h3>

            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={7}
              placeholder={`Example:

• Mobile only
• Skills OFF
• No banned weapons
• Room code drops 5 minutes before match
• Players must use their registered UID`}
              className="w-full resize-none rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-red-500"
            />

          </div>

          {/* Messages */}

          {error && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-green-900/40 bg-green-950/20 p-4 text-sm text-green-400">
              {message}
            </div>
          )}

          {/* Submit */}

          <div className="flex flex-col gap-3 sm:flex-row">

            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-red-600 px-6 py-4 font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating Tournament...' : '🏆 Create Tournament'}
            </button>

            <Link
              href="/admin/tournaments"
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-center font-bold transition hover:bg-white/10"
            >
              Cancel
            </Link>

          </div>

        </form>

      </section>
    </main>
  )
}