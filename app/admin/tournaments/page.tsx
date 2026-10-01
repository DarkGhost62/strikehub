'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fromZonedTime } from 'date-fns-tz'
import { createClient } from '@/lib/supabase/client'

type TournamentParticipant = {
  id: string
  user_id: string
  device: string | null
  status: string | null
  registered_at: string
  in_game_name: string | null
  display_name: string | null
  bloodstrike_uid: string | null
}

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
  is_public: boolean
  created_at?: string
}

const TIMEZONES = [
  {
    value: 'Africa/Lagos',
    label: 'WAT — West Africa Time (Nigeria)',
  },
  {
    value: 'UTC',
    label: 'UTC — Coordinated Universal Time',
  },
  {
    value: 'Europe/London',
    label: 'UK — London',
  },
  {
    value: 'Europe/Paris',
    label: 'Central Europe — Paris',
  },
  {
    value: 'America/New_York',
    label: 'US Eastern — New York',
  },
  {
    value: 'America/Los_Angeles',
    label: 'US Pacific — Los Angeles',
  },
  {
    value: 'Asia/Dubai',
    label: 'UAE — Dubai',
  },
  {
    value: 'Asia/Kolkata',
    label: 'India — Kolkata',
  },
  {
    value: 'Asia/Tokyo',
    label: 'Japan — Tokyo',
  },
]

const STATUS_OPTIONS = [
  'draft',
  'upcoming',
  'live',
  'completed',
  'cancelled',
]

export default function TournamentsPage() {
  const supabase = createClient()

  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [timezone, setTimezone] = useState('Africa/Lagos')
  const [tournamentType, setTournamentType] = useState('single_day')
  const [gameMode, setGameMode] = useState('solo')
  const [map, setMap] = useState('')
  const [deviceRestriction, setDeviceRestriction] = useState('mobile')
  const [prizeGold, setPrizeGold] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('')
  const [maxTeams, setMaxTeams] = useState('')
  const [playersPerTeam, setPlayersPerTeam] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [rules, setRules] = useState('')
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [tournamentStatus, setTournamentStatus] = useState('upcoming')
  const [streamUrl, setStreamUrl] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  const [participantsTournamentId, setParticipantsTournamentId] =
    useState<string | null>(null)
  const [participants, setParticipants] =
    useState<TournamentParticipant[]>([])
  const [participantsLoading, setParticipantsLoading] =
    useState(false)
  const [participantsError, setParticipantsError] =
    useState('')
  const [participantSearch, setParticipantSearch] = useState('')
  const [participantActionId, setParticipantActionId] =
    useState<string | null>(null)

  async function loadParticipants(tournamentId: string) {
    setParticipantsLoading(true)
    setParticipantsError('')
    setParticipants([])
    setParticipantSearch('')

    const { data: registrations, error: registrationError } =
      await supabase
        .from('tournament_registrations')
        .select(
          'id, user_id, device, status, registered_at'
        )
        .eq('tournament_id', tournamentId)
        .order('registered_at', { ascending: true })

    if (registrationError) {
      setParticipantsError(registrationError.message)
      setParticipantsLoading(false)
      return
    }

    const registrationRows = registrations || []
    const userIds = registrationRows.map(
      (registration) => registration.user_id
    )

    let profileMap = new Map<
      string,
      {
        in_game_name: string | null
        display_name: string | null
        bloodstrike_uid: string | null
      }
    >()

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } =
        await supabase
          .from('profiles')
          .select(
            'id, in_game_name, display_name, bloodstrike_uid'
          )
          .in('id', userIds)

      if (profileError) {
        setParticipantsError(profileError.message)
        setParticipantsLoading(false)
        return
      }

      profileMap = new Map(
        (profiles || []).map((profile) => [
          profile.id,
          {
            in_game_name: profile.in_game_name || null,
            display_name: profile.display_name || null,
            bloodstrike_uid:
              profile.bloodstrike_uid || null,
          },
        ])
      )
    }

    setParticipants(
      registrationRows.map((registration) => ({
        id: registration.id,
        user_id: registration.user_id,
        device: registration.device || null,
        status: registration.status || null,
        registered_at: registration.registered_at,
        ...(profileMap.get(registration.user_id) || {
          in_game_name: null,
          display_name: null,
          bloodstrike_uid: null,
        }),
      }))
    )

    setParticipantsLoading(false)
  }

  async function toggleParticipants(tournamentId: string) {
    setParticipantsError('')

    if (participantsTournamentId === tournamentId) {
      setParticipantsTournamentId(null)
      setParticipants([])
      return
    }

    setParticipantsTournamentId(tournamentId)
    await loadParticipants(tournamentId)
  }

  async function cancelParticipantRegistration(
    tournamentId: string,
    participant: TournamentParticipant
  ) {
    const playerName =
      participant.in_game_name ||
      participant.display_name ||
      participant.bloodstrike_uid ||
      'this player'

    const confirmed = window.confirm(
      `Cancel ${playerName}'s registration for this tournament?\n\nThe player will no longer be considered registered.`
    )

    if (!confirmed) {
      return
    }

    setParticipantActionId(participant.id)
    setParticipantsError('')

    const { error: updateError } = await supabase
      .from('tournament_registrations')
      .update({
        status: 'cancelled',
      })
      .eq('id', participant.id)
      .eq('tournament_id', tournamentId)

    if (updateError) {
      setParticipantsError(updateError.message)
      setParticipantActionId(null)
      return
    }

    await loadParticipants(tournamentId)
    await loadTournaments()
    setMessage(`${playerName}'s registration was cancelled.`)
    setParticipantActionId(null)
  }

  async function loadTournaments() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('tournaments')
      .select('*')
      .order('starts_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
    } else {
      setTournaments((data || []) as Tournament[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadTournaments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetForm() {
    setName('')
    setDescription('')
    setImageFile(null)
    setTimezone('Africa/Lagos')
    setTournamentType('single_day')
    setGameMode('solo')
    setMap('')
    setDeviceRestriction('mobile')
    setPrizeGold('')
    setMaxPlayers('')
    setMaxTeams('')
    setPlayersPerTeam('')
    setStartsAt('')
    setRegistrationDeadline('')
    setRules('')
    setRegistrationOpen(true)
    setTournamentStatus('upcoming')
    setStreamUrl('')
    setIsPublic(true)
    setEditingTournamentId(null)
    setError('')
    setMessage('')
  }

  function validateForm() {
    if (!name.trim()) {
      return 'Tournament name is required.'
    }

    if (!map.trim()) {
      return 'Map is required.'
    }

    if (!startsAt) {
      return 'Tournament start date and time are required.'
    }

    const prize = Number(prizeGold)

    if (!Number.isFinite(prize) || prize < 0) {
      return 'Prize Gold must be 0 or greater.'
    }

    if (!Number.isInteger(prize)) {
      return 'Prize Gold must be a whole number.'
    }

    const startDate = fromZonedTime(startsAt, timezone)

    if (Number.isNaN(startDate.getTime())) {
      return 'Invalid tournament start date or time.'
    }

    if (registrationDeadline) {
      const deadlineDate = fromZonedTime(
        registrationDeadline,
        timezone
      )

      if (Number.isNaN(deadlineDate.getTime())) {
        return 'Invalid registration deadline.'
      }

      if (deadlineDate >= startDate) {
        return 'Registration deadline must be before the tournament start time.'
      }
    }

    if (tournamentType === 'single_day') {
      if (gameMode === 'solo') {
        if (maxPlayers && Number(maxPlayers) < 1) {
          return 'Maximum players must be at least 1.'
        }
      } else {
        if (!maxTeams) {
          return 'Maximum teams is required for team tournaments.'
        }

        if (Number(maxTeams) < 1) {
          return 'Maximum teams must be at least 1.'
        }

        if (!playersPerTeam) {
          return 'Players per team is required for team tournaments.'
        }

        const teamSize = Number(playersPerTeam)

        if (![2, 3, 4].includes(teamSize)) {
          return 'Players per team must be 2, 3, or 4.'
        }
      }
    }

    if (maxPlayers && Number(maxPlayers) < 1) {
      return 'Maximum players must be at least 1.'
    }

    if (maxTeams && Number(maxTeams) < 1) {
      return 'Maximum teams must be at least 1.'
    }

    if (streamUrl.trim()) {
      try {
        const url = new URL(streamUrl.trim())
        if (!['http:', 'https:'].includes(url.protocol)) {
          return 'Stream link must start with http:// or https://.'
        }
      } catch {
        return 'Stream link is not a valid URL.'
      }
    }

    return null
  }

  async function uploadTournamentImage(userId: string) {
    if (!imageFile) {
      return null
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(imageFile.type)) {
      throw new Error('Tournament image must be JPG, PNG, or WebP.')
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      throw new Error('Tournament image must be 5 MB or smaller.')
    }

    const extension =
      imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'

    const filePath =
      `${userId}/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('tournaments')
      .upload(filePath, imageFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: imageFile.type,
      })

    if (uploadError) {
      throw new Error(`Image upload failed: ${uploadError.message}`)
    }

    const { data: publicUrlData } = supabase.storage
      .from('tournaments')
      .getPublicUrl(filePath)

    return publicUrlData.publicUrl
  }

  async function createTournament() {
    setMessage('')
    setError('')

    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You are not logged in.')
      setSaving(false)
      return
    }

    try {
      const imageUrl = await uploadTournamentImage(user.id)

      const startsAtUtc = fromZonedTime(
        startsAt,
        timezone
      ).toISOString()

      const registrationDeadlineUtc = registrationDeadline
        ? fromZonedTime(
            registrationDeadline,
            timezone
          ).toISOString()
        : null

      const { error: insertError } = await supabase
        .from('tournaments')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          tournament_type: tournamentType,
          game_mode: gameMode,
          map: map.trim(),
          device_restriction: deviceRestriction,
          prize_gold: Number(prizeGold) || 0,
          max_players: maxPlayers
            ? Number(maxPlayers)
            : null,
          max_teams: maxTeams
            ? Number(maxTeams)
            : null,
          players_per_team: playersPerTeam
            ? Number(playersPerTeam)
            : null,
          registration_open: registrationOpen,
          image_url: imageUrl,
          timezone,
          starts_at: startsAtUtc,
          registration_deadline: registrationDeadlineUtc,
          rules: rules.trim() || null,
          status: 'upcoming',
          stream_url: streamUrl.trim() || null,
          is_public: isPublic,
          created_by: user.id,
        })

      if (insertError) {
        setError(insertError.message)
        return
      }

      setMessage('Tournament created successfully.')
      resetForm()
      setShowForm(false)

      await loadTournaments()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Something went wrong while creating the tournament.'
      )
    } finally {
      setSaving(false)
    }
  }

  function toDatetimeLocal(
    date: string,
    tournamentTimezone: string
  ) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tournamentTimezone || 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(date))

      const values = Object.fromEntries(
        parts
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, part.value])
      )

      return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
    } catch {
      return ''
    }
  }

  function openEditForm(tournament: Tournament) {
    setEditingTournamentId(tournament.id)
    setName(tournament.name)
    setDescription(tournament.description || '')
    setImageFile(null)
    setTimezone(tournament.timezone || 'Africa/Lagos')
    setTournamentType(tournament.tournament_type || 'single_day')
    setGameMode(tournament.game_mode || 'solo')
    setMap(tournament.map || '')
    setDeviceRestriction(tournament.device_restriction || 'mobile')
    setPrizeGold(String(tournament.prize_gold ?? 0))
    setMaxPlayers(
      tournament.max_players == null
        ? ''
        : String(tournament.max_players)
    )
    setMaxTeams(
      tournament.max_teams == null
        ? ''
        : String(tournament.max_teams)
    )
    setPlayersPerTeam(
      tournament.players_per_team == null
        ? ''
        : String(tournament.players_per_team)
    )
    setStartsAt(
      toDatetimeLocal(
        tournament.starts_at,
        tournament.timezone
      )
    )
    setRegistrationDeadline(
      tournament.registration_deadline
        ? toDatetimeLocal(
            tournament.registration_deadline,
            tournament.timezone
          )
        : ''
    )
    setRules(tournament.rules || '')
    setRegistrationOpen(
      ['draft', 'upcoming'].includes(tournament.status)
        ? tournament.registration_open
        : false
    )
    setTournamentStatus(tournament.status || 'upcoming')
    setStreamUrl(tournament.stream_url || '')
    setIsPublic(tournament.is_public !== false)
    setError('')
    setMessage('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function updateTournament() {
    setMessage('')
    setError('')

    if (!editingTournamentId) {
      return
    }

    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You are not logged in.')
        return
      }

      let imageUrl: string | undefined

      if (imageFile) {
        imageUrl = await uploadTournamentImage(user.id) || undefined
      }

      const startsAtUtc = fromZonedTime(
        startsAt,
        timezone
      ).toISOString()

      const registrationDeadlineUtc = registrationDeadline
        ? fromZonedTime(
            registrationDeadline,
            timezone
          ).toISOString()
        : null

      const registrationIsAllowed =
        ['draft', 'upcoming'].includes(tournamentStatus) &&
        registrationOpen

      const updatePayload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        tournament_type: tournamentType,
        game_mode: gameMode,
        map: map.trim(),
        device_restriction: deviceRestriction,
        prize_gold: Number(prizeGold) || 0,
        max_players: maxPlayers
          ? Number(maxPlayers)
          : null,
        max_teams: maxTeams
          ? Number(maxTeams)
          : null,
        players_per_team: playersPerTeam
          ? Number(playersPerTeam)
          : null,
        registration_open: registrationIsAllowed,
        timezone,
        starts_at: startsAtUtc,
        registration_deadline: registrationDeadlineUtc,
        rules: rules.trim() || null,
        status: tournamentStatus,
        stream_url: streamUrl.trim() || null,
        is_public: isPublic,
      }

      if (imageUrl) {
        updatePayload.image_url = imageUrl
      }

      const { error: updateError } = await supabase
        .from('tournaments')
        .update(updatePayload)
        .eq('id', editingTournamentId)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setMessage('Tournament updated successfully.')
      resetForm()
      setShowForm(false)

      await loadTournaments()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Something went wrong while updating the tournament.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleRegistration(
    id: string,
    currentValue: boolean
  ) {
    setError('')
    setMessage('')

    const tournament = tournaments.find(
      (item) => item.id === id
    )

    if (
      tournament &&
      !['draft', 'upcoming'].includes(tournament.status)
    ) {
      setError(
        'Registration cannot be opened for a live, completed, or cancelled tournament.'
      )
      return
    }

    const { error: updateError } = await supabase
      .from('tournaments')
      .update({
        registration_open: !currentValue,
      })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(
      `Registration ${
        !currentValue ? 'opened' : 'closed'
      } successfully.`
    )

    await loadTournaments()
  }

  async function updateStatus(
    id: string,
    status: string
  ) {
    setError('')
    setMessage('')

    const registrationOpen = ['draft', 'upcoming'].includes(status)

    const updatePayload: Record<string, unknown> = {
      status,
    }

    if (!registrationOpen) {
      updatePayload.registration_open = false
    }

    const { error: updateError } = await supabase
      .from('tournaments')
      .update(updatePayload)
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(
      status === 'live'
        ? 'Tournament is now LIVE. Registration has been closed.'
        : status === 'completed'
          ? 'Tournament marked as completed. Registration has been closed.'
          : status === 'cancelled'
            ? 'Tournament cancelled. Registration has been closed.'
            : 'Tournament status updated.'
    )

    await loadTournaments()
  }

  async function deleteTournament(id: string) {
    setError('')
    setMessage('')

    const { count, error: resultCheckError } = await supabase
      .from('match_results')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('tournament_id', id)

    if (resultCheckError) {
      setError(resultCheckError.message)
      return
    }

    if ((count || 0) > 0) {
      setError(
        'This tournament cannot be deleted because it has match results. Mark it Completed or Cancelled instead.'
      )
      return
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete this tournament? This action cannot be undone.'
    )

    if (!confirmed) {
      return
    }

    const { error: deleteError } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setMessage('Tournament deleted successfully.')

    await loadTournaments()
  }

  function formatTournamentDate(
    date: string,
    tournamentTimezone: string
  ) {
    try {
      return new Date(date).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: tournamentTimezone || 'Africa/Lagos',
      })
    } catch {
      return new Date(date).toLocaleString()
    }
  }

  function formatTournamentType(type: string) {
    return type
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  }

  function formatDevice(device: string) {
    if (device === 'mobile') return 'Mobile Only'
    if (device === 'pc') return 'PC Only'
    if (device === 'both') return 'Mobile & PC'
    return device
  }

  const filteredParticipants = useMemo(() => {
    const query = participantSearch.trim().toLowerCase()

    if (!query) {
      return participants
    }

    return participants.filter((participant) => {
      const values = [
        participant.in_game_name,
        participant.display_name,
        participant.bloodstrike_uid,
        participant.device,
        participant.status,
      ]

      return values.some((value) =>
        value?.toLowerCase().includes(query)
      )
    })
  }, [participants, participantSearch])

  function formatRegistrationDate(date: string) {
    try {
      return new Date(date).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return date
    }
  }

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
              TOURNAMENTS
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
        {/* Page heading */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-gray-400">
              Create and control STRIKEHUB competitions.
            </p>

            <h2 className="mt-1 text-3xl font-black">
              Tournament Management
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showForm) {
                resetForm()
              }

              setShowForm(!showForm)
              setError('')
              setMessage('')
            }}
            className="rounded-lg bg-red-600 px-5 py-3 font-bold transition hover:bg-red-500"
          >
            {showForm
              ? 'Close Form'
              : '+ Create Tournament'}
          </button>
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

        {/* Create Form */}
        {showForm && (
          <div className="mb-10 rounded-2xl border border-red-900/30 bg-[#101010] p-6">
            <h3 className="mb-2 text-xl font-black">
              {editingTournamentId
                ? 'Edit Tournament'
                : 'Create New Tournament'}
            </h3>

            {editingTournamentId && (
              <p className="mb-6 text-sm text-gray-500">
                Update the tournament details below. Changes are
                saved to the existing tournament.
              </p>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              {/* Name */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-gray-400">
                  Tournament Name
                </label>

                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="e.g. STRIKEHUB Weekly Showdown"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-gray-400">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Tournament description..."
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* Tournament Image */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-gray-400">
                  Tournament Image
                </label>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file =
                      e.target.files?.[0] || null

                    if (file && file.size > 5 * 1024 * 1024) {
                      setError(
                        'Tournament image must be 5 MB or smaller.'
                      )
                      e.target.value = ''
                      setImageFile(null)
                      return
                    }

                    if (
                      file &&
                      ![
                        'image/jpeg',
                        'image/png',
                        'image/webp',
                      ].includes(file.type)
                    ) {
                      setError(
                        'Tournament image must be JPG, PNG, or WebP.'
                      )
                      e.target.value = ''
                      setImageFile(null)
                      return
                    }

                    setError('')
                    setImageFile(file)
                  }}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-md file:border-0 file:bg-red-600 file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-red-500"
                />

                <p className="mt-2 text-xs text-gray-500">
                  JPG, PNG or WebP • Maximum 5 MB
                </p>

                {imageFile && (
                  <p className="mt-2 text-sm text-yellow-400">
                    Selected: {imageFile.name}
                  </p>
                )}
              </div>

              {/* Tournament Type */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Tournament Type
                </label>

                <select
                  value={tournamentType}
                  onChange={(e) =>
                    setTournamentType(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="single_day">
                    Single Day
                  </option>

                  <option value="multi_day">
                    Multi Day
                  </option>

                  <option value="stage">
                    Stage Tournament
                  </option>
                </select>
              </div>

              {/* Game Mode */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Game Mode
                </label>

                <select
                  value={gameMode}
                  onChange={(e) =>
                    setGameMode(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="solo">Solo</option>
                  <option value="duo">Duo</option>
                  <option value="trio">Trio</option>
                  <option value="quad">Quad</option>
                </select>
              </div>

              {/* Map */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Map
                </label>

                <input
                  value={map}
                  onChange={(e) =>
                    setMap(e.target.value)
                  }
                  placeholder="e.g. Shutter Island"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* Device */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Device Restriction
                </label>

                <select
                  value={deviceRestriction}
                  onChange={(e) =>
                    setDeviceRestriction(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="mobile">
                    Mobile Only
                  </option>

                  <option value="pc">
                    PC Only
                  </option>

                  <option value="both">
                    Mobile & PC
                  </option>
                </select>
              </div>

              {/* Prize */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Prize Pool (Gold)
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={prizeGold}
                  onChange={(e) =>
                    setPrizeGold(e.target.value)
                  }
                  placeholder="300"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* Maximum Players */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Maximum Players
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxPlayers}
                  onChange={(e) =>
                    setMaxPlayers(e.target.value)
                  }
                  placeholder="e.g. 100"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />

                <p className="mt-1 text-xs text-gray-600">
                  Mainly for solo tournaments.
                </p>
              </div>

              {/* Maximum Teams */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Maximum Teams
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxTeams}
                  onChange={(e) =>
                    setMaxTeams(e.target.value)
                  }
                  placeholder="e.g. 25"
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />

                <p className="mt-1 text-xs text-gray-600">
                  Used for Duo, Trio and Quad tournaments.
                </p>
              </div>

              {/* Players Per Team */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Players Per Team
                </label>

                <select
                  value={playersPerTeam}
                  onChange={(e) =>
                    setPlayersPerTeam(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="">
                    Select team size
                  </option>

                  <option value="2">2 — Duo</option>
                  <option value="3">3 — Trio</option>
                  <option value="4">4 — Quad</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Start Date & Time
                </label>

                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) =>
                    setStartsAt(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Time Zone
                </label>

                <select
                  value={timezone}
                  onChange={(e) =>
                    setTimezone(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                >
                  {TIMEZONES.map((zone) => (
                    <option
                      key={zone.value}
                      value={zone.value}
                    >
                      {zone.label}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-gray-500">
                  The selected timezone is used when saving the
                  tournament's scheduled time.
                </p>
              </div>

              {/* Registration Deadline */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Registration Deadline
                </label>

                <input
                  type="datetime-local"
                  value={registrationDeadline}
                  onChange={(e) =>
                    setRegistrationDeadline(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />

                <p className="mt-2 text-xs text-gray-500">
                  Must be before the tournament start time.
                </p>
              </div>

              {/* Status — edit mode only */}
              {editingTournamentId && (
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Tournament Status
                  </label>

                  <select
                    value={tournamentStatus}
                    onChange={(e) => {
                      const nextStatus = e.target.value
                      setTournamentStatus(nextStatus)

                      if (
                        !['draft', 'upcoming'].includes(
                          nextStatus
                        )
                      ) {
                        setRegistrationOpen(false)
                      }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status
                          .charAt(0)
                          .toUpperCase() +
                          status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tournament Visibility */}
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Tournament Visibility
                </label>

                <select
                  value={isPublic ? 'public' : 'private'}
                  onChange={(e) =>
                    setIsPublic(e.target.value === 'public')
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="public">
                    🌐 Public — visible to players
                  </option>
                  <option value="private">
                    🔒 Private — hidden from players
                  </option>
                </select>

                <p className="mt-2 text-xs text-gray-500">
                  Private tournaments remain available to admins for testing and management,
                  but they are hidden from normal players.
                </p>
              </div>

              {/* Stream Link */}
              {(editingTournamentId &&
                tournamentStatus === 'live') && (
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Live Stream Link
                  </label>

                  <input
                    type="url"
                    value={streamUrl}
                    onChange={(e) =>
                      setStreamUrl(e.target.value)
                    }
                    placeholder="https://youtube.com/live/..."
                    className="w-full rounded-lg border border-red-900/40 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                  />

                  <p className="mt-2 text-xs text-gray-500">
                    Add the YouTube, TikTok, Twitch, or other
                    live stream URL. Players can use it from
                    the live tournament page.
                  </p>
                </div>
              )}

              {/* Registration */}
              <div className="md:col-span-2">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={
                      ['draft', 'upcoming'].includes(
                        tournamentStatus
                      ) && registrationOpen
                    }
                    disabled={
                      !['draft', 'upcoming'].includes(
                        tournamentStatus
                      )
                    }
                    onChange={(e) =>
                      setRegistrationOpen(
                        e.target.checked
                      )
                    }
                    className="h-5 w-5"
                  />

                  <span className="text-sm font-semibold">
                    Open registration immediately
                  </span>
                </label>
              </div>

              {/* Rules */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-gray-400">
                  Tournament Rules
                </label>

                <textarea
                  value={rules}
                  onChange={(e) =>
                    setRules(e.target.value)
                  }
                  placeholder={`Example:
• Mobile only
• No banned weapons
• Follow tournament rules
• Room code will be announced before match`}
                  rows={6}
                  className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 outline-none focus:border-red-500"
                />
              </div>
            </div>

            {/* Create Button */}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={
                  editingTournamentId
                    ? updateTournament
                    : createTournament
                }
                disabled={saving}
                className="w-full rounded-lg bg-red-600 px-5 py-3 font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? editingTournamentId
                    ? 'Saving Changes...'
                    : 'Creating Tournament...'
                  : editingTournamentId
                    ? 'Save Tournament Changes'
                    : 'Create Tournament'}
              </button>

              {editingTournamentId && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setShowForm(false)
                  }}
                  disabled={saving}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-5 py-3 font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tournament List */}
        <div className="rounded-2xl border border-white/10 bg-[#101010]">
          <div className="border-b border-white/10 p-6">
            <h3 className="text-xl font-black">
              All Tournaments
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Manage your STRIKEHUB competitions.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">
              Loading tournaments...
            </div>
          ) : tournaments.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">🏆</div>

              <p className="mt-4 font-bold">
                No tournaments yet
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Create your first tournament using the
                button above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="p-6"
                >
                  {/* Tournament Image */}
                  {tournament.image_url && (
                    <img
                      src={tournament.image_url}
                      alt={tournament.name}
                      className="mb-5 h-48 w-full rounded-xl border border-white/10 object-cover"
                    />
                  )}

                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    {/* Information */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xl font-black">
                          {tournament.name}
                        </h4>

                        <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold uppercase text-red-400">
                          {tournament.status}
                        </span>

                        <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold uppercase text-yellow-400">
                          {tournament.game_mode}
                        </span>

                        <span
                          className={
                            tournament.is_public
                              ? 'rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase text-emerald-400'
                              : 'rounded-full bg-gray-500/10 px-3 py-1 text-xs font-bold uppercase text-gray-400'
                          }
                        >
                          {tournament.is_public ? '🌐 Public' : '🔒 Private'}
                        </span>
                      </div>

                      {tournament.description && (
                        <p className="mt-2 text-sm text-gray-400">
                          {tournament.description}
                        </p>
                      )}

                      {tournament.status === 'live' &&
                        tournament.stream_url && (
                          <a
                            href={tournament.stream_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
                          >
                            🔴 Watch Live Stream
                          </a>
                        )}

                      <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        {/* Map */}
                        <div>
                          <p className="text-gray-500">
                            Map
                          </p>

                          <p className="font-semibold">
                            {tournament.map}
                          </p>
                        </div>

                        {/* Prize */}
                        <div>
                          <p className="text-gray-500">
                            Prize
                          </p>

                          <p className="font-semibold text-yellow-400">
                            🪙{' '}
                            {Number(
                              tournament.prize_gold
                            ).toLocaleString()}{' '}
                            Gold
                          </p>
                        </div>

                        {/* Device */}
                        <div>
                          <p className="text-gray-500">
                            Device
                          </p>

                          <p className="font-semibold">
                            {formatDevice(
                              tournament.device_restriction
                            )}
                          </p>
                        </div>

                        {/* Start */}
                        <div>
                          <p className="text-gray-500">
                            Starts
                          </p>

                          <p className="font-semibold">
                            {formatTournamentDate(
                              tournament.starts_at,
                              tournament.timezone
                            )}
                          </p>

                          <p className="mt-1 text-xs text-gray-600">
                            {tournament.timezone}
                          </p>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-gray-500">
                            Type
                          </p>

                          <p className="font-semibold text-gray-300">
                            {formatTournamentType(
                              tournament.tournament_type
                            )}
                          </p>
                        </div>

                        {tournament.max_players && (
                          <div>
                            <p className="text-gray-500">
                              Max Players
                            </p>

                            <p className="font-semibold">
                              {tournament.max_players}
                            </p>
                          </div>
                        )}

                        {tournament.max_teams && (
                          <div>
                            <p className="text-gray-500">
                              Max Teams
                            </p>

                            <p className="font-semibold">
                              {tournament.max_teams}
                            </p>
                          </div>
                        )}

                        {tournament.players_per_team && (
                          <div>
                            <p className="text-gray-500">
                              Players/Team
                            </p>

                            <p className="font-semibold">
                              {tournament.players_per_team}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Deadline */}
                      {tournament.registration_deadline && (
                        <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm">
                          <span className="text-gray-500">
                            Registration Deadline:{' '}
                          </span>

                          <span className="font-semibold text-gray-300">
                            {formatTournamentDate(
                              tournament.registration_deadline,
                              tournament.timezone
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(tournament)
                        }
                        className="rounded-lg border border-blue-900/40 bg-blue-500/10 px-4 py-2 text-sm font-bold text-blue-400 transition hover:bg-blue-500/20"
                      >
                        ✎ Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleParticipants(tournament.id)
                        }
                        className="rounded-lg border border-purple-900/40 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-400 transition hover:bg-purple-500/20"
                      >
                        👥 Participants
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleRegistration(
                            tournament.id,
                            tournament.registration_open
                          )
                        }
                        disabled={
                          !['draft', 'upcoming'].includes(
                            tournament.status
                          )
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {tournament.registration_open
                          ? 'Close Registration'
                          : 'Open Registration'}
                      </button>

                      <select
                        value={tournament.status}
                        onChange={(e) =>
                          updateStatus(
                            tournament.id,
                            e.target.value
                          )
                        }
                        className="rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm outline-none"
                      >
                        {STATUS_OPTIONS.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {status
                                .charAt(0)
                                .toUpperCase() +
                                status.slice(1)}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(
                            tournament.id,
                            'completed'
                          )
                        }
                        disabled={
                          tournament.status === 'completed'
                        }
                        className="rounded-lg border border-green-900/40 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-400 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ✓ Mark Completed
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(
                            `Cancel "${tournament.name}"?\n\nThis will mark the tournament as cancelled.`
                          )

                          if (!confirmed) {
                            return
                          }

                          updateStatus(
                            tournament.id,
                            'cancelled'
                          )
                        }}
                        disabled={
                          tournament.status === 'cancelled'
                        }
                        className="rounded-lg border border-orange-900/40 bg-orange-500/10 px-4 py-2 text-sm font-bold text-orange-400 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ✕ Cancel Tournament
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteTournament(
                            tournament.id
                          )
                        }
                        className="rounded-lg border border-red-900/40 bg-red-500/5 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Participants */}
                  {participantsTournamentId === tournament.id && (
                    <div className="mt-6 rounded-2xl border border-purple-900/30 bg-purple-950/10 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h5 className="text-lg font-black">
                            Registered Participants
                          </h5>

                          <p className="mt-1 text-xs text-gray-500">
                            View the players registered for this tournament and cancel registrations when necessary.
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-300">
                            {participants.length} participant
                            {participants.length === 1 ? '' : 's'}
                          </span>

                          <input
                            value={participantSearch}
                            onChange={(e) =>
                              setParticipantSearch(e.target.value)
                            }
                            placeholder="Search UID or player..."
                            className="w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-2 text-sm outline-none focus:border-purple-500 sm:w-64"
                          />
                        </div>
                      </div>

                      {participantsError && (
                        <div className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400">
                          {participantsError}
                        </div>
                      )}

                      {participantsLoading ? (
                        <div className="py-8 text-center text-sm text-gray-500">
                          Loading participants...
                        </div>
                      ) : filteredParticipants.length === 0 ? (
                        <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center">
                          <div className="text-3xl">👥</div>
                          <p className="mt-3 font-bold">
                            {participants.length === 0
                              ? 'No registrations yet'
                              : 'No participants match your search'}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-5 overflow-x-auto rounded-xl border border-white/5">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
                              <tr>
                                <th className="px-4 py-3">Player</th>
                                <th className="px-4 py-3">UID</th>
                                <th className="px-4 py-3">Device</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Registered</th>
                                <th className="px-4 py-3 text-right">Action</th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-white/5">
                              {filteredParticipants.map(
                                (participant) => {
                                  const playerName =
                                    participant.in_game_name ||
                                    participant.display_name ||
                                    'Player'

                                  const isCancelled =
                                    participant.status === 'cancelled'

                                  return (
                                    <tr key={participant.id}>
                                      <td className="px-4 py-4">
                                        <div className="font-bold text-gray-200">
                                          {playerName}
                                        </div>

                                        {participant.display_name &&
                                          participant.display_name !==
                                            playerName && (
                                            <div className="mt-1 text-xs text-gray-600">
                                              {participant.display_name}
                                            </div>
                                          )}
                                      </td>

                                      <td className="px-4 py-4 font-mono text-xs text-gray-400">
                                        {participant.bloodstrike_uid ||
                                          '—'}
                                      </td>

                                      <td className="px-4 py-4 text-gray-400">
                                        {formatDevice(
                                          participant.device || 'unknown'
                                        )}
                                      </td>

                                      <td className="px-4 py-4">
                                        <span
                                          className={
                                            isCancelled
                                              ? 'rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400'
                                              : 'rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400'
                                          }
                                        >
                                          {participant.status ||
                                            'registered'}
                                        </span>
                                      </td>

                                      <td className="px-4 py-4 text-xs text-gray-500">
                                        {formatRegistrationDate(
                                          participant.registered_at
                                        )}
                                      </td>

                                      <td className="px-4 py-4 text-right">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            cancelParticipantRegistration(
                                              tournament.id,
                                              participant
                                            )
                                          }
                                          disabled={
                                            isCancelled ||
                                            participantActionId ===
                                              participant.id ||
                                            ['completed', 'cancelled'].includes(
                                              tournament.status
                                            )
                                          }
                                          className="rounded-lg border border-red-900/40 bg-red-500/5 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          {participantActionId ===
                                          participant.id
                                            ? 'Cancelling...'
                                            : isCancelled
                                              ? 'Cancelled'
                                              : 'Cancel Registration'}
                                        </button>
                                      </td>
                                    </tr>
                                  )
                                }
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Info */}
                  <div className="mt-5 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-xs">
                    <span
                      className={
                        tournament.registration_open
                          ? 'font-bold text-green-400'
                          : 'font-bold text-gray-500'
                      }
                    >
                      ● Registration{' '}
                      {tournament.registration_open
                        ? 'OPEN'
                        : 'CLOSED'}
                    </span>

                    {tournament.max_players && (
                      <span className="text-gray-500">
                        Max Players:{' '}
                        {tournament.max_players}
                      </span>
                    )}

                    {tournament.max_teams && (
                      <span className="text-gray-500">
                        Max Teams:{' '}
                        {tournament.max_teams}
                      </span>
                    )}

                    {tournament.players_per_team && (
                      <span className="text-gray-500">
                        Players/Team:{' '}
                        {tournament.players_per_team}
                      </span>
                    )}

                    <span className="text-gray-500">
                      Device:{' '}
                      {formatDevice(
                        tournament.device_restriction
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}