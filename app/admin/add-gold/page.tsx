'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AddGoldPage() {
  const supabase = createClient()

  const [goldBalance, setGoldBalance] = useState(0)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState(
    'STRIKEHUB Admin Wallet Funding'
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadWallet() {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: adminCheck, error: adminError } =
      await supabase.rpc('is_admin')

    if (adminError || !adminCheck) {
      window.location.href = '/dashboard'
      return
    }

    const { data, error: walletError } = await supabase
      .from('admin_wallet')
      .select('gold_balance')
      .eq('id', 1)
      .single()

    if (walletError) {
      setError(walletError.message)
    } else {
      setGoldBalance(Number(data?.gold_balance ?? 0))
    }

    setLoading(false)
  }

  useEffect(() => {
    loadWallet()
  }, [])

  async function addGold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage('')
    setError('')

    const numericAmount = Number(amount)

    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      setError('Enter a whole number of Gold greater than 0.')
      return
    }

    if (!description.trim()) {
      setError('Please enter a description.')
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(
          'Your session has expired. Please log in again.'
        )
      }

      const { data: adminCheck, error: adminError } =
        await supabase.rpc('is_admin')

      if (adminError) {
        throw new Error(adminError.message)
      }

      if (!adminCheck) {
        throw new Error('Administrator access is required.')
      }

      const { error: addError } = await supabase.rpc(
        'admin_add_gold',
        {
          p_amount: numericAmount,
          p_description: description.trim(),
        }
      )

      if (addError) {
        throw new Error(addError.message)
      }

      setMessage(
        `${numericAmount.toLocaleString()} Gold was successfully added to the Admin Wallet.`
      )

      setAmount('')

      await loadWallet()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to add Gold.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-red-600/10 blur-[140px]" />
        <div className="absolute -right-40 bottom-20 h-96 w-96 rounded-full bg-orange-500/10 blur-[140px]" />

        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,0.5) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-red-900/30 bg-[#0b0b0b]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
              STRIKEHUB
            </p>

            <h1 className="mt-1 text-2xl font-black">
              Add Gold
            </h1>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
          >
            ← Admin Panel
          </Link>
        </div>
      </header>

      {/* Content */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-2xl">
          {/* Current balance */}
          <div className="rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-[#15110a] to-[#0d0d0d] p-7 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-500">
              Current Admin Wallet
            </p>

            <div className="mt-3 flex items-end gap-3">
              <span className="text-5xl font-black text-yellow-400">
                {loading
                  ? '...'
                  : goldBalance.toLocaleString()}
              </span>

              <span className="mb-2 text-sm font-black text-gray-500">
                GOLD
              </span>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              This is the Gold available in the STRIKEHUB
              platform treasury.
            </p>
          </div>

          {/* Add Gold form */}
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#101010]/95 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-red-500">
                Wallet Funding
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Fund Admin Wallet
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Add Gold to the Admin Wallet. This Gold can
                later be used to reward players.
              </p>
            </div>

            {message && (
              <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-bold text-green-400">
                ✓ {message}
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
                {error}
              </div>
            )}

            <form
              onSubmit={addGold}
              className="space-y-6"
            >
              <div>
                <label className="text-sm font-bold text-gray-300">
                  Gold Amount
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  placeholder="Example: 100"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-lg font-bold text-white outline-none transition placeholder:text-gray-700 focus:border-yellow-500/50"
                />

                <p className="mt-2 text-xs text-gray-600">
                  Enter a whole number. Example: 100 Gold.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-gray-300">
                  Description
                </label>

                <input
                  type="text"
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Why are you funding the wallet?"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-yellow-500 px-5 py-4 text-sm font-black text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Adding Gold...'
                  : '🪙 Add Gold to Admin Wallet'}
              </button>
            </form>
          </div>

          {/* Important notice */}
          <div className="mt-6 rounded-2xl border border-red-900/30 bg-red-950/10 p-5">
            <p className="font-bold text-red-400">
              🔐 Admin Only
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Gold can only be added by an authenticated
              STRIKEHUB administrator. The database verifies
              administrator access before changing the wallet.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}