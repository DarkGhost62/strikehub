'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Transaction = {
  transaction_id: string
  user_id: string | null
  user_display_name: string | null
  user_in_game_name: string | null
  bloodstrike_uid: string | null
  user_email: string | null
  transaction_type: string
  gold_amount: number
  naira_amount: number | null
  balance_before: number
  balance_after: number
  description: string | null
  reference_type: string | null
  reference_id: string | null
  created_by: string | null
  created_at: string
}

const transactionTypes = [
  { value: '', label: 'All transaction types' },
  { value: 'admin_credit', label: 'Admin Credit' },
  { value: 'admin_debit', label: 'Admin Debit' },
  { value: 'tournament_reward', label: 'Tournament Reward' },
  { value: 'task_reward', label: 'Task Reward' },
  { value: 'daily_login_reward', label: 'Daily Login Reward' },
  { value: 'referral_reward', label: 'Referral Reward' },
  { value: 'stake_win', label: 'Stake Win' },
  { value: 'stake_refund', label: 'Stake Refund' },
  { value: 'shop_purchase', label: 'Shop Purchase' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'adjustment', label: 'Adjustment' },
]

function formatType(type: string) {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AdminTransactionsPage() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)

  async function loadTransactions() {
    setLoading(true)
    setError('')

    const { data, error: transactionError } = await supabase.rpc(
      'admin_get_transactions',
      {
        p_search: search.trim() || null,
        p_type: type || null,
        p_limit: 500,
      }
    )

    if (transactionError) {
      setError(transactionError.message)
      setTransactions([])
      setLoading(false)
      return
    }

    setTransactions((data ?? []) as Transaction[])
    setLoading(false)
  }

  useEffect(() => {
    loadTransactions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(() => {
    let goldIn = 0
    let goldOut = 0

    for (const transaction of transactions) {
      const amount = Number(transaction.gold_amount || 0)

      if (amount > 0) {
        goldIn += amount
      } else if (amount < 0) {
        goldOut += Math.abs(amount)
      }
    }

    return {
      total: transactions.length,
      goldIn,
      goldOut,
      net: goldIn - goldOut,
    }
  }, [transactions])

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    await loadTransactions()
  }

  function clearFilters() {
    setSearch('')
    setType('')

    setTimeout(() => {
      loadTransactions()
    }, 0)
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">

      {/* Header */}
      <header className="border-b border-red-900/30 bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">

          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-red-500">
              STRIKEHUB
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-wide">
              TRANSACTIONS
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Admin wallet and Gold transaction history
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            <Link
              href="/admin"
              className="rounded-lg border border-red-900/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
            >
              ← Admin
            </Link>

            <Link
              href="/dashboard"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Player Dashboard
            </Link>

          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-white/10 bg-[#101010] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Transactions
            </p>

            <p className="mt-3 text-3xl font-black">
              {stats.total.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-green-900/30 bg-green-950/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Gold In
            </p>

            <p className="mt-3 text-3xl font-black text-green-400">
              +{stats.goldIn.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-red-900/30 bg-red-950/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Gold Out
            </p>

            <p className="mt-3 text-3xl font-black text-red-400">
              -{stats.goldOut.toLocaleString()}
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-900/30 bg-yellow-500/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Net Gold Movement
            </p>

            <p
              className={`mt-3 text-3xl font-black ${
                stats.net >= 0
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {stats.net >= 0 ? '+' : ''}
              {stats.net.toLocaleString()}
            </p>
          </div>

        </div>

        {/* Search */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#101010] p-5">

          <form
            onSubmit={handleSearch}
            className="grid gap-3 lg:grid-cols-[1fr_260px_auto_auto]"
          >

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search UID, email, display name or in-game name..."
              className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-500/60"
            />

            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-sm text-white outline-none focus:border-red-500/60"
            >
              {transactionTypes.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Search'}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold transition hover:bg-white/10"
            >
              Clear
            </button>

          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-5 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Transaction table */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#101010]">

          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

            <div>
              <h2 className="font-black">
                Transaction History
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Latest wallet activity across STRIKEHUB
              </p>
            </div>

            <button
              onClick={loadTransactions}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-white/10"
            >
              ↻ Refresh
            </button>

          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">

              <div className="text-4xl">
                💳
              </div>

              <h3 className="mt-4 font-bold">
                No transactions found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Try changing your search or transaction filter.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1050px] text-left">

                <thead className="border-b border-white/10 bg-[#0b0b0b]">
                  <tr className="text-xs uppercase tracking-wider text-gray-500">

                    <th className="px-5 py-4">
                      User
                    </th>

                    <th className="px-5 py-4">
                      Type
                    </th>

                    <th className="px-5 py-4">
                      Gold
                    </th>

                    <th className="px-5 py-4">
                      Balance
                    </th>

                    <th className="px-5 py-4">
                      Description
                    </th>

                    <th className="px-5 py-4">
                      Date
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">

                  {transactions.map((transaction) => {
                    const amount = Number(transaction.gold_amount || 0)

                    return (
                      <tr
                        key={transaction.transaction_id}
                        onClick={() =>
                          setSelectedTransaction(transaction)
                        }
                        className="cursor-pointer transition hover:bg-white/[0.03]"
                      >

                        {/* User */}
                        <td className="px-5 py-4">

                          <div className="font-bold">
                            {transaction.user_display_name ||
                              'Admin / System'}
                          </div>

                          {transaction.user_in_game_name && (
                            <div className="mt-1 text-xs text-gray-500">
                              {transaction.user_in_game_name}
                            </div>
                          )}

                          {transaction.bloodstrike_uid && (
                            <div className="mt-1 text-xs text-gray-600">
                              UID: {transaction.bloodstrike_uid}
                            </div>
                          )}

                        </td>

                        {/* Type */}
                        <td className="px-5 py-4">

                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold">
                            {formatType(
                              transaction.transaction_type
                            )}
                          </span>

                        </td>

                        {/* Gold */}
                        <td className="px-5 py-4">

                          <span
                            className={`font-black ${
                              amount > 0
                                ? 'text-green-400'
                                : amount < 0
                                  ? 'text-red-400'
                                  : 'text-gray-400'
                            }`}
                          >
                            {amount > 0 ? '+' : ''}
                            {amount.toLocaleString()} Gold
                          </span>

                        </td>

                        {/* Balance */}
                        <td className="px-5 py-4">

                          <div className="text-xs text-gray-500">
                            Before
                          </div>

                          <div className="font-semibold">
                            {Number(
                              transaction.balance_before
                            ).toLocaleString()}
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            After
                          </div>

                          <div className="font-semibold text-yellow-400">
                            {Number(
                              transaction.balance_after
                            ).toLocaleString()}
                          </div>

                        </td>

                        {/* Description */}
                        <td className="max-w-[300px] px-5 py-4">

                          <p className="truncate text-sm text-gray-300">
                            {transaction.description ||
                              'No description'}
                          </p>

                        </td>

                        {/* Date */}
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-gray-500">
                          {formatDate(transaction.created_at)}
                        </td>

                      </tr>
                    )
                  })}

                </tbody>

              </table>
            </div>
          )}

        </div>

        {/* Transaction Details */}
        {selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">

            <div className="w-full max-w-2xl rounded-2xl border border-red-900/40 bg-[#111111] shadow-2xl">

              <div className="flex items-center justify-between border-b border-white/10 p-5">

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">
                    TRANSACTION DETAILS
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    {formatType(
                      selectedTransaction.transaction_type
                    )}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
                >
                  ✕
                </button>

              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2">

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    User
                  </p>

                  <p className="mt-2 font-bold">
                    {selectedTransaction.user_display_name ||
                      'Admin / System'}
                  </p>

                  {selectedTransaction.user_email && (
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedTransaction.user_email}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    BloodStrike UID
                  </p>

                  <p className="mt-2 font-bold">
                    {selectedTransaction.bloodstrike_uid ||
                      '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Gold Amount
                  </p>

                  <p
                    className={`mt-2 text-xl font-black ${
                      Number(
                        selectedTransaction.gold_amount
                      ) >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}
                  >
                    {Number(
                      selectedTransaction.gold_amount
                    ) > 0
                      ? '+'
                      : ''}
                    {Number(
                      selectedTransaction.gold_amount
                    ).toLocaleString()}{' '}
                    Gold
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Balance After
                  </p>

                  <p className="mt-2 text-xl font-black text-yellow-400">
                    {Number(
                      selectedTransaction.balance_after
                    ).toLocaleString()}{' '}
                    Gold
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 p-4">

                  <p className="text-xs text-gray-500">
                    Description
                  </p>

                  <p className="mt-2 text-sm text-gray-300">
                    {selectedTransaction.description ||
                      'No description'}
                  </p>

                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Reference Type
                  </p>

                  <p className="mt-2 text-sm font-semibold">
                    {selectedTransaction.reference_type ||
                      '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Reference ID
                  </p>

                  <p className="mt-2 break-all text-xs text-gray-400">
                    {selectedTransaction.reference_id ||
                      '—'}
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-gray-500">
                    Transaction Date
                  </p>

                  <p className="mt-2 text-sm font-semibold">
                    {formatDate(
                      selectedTransaction.created_at
                    )}
                  </p>
                </div>

              </div>

            </div>
          </div>
        )}

      </section>
    </main>
  )
}