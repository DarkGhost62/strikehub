'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Wallet = {
  gold_balance: number
}

type ConversionRate = {
  naira_per_gold: number
}

type Withdrawal = {
  id: string
  amount_gold: number
  method: string
  details: Record<string, unknown>
  status: string
  admin_note: string | null
  created_at: string
  updated_at: string
}

export default function WithdrawPage() {
  const supabase = createClient()

  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [rate, setRate] = useState<ConversionRate | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])

  const [amount, setAmount] = useState('300')
  const [method, setMethod] = useState('bloodstrike')

  const [bloodstrikeUid, setBloodstrikeUid] = useState('')

  const [accountName, setAccountName] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')

  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const enteredAmount = Number(amount)
  const goldBalance = wallet?.gold_balance ?? 0
  const nairaPerGold = rate?.naira_per_gold ?? 0

  const requestedGold = useMemo(() => {
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
      return 0
    }

    if (method === 'bloodstrike') {
      return Math.floor(enteredAmount)
    }

    if (nairaPerGold <= 0) {
      return 0
    }

    return Math.ceil(enteredAmount / nairaPerGold)
  }, [enteredAmount, method, nairaPerGold])

  const nairaValue = useMemo(() => {
    if (method === 'bank') {
      return enteredAmount
    }

    return requestedGold * nairaPerGold
  }, [enteredAmount, method, requestedGold, nairaPerGold])

  const pendingWithdrawal = withdrawals.find(
    (withdrawal) => withdrawal.status === 'pending'
  )

  const maxGoldWithdrawal = Math.floor(goldBalance / 100) * 100

  const maxBankNaira = nairaPerGold > 0
    ? Math.floor(goldBalance * nairaPerGold)
    : 0

  const amountValid =
    method === 'bloodstrike'
      ? requestedGold >= 300 &&
        requestedGold % 100 === 0 &&
        requestedGold <= goldBalance
      : enteredAmount >= 3500 &&
        Number.isInteger(enteredAmount) &&
        requestedGold > 0 &&
        requestedGold <= goldBalance

  async function loadData() {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const [walletResult, rateResult, withdrawalResult] =
      await Promise.all([
        supabase
          .from('wallets')
          .select('gold_balance')
          .eq('user_id', user.id)
          .maybeSingle(),

        supabase
          .from('conversion_rates')
          .select('naira_per_gold')
          .eq('id', 1)
          .maybeSingle(),

        supabase
          .from('withdrawal_requests')
          .select(
            'id, amount_gold, method, details, status, admin_note, created_at, updated_at'
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

    if (walletResult.error) {
      setError(walletResult.error.message)
    }

    if (rateResult.error) {
      setError(rateResult.error.message)
    }

    if (withdrawalResult.error) {
      setError(withdrawalResult.error.message)
    }

    if (walletResult.data) {
      setWallet(walletResult.data)
    }

    if (rateResult.data) {
      setRate(rateResult.data)
    }

    if (withdrawalResult.data) {
      setWithdrawals(
        withdrawalResult.data as Withdrawal[]
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (submitting) {
      return
    }

    if (!wallet) {
      setError('Wallet information is unavailable.')
      return
    }

    if (method === 'bloodstrike') {
      if (requestedGold < 300) {
        setError('Minimum BloodStrike withdrawal is 300 Gold.')
        return
      }

      if (requestedGold % 100 !== 0) {
        setError('BloodStrike withdrawals must be in 100 Gold increments.')
        return
      }

      if (requestedGold > goldBalance) {
        setError('You do not have enough Gold for this withdrawal.')
        return
      }
    } else {
      if (!Number.isInteger(enteredAmount) || enteredAmount < 3500) {
        setError('Minimum bank withdrawal is ₦3,500.')
        return
      }

      if (nairaPerGold <= 0) {
        setError('The current Gold conversion rate is unavailable.')
        return
      }

      if (requestedGold > goldBalance) {
        setError(
          `You do not have enough Gold for this bank withdrawal. You need ${requestedGold.toLocaleString()} Gold.`
        )
        return
      }
    }

    if (pendingWithdrawal) {
      setError(
        'You already have a pending withdrawal request.'
      )
      return
    }

    if (!password.trim()) {
      setError('Enter your password to confirm the withdrawal.')
      return
    }

    if (method === 'bloodstrike') {
      if (!/^\d{12}$/.test(bloodstrikeUid.trim())) {
        setError(
          'BloodStrike UID must contain exactly 12 digits.'
        )
        return
      }
    }

    if (method === 'bank') {
      if (!accountName.trim()) {
        setError('Enter the bank account holder name.')
        return
      }

      if (!bankName.trim()) {
        setError('Enter your bank name.')
        return
      }

      if (!/^\d{10}$/.test(accountNumber.trim())) {
        setError(
          'Bank account number must contain exactly 10 digits.'
        )
        return
      }
    }

    setSubmitting(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !user.email) {
        throw new Error('Your session has expired. Please log in again.')
      }

      /*
       * Confirm the password through Supabase Auth before submitting.
       * This does not expose the password to our database function.
       */
      const { error: passwordError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        })

      if (passwordError) {
        throw new Error(
          'Password confirmation failed. Please enter your current password.'
        )
      }

      let details: Record<string, unknown>

      if (method === 'bloodstrike') {
        details = {
          bloodstrike_uid: bloodstrikeUid.trim(),
          withdrawal_amount_gold: requestedGold,
          withdrawal_value_naira: nairaValue,
        }
      } else {
        details = {
          account_name: accountName.trim(),
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          withdrawal_amount_naira: enteredAmount,
          required_gold: requestedGold,
          naira_per_gold: nairaPerGold,
        }
      }

      const { data: requestId, error: requestError } =
        await supabase.rpc('request_withdrawal', {
          p_amount_gold: requestedGold,
          p_method: method,
          p_details: details,
        })

      if (requestError) {
        throw new Error(requestError.message)
      }

      if (!requestId) {
        throw new Error(
          'Withdrawal request could not be created.'
        )
      }

      setSuccess(
        method === 'bloodstrike'
          ? `Withdrawal request submitted successfully. ${requestedGold.toLocaleString()} Gold has been reserved for processing.`
          : `Withdrawal request submitted successfully. ₦${enteredAmount.toLocaleString('en-NG')} has been requested and ${requestedGold.toLocaleString()} Gold has been reserved for processing.`
      )

      setPassword('')

      await loadData()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong while submitting your withdrawal.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  function statusClass(status: string) {
    if (status === 'approved') {
      return 'border-green-500/20 bg-green-500/5 text-green-400'
    }

    if (status === 'rejected') {
      return 'border-red-500/20 bg-red-500/5 text-red-400'
    }

    if (status === 'cancelled') {
      return 'border-gray-500/20 bg-gray-500/5 text-gray-400'
    }

    return 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400'
  }

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

        <Link
          href="/dashboard"
          className="text-xs font-bold text-red-400 transition hover:text-red-300"
        >
          ← Back to Dashboard
        </Link>

        <div className="mt-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB WALLET
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            Withdraw
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
            Convert your Gold into an available withdrawal and submit
            your payout details for STRIKEHUB administration to review.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm font-bold text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-sm font-bold text-green-400">
            {success}
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2">

          <div className="rounded-3xl border border-yellow-500/20 bg-[#0e0d10]/90 p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-600">
              Available Gold
            </p>

            <p className="mt-3 text-4xl font-black text-yellow-400">
              {goldBalance.toLocaleString()}
            </p>

            <p className="mt-2 text-xs text-gray-600">
              Gold available in your wallet
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-600">
              Current Conversion
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              ₦{nairaPerGold.toFixed(2)}
            </p>

            <p className="mt-2 text-xs text-gray-600">
              Value of 1 Gold
            </p>
          </div>

        </div>

        {pendingWithdrawal && (
          <div className="mt-6 rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400">
              Withdrawal Pending
            </p>

            <p className="mt-2 text-lg font-black text-white">
              {pendingWithdrawal.amount_gold.toLocaleString()} Gold
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Submitted {formatDate(pendingWithdrawal.created_at)}
            </p>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              You cannot submit another withdrawal until this request
              has been processed.
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-3xl border border-red-500/20 bg-[#0e0d10]/90 p-6 sm:p-8"
        >

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              Withdrawal Request
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Choose amount
            </h2>
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-bold text-gray-300">
              {method === 'bloodstrike'
                ? 'Gold amount'
                : 'Cash amount (Naira)'}
            </label>

            <input
              type="number"
              min={method === 'bloodstrike' ? 300 : 3500}
              step={method === 'bloodstrike' ? 100 : 1}
              value={amount}
              onChange={(event) => {
                const value = event.target.value
                setAmount(value)
              }}
              disabled={Boolean(pendingWithdrawal) || submitting}
              inputMode="numeric"
              placeholder={
                method === 'bloodstrike'
                  ? 'Minimum 300 Gold'
                  : 'Minimum ₦3,500'
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-red-500"
            />

            <p className="mt-2 text-xs text-gray-600">
              {method === 'bloodstrike'
                ? `Minimum 300 Gold. Only 100-Gold increments are allowed. Available: ${goldBalance.toLocaleString()} Gold.`
                : `Minimum ₦3,500. Any whole-naira amount is allowed. Available value: ₦${maxBankNaira.toLocaleString('en-NG')}.`}
            </p>

            {method === 'bloodstrike' &&
              maxGoldWithdrawal < 300 && (
                <p className="mt-2 text-xs font-bold text-red-400">
                  You need at least 300 Gold to make a withdrawal.
                </p>
              )}

            {method === 'bank' &&
              enteredAmount >= 3500 &&
              requestedGold > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  This request requires approximately{' '}
                  <span className="font-bold text-yellow-400">
                    {requestedGold.toLocaleString()} Gold
                  </span>{' '}
                  at ₦{nairaPerGold.toFixed(2)} per Gold.
                </p>
              )}
          </div>

          <div className="mt-6 rounded-2xl border border-yellow-500/10 bg-yellow-500/[0.03] p-5">
            <p className="text-xs font-bold text-gray-500">
              Withdrawal value
            </p>

            <p className="mt-2 text-3xl font-black text-yellow-400">
              ₦
              {nairaValue.toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>

            <p className="mt-1 text-xs text-gray-600">
              {method === 'bloodstrike'
                ? `${requestedGold.toLocaleString()} Gold × ₦${nairaPerGold.toFixed(2)}`
                : `₦${enteredAmount.toLocaleString('en-NG')} requested • ${requestedGold.toLocaleString()} Gold required`}
            </p>

            {requestedGold > goldBalance && (
              <p className="mt-2 text-xs font-bold text-red-400">
                Insufficient Gold balance for this withdrawal.
              </p>
            )}
          </div>

          <div className="mt-8">
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Withdrawal method
            </label>

            <div className="grid gap-3 sm:grid-cols-2">

              <button
                type="button"
                onClick={() => {
                  setMethod('bloodstrike')
                  setAmount(
                    maxGoldWithdrawal >= 300
                      ? String(Math.min(300, maxGoldWithdrawal))
                      : '300'
                  )
                  setError('')
                  setSuccess('')
                }}
                disabled={Boolean(pendingWithdrawal) || submitting}
                className={`rounded-2xl border p-5 text-left transition ${
                  method === 'bloodstrike'
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <p className="font-black text-white">
                  BloodStrike
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Receive through your BloodStrike account.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('bank')
                  setAmount('3500')
                  setError('')
                  setSuccess('')
                }}
                disabled={Boolean(pendingWithdrawal) || submitting}
                className={`rounded-2xl border p-5 text-left transition ${
                  method === 'bank'
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <p className="font-black text-white">
                  Bank Account
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Receive the Naira value into your bank account.
                </p>
              </button>

            </div>
          </div>

          {method === 'bloodstrike' && (
            <div className="mt-6">
              <label className="mb-2 block text-sm font-bold text-gray-300">
                BloodStrike UID
              </label>

              <input
                value={bloodstrikeUid}
                onChange={(event) =>
                  setBloodstrikeUid(
                    event.target.value.replace(/\D/g, '').slice(0, 12)
                  )
                }
                inputMode="numeric"
                maxLength={12}
                placeholder="12-digit BloodStrike UID"
                disabled={Boolean(pendingWithdrawal) || submitting}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-red-500"
              />

              <p className="mt-2 text-xs text-gray-600">
                Enter the same 12-digit BloodStrike UID connected to
                your STRIKEHUB account.
              </p>
            </div>
          )}

          {method === 'bank' && (
            <div className="mt-6 space-y-4">

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Account holder name
                </label>

                <input
                  value={accountName}
                  onChange={(event) =>
                    setAccountName(event.target.value)
                  }
                  placeholder="Name on bank account"
                  disabled={Boolean(pendingWithdrawal) || submitting}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Bank name
                </label>

                <input
                  value={bankName}
                  onChange={(event) =>
                    setBankName(event.target.value)
                  }
                  placeholder="Bank name"
                  disabled={Boolean(pendingWithdrawal) || submitting}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-300">
                  Account number
                </label>

                <input
                  value={accountNumber}
                  onChange={(event) =>
                    setAccountNumber(
                      event.target.value.replace(/\D/g, '').slice(0, 10)
                    )
                  }
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit account number"
                  disabled={Boolean(pendingWithdrawal) || submitting}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-red-500"
                />
              </div>

            </div>
          )}

          <div className="mt-8">
            <label className="mb-2 block text-sm font-bold text-gray-300">
              Confirm with password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your STRIKEHUB password"
              disabled={Boolean(pendingWithdrawal) || submitting}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-red-500"
            />

            <p className="mt-2 text-xs leading-5 text-gray-600">
              Your password is used to confirm that you authorized
              this withdrawal.
            </p>
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              Boolean(pendingWithdrawal) ||
              !amountValid
            }
            className="mt-8 w-full rounded-xl bg-red-600 px-5 py-4 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting
              ? 'Submitting Withdrawal...'
              : pendingWithdrawal
                ? 'Withdrawal Pending'
                : method === 'bloodstrike'
                  ? `Withdraw ${requestedGold.toLocaleString()} Gold`
                  : `Withdraw ₦${enteredAmount.toLocaleString('en-NG')}`}
          </button>

        </form>

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#0e0d10]/90 p-6 sm:p-8">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              Withdrawal Activity
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Recent Requests
            </h2>
          </div>

          {withdrawals.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <p className="text-sm font-bold text-gray-500">
                No withdrawal requests yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {withdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                      <p className="font-black text-white">
                        {withdrawal.amount_gold.toLocaleString()} Gold
                      </p>

                      <p className="mt-1 text-xs capitalize text-gray-600">
                        {withdrawal.method === 'bloodstrike'
                          ? 'BloodStrike'
                          : 'Bank Account'}
                      </p>

                      <p className="mt-1 text-xs text-gray-600">
                        {formatDate(withdrawal.created_at)}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(
                        withdrawal.status
                      )}`}
                    >
                      {withdrawal.status}
                    </span>

                  </div>

                  {withdrawal.admin_note && (
                    <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-4">
                      <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
                        Admin Note
                      </p>

                      <p className="mt-2 text-xs leading-5 text-gray-400">
                        {withdrawal.admin_note}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </section>

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <p className="text-xs leading-6 text-gray-600">
            Withdrawals are reviewed by STRIKEHUB administration.
            The Gold required for the request is reserved when the request is submitted.
            Bank withdrawals accept any whole-naira amount from ₦3,500 upward,
            while BloodStrike withdrawals must be 300 Gold or more in 100-Gold increments.
            If a request is rejected, the appropriate refund will be
            handled by administration.
          </p>
        </div>

      </section>
    </div>
  )
}