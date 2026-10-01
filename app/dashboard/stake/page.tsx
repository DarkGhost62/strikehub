'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type StakeType = 'match_winner' | 'total_kills'

type StakeOption = {
  id: string
  fixture_id: string
  label: string
  odds: number | string
  result_status: 'pending' | 'won' | 'lost' | 'cancelled'
}

type Fixture = {
  id: string
  title: string
  description: string | null
  stake_type: StakeType
  fixture_image_url: string | null
  starts_at: string
  status: 'open' | 'closed' | 'completed' | 'cancelled'
  stake_options: StakeOption[]
}

type Selection = {
  fixtureId: string
  fixtureTitle: string
  optionId: string
  optionLabel: string
  odds: number
}

type PlacementResult = {
  ticket_id: string
  stake_amount: number
  combined_odds: number
  potential_payout: number
  selections_count: number
  player_balance: number
}

type TicketStatus = 'pending' | 'won' | 'lost' | 'cancelled'

type TicketSelection = {
  id: string
  fixture_id: string
  option_id: string
  fixture_title: string
  option_label: string
  odds: number | string
}

type StakeTicket = {
  id: string
  status: TicketStatus
  stake_amount: number | string
  combined_odds: number | string
  potential_payout: number | string
  selections_count: number
  created_at: string
  settled_at: string | null
  stake_ticket_selections: TicketSelection[]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function typeLabel(type: StakeType) {
  return type === 'match_winner' ? 'Match Winner' : 'Total Kills'
}

export default function StakePage() {
  const supabase = useMemo(() => createClient(), [])

  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selections, setSelections] = useState<Selection[]>([])
  const [stakeAmount, setStakeAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [placement, setPlacement] = useState<PlacementResult | null>(null)
  const [expandedSlip, setExpandedSlip] = useState(false)
  const [tickets, setTickets] = useState<StakeTicket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [ticketFilter, setTicketFilter] = useState<'all' | TicketStatus>('all')
  const [showMyStakes, setShowMyStakes] = useState(false)

  async function loadFixtures() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('stake_fixtures')
      .select(`
        id,
        title,
        description,
        stake_type,
        fixture_image_url,
        starts_at,
        status,
        stake_options (
          id,
          fixture_id,
          label,
          odds,
          result_status
        )
      `)
      .eq('status', 'open')
      .order('starts_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setFixtures([])
    } else {
      setFixtures((data || []) as Fixture[])
    }

    setLoading(false)
  }

  async function loadTickets() {
    setTicketsLoading(true)

    const { data, error: ticketsError } = await supabase
      .from('stake_tickets')
      .select(`
        id,
        status,
        stake_amount,
        combined_odds,
        potential_payout,
        selections_count,
        created_at,
        settled_at,
        stake_ticket_selections (
          id,
          fixture_id,
          option_id,
          fixture_title,
          option_label,
          odds
        )
      `)
      .order('created_at', { ascending: false })

    if (ticketsError) {
      setError(ticketsError.message)
      setTickets([])
    } else {
      setTickets((data || []) as StakeTicket[])
    }

    setTicketsLoading(false)
  }

  useEffect(() => {
    void Promise.all([loadFixtures(), loadTickets()])
  }, [])

  function selectOption(fixture: Fixture, option: StakeOption) {
    setError('')
    setSuccess('')
    setPlacement(null)

    const odds = Number(option.odds)

    if (!Number.isFinite(odds) || odds <= 1) {
      return
    }

    setSelections((current) => {
      const existing = current.find(
        (item) => item.fixtureId === fixture.id
      )

      if (existing?.optionId === option.id) {
        return current.filter(
          (item) => item.fixtureId !== fixture.id
        )
      }

      const nextSelection: Selection = {
        fixtureId: fixture.id,
        fixtureTitle: fixture.title,
        optionId: option.id,
        optionLabel: option.label,
        odds,
      }

      return [
        ...current.filter(
          (item) => item.fixtureId !== fixture.id
        ),
        nextSelection,
      ]
    })
  }

  function removeSelection(fixtureId: string) {
    setSelections((current) =>
      current.filter((item) => item.fixtureId !== fixtureId)
    )
    setError('')
    setSuccess('')
    setPlacement(null)
  }

  function clearSlip() {
    setSelections([])
    setStakeAmount('')
    setError('')
    setSuccess('')
    setPlacement(null)
  }

  const combinedOdds = selections.reduce(
    (total, item) => total * item.odds,
    1
  )

  const numericStake = Number(stakeAmount)

  const potentialPayout =
    Number.isFinite(numericStake) && numericStake > 0
      ? numericStake * combinedOdds
      : 0

  async function placeTicket() {
    if (placing) return

    setError('')
    setSuccess('')
    setPlacement(null)

    if (selections.length === 0) {
      setError('Choose at least one selection.')
      return
    }

    if (
      !Number.isFinite(numericStake) ||
      numericStake < 50 ||
      numericStake > 50000 ||
      !Number.isInteger(numericStake)
    ) {
      setError('Stake amount must be a whole Gold amount between 50 and 50,000.')
      return
    }

    const seenFixtures = new Set<string>()

    for (const selection of selections) {
      if (seenFixtures.has(selection.fixtureId)) {
        setError('Only one selection is allowed from each fixture.')
        return
      }

      seenFixtures.add(selection.fixtureId)

      const fixture = fixtures.find(
        (item) => item.id === selection.fixtureId
      )

      const option = fixture?.stake_options.find(
        (item) => item.id === selection.optionId
      )

      if (!fixture || fixture.status !== 'open' || !option) {
        setError(
          'One of your selections is no longer available. Please refresh the markets.'
        )
        return
      }

      const currentOdds = Number(option.odds)

      if (
        !Number.isFinite(currentOdds) ||
        currentOdds <= 1 ||
        Math.abs(currentOdds - selection.odds) > 0.000001
      ) {
        setError(
          'The odds for one of your selections changed. Please select it again.'
        )
        return
      }
    }

    setPlacing(true)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'place_stake_ticket',
        {
          p_selections: selections.map((selection) => ({
            fixture_id: selection.fixtureId,
            option_id: selection.optionId,
          })),
          p_stake_amount: numericStake,
        }
      )

      if (rpcError) {
        throw new Error(rpcError.message)
      }

      const result = data as PlacementResult

      setPlacement(result)
      setSuccess(
        `Ticket ${result.ticket_id.slice(0, 8).toUpperCase()} placed successfully.`
      )
      setSelections([])
      setStakeAmount('')
      setExpandedSlip(false)
      await Promise.all([loadFixtures(), loadTickets()])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^.*?: /, '')
          : 'Unable to place your ticket.'
      )
    } finally {
      setPlacing(false)
    }
  }

  const filteredTickets =
    ticketFilter === 'all'
      ? tickets
      : tickets.filter((ticket) => ticket.status === ticketFilter)

  function ticketStatusLabel(status: TicketStatus) {
    if (status === 'pending') return 'Pending'
    if (status === 'won') return 'Won'
    if (status === 'lost') return 'Lost'
    return 'Cancelled'
  }

  function ticketStatusClass(status: TicketStatus) {
    if (status === 'won') {
      return 'border-green-500/20 bg-green-500/10 text-green-400'
    }

    if (status === 'lost') {
      return 'border-red-500/20 bg-red-500/10 text-red-400'
    }

    if (status === 'cancelled') {
      return 'border-gray-500/20 bg-gray-500/10 text-gray-400'
    }

    return 'border-yellow-400/20 bg-yellow-400/10 text-yellow-400'
  }

  function ticketIdLabel(id: string) {
    return `STK-${id.slice(0, 8).toUpperCase()}`
  }

  return (
    <div className="min-h-screen pb-32">
      <section className="mx-auto max-w-[1250px] px-5 py-8 sm:px-8">

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-bold text-red-400 transition hover:text-red-300"
          >
            ← Back to Dashboard
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMyStakes((current) => !current)
                setError('')
                if (!showMyStakes) {
                  void loadTickets()
                }
              }}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-black text-gray-200 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              📋 My Stakes
            </button>

            {selections.length > 0 && (
              <button
                type="button"
                onClick={() => setExpandedSlip(true)}
                className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-xs font-black text-yellow-400"
              >
                🎫 Bet Slip ({selections.length})
              </button>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB STAKE
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            Stake Markets
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
            Select your predictions from available STRIKEHUB markets and build
            your Gold ticket.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
            <p className="font-black">{success}</p>

            {placement && (
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                <span>Stake: {placement.stake_amount} Gold</span>
                <span>
                  Odds: {Number(placement.combined_odds).toFixed(2)}x
                </span>
                <span>
                  Potential payout:{' '}
                  {Number(placement.potential_payout).toFixed(2)} Gold
                </span>
              </div>
            )}
          </div>
        )}

        {showMyStakes ? (
          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400">
                  STAKE HISTORY
                </p>
                <h2 className="mt-2 text-3xl font-black">My Stakes</h2>
                <p className="mt-2 text-sm text-gray-500">
                  View your placed tickets and their current status.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadTickets()}
                disabled={ticketsLoading}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-black text-gray-300 transition hover:border-white/20 disabled:opacity-50"
              >
                {ticketsLoading ? 'Refreshing...' : '↻ Refresh'}
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['pending', 'Pending'],
                ['won', 'Won'],
                ['lost', 'Lost'],
                ['cancelled', 'Cancelled'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTicketFilter(value)}
                  className={`rounded-xl border px-4 py-2 text-xs font-black transition ${
                    ticketFilter === value
                      ? 'border-yellow-400/40 bg-yellow-400 text-black'
                      : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {ticketsLoading && tickets.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
                <p className="text-sm text-gray-500">Loading your tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-yellow-400/10 bg-yellow-400/5 text-2xl">
                  🎫
                </div>
                <h3 className="mt-5 text-xl font-black">
                  {ticketFilter === 'all'
                    ? 'No Tickets Yet'
                    : `No ${ticketStatusLabel(ticketFilter)} Tickets`}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                  {ticketFilter === 'all'
                    ? 'Tickets you place will appear here.'
                    : 'There are no tickets in this status right now.'}
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {filteredTickets.map((ticket) => (
                  <article
                    key={ticket.id}
                    className="rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-400">
                          {ticketIdLabel(ticket.id)}
                        </p>
                        <h3 className="mt-2 text-lg font-black">
                          {ticket.selections_count}{' '}
                          {ticket.selections_count === 1
                            ? 'Selection'
                            : 'Selections'}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(ticket.created_at)}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase ${ticketStatusClass(
                          ticket.status
                        )}`}
                      >
                        {ticketStatusLabel(ticket.status)}
                      </span>
                    </div>

                    <div className="mt-5 space-y-2">
                      {ticket.stake_ticket_selections.map((selection) => (
                        <div
                          key={selection.id}
                          className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-gray-200">
                                {selection.fixture_title}
                              </p>
                              <p className="mt-1 text-xs text-yellow-400">
                                {selection.option_label}
                              </p>
                            </div>

                            <span className="rounded-lg bg-white/5 px-3 py-2 text-xs font-black text-yellow-400">
                              {Number(selection.odds).toFixed(2)}x
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                          Stake
                        </p>
                        <p className="mt-1 text-sm font-black">
                          {Number(ticket.stake_amount).toFixed(2)} Gold
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                          Combined Odds
                        </p>
                        <p className="mt-1 text-sm font-black text-yellow-400">
                          {Number(ticket.combined_odds).toFixed(2)}x
                        </p>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                          Potential Payout
                        </p>
                        <p className="mt-1 text-sm font-black text-yellow-400">
                          {Number(ticket.potential_payout).toFixed(2)} Gold
                        </p>
                      </div>
                    </div>

                    {ticket.settled_at && (
                      <p className="mt-4 text-[10px] text-gray-600">
                        Settled: {formatDate(ticket.settled_at)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowMyStakes(false)}
              className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-black text-gray-300 transition hover:border-white/20 hover:text-white"
            >
              ← Back to Stake Markets
            </button>
          </section>
        ) : loading ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <p className="text-sm text-gray-500">
              Loading stake markets...
            </p>
          </div>
        ) : fixtures.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-3xl">
              🎯
            </div>

            <h2 className="mt-6 text-2xl font-black">
              No Open Markets
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-500">
              There are currently no open stake fixtures. Check back when new
              markets are published.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">

            <div className="space-y-5">
              {fixtures.map((fixture) => {
                const selected = selections.find(
                  (item) => item.fixtureId === fixture.id
                )

                return (
                  <article
                    key={fixture.id}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-[#0e0d10]/90"
                  >
                    {fixture.fixture_image_url && (
                      <div className="h-44 overflow-hidden">
                        <img
                          src={fixture.fixture_image_url}
                          alt={fixture.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-red-400">
                            {typeLabel(fixture.stake_type)}
                          </p>

                          <h2 className="mt-2 text-xl font-black">
                            {fixture.title}
                          </h2>

                          <p className="mt-2 text-xs text-gray-500">
                            🕒 {formatDate(fixture.starts_at)}
                          </p>
                        </div>

                        <span className="rounded-full bg-green-500/10 px-3 py-1 text-[9px] font-black uppercase text-green-400">
                          Open
                        </span>
                      </div>

                      {fixture.description && (
                        <p className="mt-4 text-sm leading-6 text-gray-500">
                          {fixture.description}
                        </p>
                      )}

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {fixture.stake_options.map((option) => {
                          const isSelected =
                            selected?.optionId === option.id

                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                selectOption(fixture, option)
                              }
                              className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                                isSelected
                                  ? 'border-yellow-400/50 bg-yellow-400/10'
                                  : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                              }`}
                            >
                              <div>
                                <p
                                  className={`text-sm font-black ${
                                    isSelected
                                      ? 'text-yellow-400'
                                      : 'text-gray-200'
                                  }`}
                                >
                                  {option.label}
                                </p>

                                {isSelected && (
                                  <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-yellow-500">
                                    Selected
                                  </p>
                                )}
                              </div>

                              <span
                                className={`rounded-lg px-3 py-2 text-sm font-black ${
                                  isSelected
                                    ? 'bg-yellow-400 text-black'
                                    : 'bg-white/5 text-yellow-400'
                                }`}
                              >
                                {Number(option.odds).toFixed(2)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <aside className="hidden lg:block">
              <BetSlip
                selections={selections}
                stakeAmount={stakeAmount}
                setStakeAmount={setStakeAmount}
                combinedOdds={combinedOdds}
                potentialPayout={potentialPayout}
                placing={placing}
                removeSelection={removeSelection}
                clearSlip={clearSlip}
                placeTicket={placeTicket}
              />
            </aside>
          </div>
        )}
      </section>

      {selections.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b0a0d]/95 p-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setExpandedSlip(true)}
            className="mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-yellow-400 px-5 py-4 text-black"
          >
            <span className="text-sm font-black">
              🎫 {selections.length} Selection
              {selections.length !== 1 ? 's' : ''}
            </span>

            <span className="text-sm font-black">
              {combinedOdds.toFixed(2)}x →
            </span>
          </button>
        </div>
      )}

      {expandedSlip && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm lg:hidden">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111014] p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-black">
                Bet Slip
              </h2>

              <button
                type="button"
                onClick={() => setExpandedSlip(false)}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <BetSlip
              selections={selections}
              stakeAmount={stakeAmount}
              setStakeAmount={setStakeAmount}
              combinedOdds={combinedOdds}
              potentialPayout={potentialPayout}
              placing={placing}
              removeSelection={removeSelection}
              clearSlip={clearSlip}
              placeTicket={placeTicket}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function BetSlip({
  selections,
  stakeAmount,
  setStakeAmount,
  combinedOdds,
  potentialPayout,
  placing,
  removeSelection,
  clearSlip,
  placeTicket,
}: {
  selections: Selection[]
  stakeAmount: string
  setStakeAmount: (value: string) => void
  combinedOdds: number
  potentialPayout: number
  placing: boolean
  removeSelection: (fixtureId: string) => void
  clearSlip: () => void
  placeTicket: () => Promise<void>
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-400">
            Ticket
          </p>

          <h2 className="mt-1 text-xl font-black">
            Bet Slip
          </h2>
        </div>

        {selections.length > 0 && (
          <button
            type="button"
            onClick={clearSlip}
            disabled={placing}
            className="text-[10px] font-black uppercase text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      {selections.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
          <p className="text-2xl">🎯</p>

          <p className="mt-3 text-sm font-bold text-gray-400">
            Your bet slip is empty
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-600">
            Select an option from a market to add it here.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {selections.map((selection) => (
              <div
                key={selection.fixtureId}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-gray-200">
                      {selection.fixtureTitle}
                    </p>

                    <p className="mt-1 text-xs text-yellow-400">
                      {selection.optionLabel}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeSelection(selection.fixtureId)
                    }
                    disabled={placing}
                    className="shrink-0 text-gray-600 hover:text-red-400 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-2 text-right text-sm font-black text-yellow-400">
                  {selection.odds.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Selections
              </span>

              <span className="font-bold">
                {selections.length}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Combined Odds
              </span>

              <span className="font-black text-yellow-400">
                {combinedOdds.toFixed(2)}
              </span>
            </div>

            <label className="block pt-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                Stake Amount (Gold)
              </span>

              <input
                type="number"
                min="50"
                max="50000"
                step="1"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="50 - 50,000"
                disabled={placing}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-yellow-400/40 disabled:opacity-50"
              />

              <p className="mt-2 text-[9px] text-gray-600">
                Minimum: 50 Gold · Maximum: 50,000 Gold
              </p>
            </label>

            <div className="rounded-2xl border border-yellow-400/10 bg-yellow-400/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Potential Payout
                </span>

                <span className="text-lg font-black text-yellow-400">
                  {potentialPayout > 0
                    ? `${potentialPayout.toFixed(2)} Gold`
                    : '—'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void placeTicket()}
              disabled={placing}
              className="w-full rounded-xl bg-yellow-400 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {placing ? 'Placing Ticket...' : 'Place Ticket'}
            </button>

            <p className="text-center text-[9px] leading-4 text-gray-600">
              Your Gold is transferred securely when the ticket is placed.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
