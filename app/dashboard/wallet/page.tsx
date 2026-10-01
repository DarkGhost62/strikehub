'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Wallet = {
  gold_balance: number
  naira_balance: number
}

type ConversionRate = {
  naira_per_gold: number
  usd_per_gold: number
}

type Transaction = {
  id: string
  type: string
  gold_amount: number
  naira_amount: number
  balance_before: number
  balance_after: number
  description: string | null
  reference_type: string | null
  created_at: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return value.toLocaleString('en-NG')
}

function transactionLabel(type: string) {
  const labels: Record<string, string> = {
    admin_credit: 'Admin Credit',
    admin_debit: 'Admin Debit',
    tournament_reward: 'Tournament Reward',
    task_reward: 'Task Reward',
    referral_reward: 'Referral Reward',
    daily_login_reward: 'Daily Login Reward',
    stake_win: 'Stake Win',
    stake_refund: 'Stake Refund',
    shop_purchase: 'Shop Purchase',
    withdrawal: 'Withdrawal',
    adjustment: 'Adjustment',
  }

  return (
    labels[type] ||
    type
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

function isCredit(_type: string, amount: number) {
  return amount > 0
}

export default function WalletPage() {
  const supabase = createClient()

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [conversion, setConversion] =
    useState<ConversionRate | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function loadWallet(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const [
        { data: walletData, error: walletError },
        { data: conversionData, error: conversionError },
        { data: transactionData, error: transactionError },
      ] = await Promise.all([
        supabase
          .from('wallets')
          .select('gold_balance, naira_balance')
          .eq('user_id', user.id)
          .maybeSingle(),

        supabase
          .from('conversion_rates')
          .select('naira_per_gold, usd_per_gold')
          .eq('id', 1)
          .maybeSingle(),

        supabase
          .from('wallet_transactions')
          .select(
            'id, type, gold_amount, naira_amount, balance_before, balance_after, description, reference_type, created_at'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (walletError) {
        throw new Error(walletError.message)
      }

      if (conversionError) {
        throw new Error(conversionError.message)
      }

      if (transactionError) {
        throw new Error(transactionError.message)
      }

      setWallet(walletData)
      setConversion(conversionData)
      setTransactions(transactionData ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load your wallet.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadWallet()
  }, [])

  const gold = Number(wallet?.gold_balance ?? 0)

  const nairaPerGold = Number(
    conversion?.naira_per_gold ?? 0
  )

  const usdPerGold = Number(
    conversion?.usd_per_gold ?? 0
  )

  const goldInNaira = gold * nairaPerGold
  const goldInUsd = gold * usdPerGold

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5">
        <div className="text-center">
          <div className="text-4xl">💰</div>

          <p className="mt-4 text-sm font-bold text-gray-400">
            Loading wallet...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <section className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8">

        {/* BACK */}
        <div className="flex items-center justify-between gap-4">

          <Link
            href="/dashboard"
            className="text-xs font-bold text-red-400 transition hover:text-red-300"
          >
            ← Back to Dashboard
          </Link>

          <button
            type="button"
            onClick={() => loadWallet(true)}
            disabled={refreshing}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-black text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>

        </div>

        {/* HEADER */}
        <div className="mt-8">

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB WALLET
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            Wallet
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
            Manage your Gold balance, view its current value and track
            your wallet activity.
          </p>

        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-bold text-red-400">
            {error}
          </div>
        )}

        {/* MAIN BALANCE */}
        <div className="mt-10 rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.08] via-red-500/[0.04] to-transparent p-7 sm:p-9">

          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
                Total Gold Balance
              </p>

              <div className="mt-3 flex items-baseline gap-3">

                <span className="text-5xl font-black text-yellow-400 sm:text-6xl">
                  {formatNumber(gold)}
                </span>

                <span className="text-lg font-black text-yellow-400">
                  GOLD
                </span>

              </div>

              <p className="mt-3 text-sm text-gray-500">
                Your available STRIKEHUB Gold.
              </p>

            </div>

            <div className="flex flex-wrap gap-3">

              <Link
                href="/dashboard/withdraw"
                className="rounded-xl bg-yellow-400 px-6 py-3 text-xs font-black text-black transition hover:bg-yellow-300"
              >
                Withdraw
              </Link>

              <Link
                href="/dashboard/shop"
                className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-xs font-black text-white transition hover:bg-white/[0.06]"
              >
                Visit Shop
              </Link>

            </div>

          </div>

        </div>

        {/* VALUE CARDS */}
        <div className="mt-5 grid gap-5 md:grid-cols-3">

          <div className="rounded-2xl border border-white/10 bg-[#0e0d10]/90 p-6">

            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">
              Gold Value
            </p>

            <p className="mt-3 text-2xl font-black text-yellow-400">
              {formatNumber(gold)} Gold
            </p>

            <p className="mt-2 text-xs text-gray-600">
              Current balance
            </p>

          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0e0d10]/90 p-6">

            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">
              Naira Equivalent
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              ₦{goldInNaira.toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>

            <p className="mt-2 text-xs text-gray-600">
              Based on current conversion
            </p>

          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0e0d10]/90 p-6">

            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">
              USD Equivalent
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              ${goldInUsd.toFixed(2)}
            </p>

            <p className="mt-2 text-xs text-gray-600">
              Based on current conversion
            </p>

          </div>

        </div>

        {/* CONVERSION */}
        <div className="mt-5 rounded-3xl border border-red-500/10 bg-[#0e0d10]/90 p-7">

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
                Current Conversion
              </p>

              <h2 className="mt-2 text-xl font-black">
                Gold Exchange Rate
              </h2>

            </div>

            <div className="flex flex-wrap gap-3">

              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                  1 Gold
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  ₦{nairaPerGold.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                  1 Gold
                </p>

                <p className="mt-1 text-sm font-black text-white">
                  ${usdPerGold.toFixed(2)}
                </p>
              </div>

            </div>

          </div>

          <p className="mt-5 text-xs leading-5 text-gray-600">
            Conversion values are controlled by STRIKEHUB administration
            and may change over time.
          </p>

        </div>

        {/* TRANSACTIONS */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-7">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
                Wallet Activity
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Recent Transactions
              </h2>

            </div>

            <p className="text-xs font-bold text-gray-600">
              Last 20
            </p>

          </div>

          {transactions.length === 0 ? (

            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center">

              <div className="text-3xl">💰</div>

              <p className="mt-3 text-sm font-black text-gray-400">
                No transactions yet
              </p>

              <p className="mt-2 text-xs text-gray-600">
                Your Gold activity will appear here.
              </p>

            </div>

          ) : (

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/5">

              <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_1fr] gap-4 border-b border-white/5 bg-white/[0.02] px-5 py-4 text-[9px] font-black uppercase tracking-wider text-gray-600 sm:grid">

                <span>Transaction</span>
                <span>Amount</span>
                <span>Balance</span>
                <span>Date</span>

              </div>

              <div className="divide-y divide-white/5">

                {transactions.map((transaction) => {

                  const credit = isCredit(
                    transaction.type,
                    Number(transaction.gold_amount)
                  )

                  const amount = Math.abs(
                    Number(transaction.gold_amount)
                  )

                  return (
                    <div
                      key={transaction.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[1.4fr_0.8fr_0.8fr_1fr] sm:items-center sm:gap-4"
                    >

                      <div className="min-w-0">

                        <p className="truncate text-sm font-black text-white">
                          {transactionLabel(transaction.type)}
                        </p>

                        <p className="mt-1 truncate text-xs text-gray-600">
                          {transaction.description ||
                            transaction.reference_type ||
                            'Wallet transaction'}
                        </p>

                      </div>

                      <div>

                        <span
                          className={
                            credit
                              ? 'text-sm font-black text-green-400'
                              : 'text-sm font-black text-red-400'
                          }
                        >
                          {credit ? '+' : '-'}
                          {formatNumber(amount)} Gold
                        </span>

                      </div>

                      <div>

                        <p className="text-sm font-black text-white">
                          {formatNumber(
                            Number(transaction.balance_after)
                          )}
                        </p>

                        <p className="text-[10px] text-gray-600">
                          Balance
                        </p>

                      </div>

                      <div>

                        <p className="text-xs text-gray-500">
                          {formatDate(transaction.created_at)}
                        </p>

                      </div>

                    </div>
                  )
                })}

              </div>

            </div>

          )}

        </div>

        {/* WALLET INFORMATION */}
        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5">

          <p className="text-xs leading-6 text-gray-600">
            Gold transactions are recorded automatically. Your Gold
            balance cannot be edited directly from the player dashboard.
            Tournament rewards, approved tasks, referrals, daily login
            rewards and other platform activity are recorded in your
            wallet history.
          </p>

        </div>

      </section>
    </div>
  )
}