'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function GoldValuePage() {
  const supabase = createClient()

  const [naira, setNaira] = useState('')
  const [usd, setUsd] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadRate() {
      const { data, error } = await supabase
        .from('conversion_rates')
        .select('naira_per_gold, usd_per_gold')
        .eq('id', 1)
        .single()

      if (error) {
        setError(error.message)
      } else {
        setNaira(String(data.naira_per_gold))
        setUsd(String(data.usd_per_gold))
      }

      setLoading(false)
    }

    loadRate()
  }, [])

  async function updateRate() {
    setMessage('')
    setError('')

    const nairaValue = Number(naira)
    const usdValue = Number(usd)

    if (!nairaValue || nairaValue <= 0) {
      setError('Enter a valid Naira value.')
      return
    }

    if (!usdValue || usdValue <= 0) {
      setError('Enter a valid USD value.')
      return
    }

    setSaving(true)

    const { error } = await supabase.rpc(
      'admin_update_conversion_rate',
      {
        p_naira_per_gold: nairaValue,
        p_usd_per_gold: usdValue,
      }
    )

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage('Gold conversion rate updated successfully.')
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">

      <header className="border-b border-red-900/30 bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">

          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-red-500">
              STRIKEHUB
            </p>

            <h1 className="mt-1 text-2xl font-black">
              GOLD VALUE
            </h1>
          </div>

          <Link
            href="/admin"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10"
          >
            Back to Admin
          </Link>

        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">

        <div className="mb-8">
          <p className="text-sm text-gray-400">
            Control the value of STRIKEHUB Gold.
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Gold Conversion
          </h2>
        </div>

        <div className="rounded-2xl border border-yellow-900/30 bg-[#101010] p-6">

          {loading ? (
            <p className="text-gray-400">
              Loading current conversion...
            </p>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-400">
                    1 Gold = Naira
                  </label>

                  <div className="flex items-center">
                    <span className="rounded-l-lg border border-white/10 bg-white/5 px-4 py-3 text-gray-400">
                      ₦
                    </span>

                    <input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      value={naira}
                      onChange={(e) => setNaira(e.target.value)}
                      className="w-full rounded-r-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-yellow-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-400">
                    1 Gold = USD
                  </label>

                  <div className="flex items-center">
                    <span className="rounded-l-lg border border-white/10 bg-white/5 px-4 py-3 text-gray-400">
                      $
                    </span>

                    <input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      value={usd}
                      onChange={(e) => setUsd(e.target.value)}
                      className="w-full rounded-r-lg border border-white/10 bg-[#080808] px-4 py-3 text-white outline-none focus:border-yellow-500"
                    />
                  </div>
                </div>

              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm text-gray-400">
                  Current conversion
                </p>

                <p className="mt-2 font-bold">
                  1 Gold = ₦{Number(naira || 0).toFixed(6)}
                </p>

                <p className="mt-1 font-bold">
                  1 Gold = ${Number(usd || 0).toFixed(6)}
                </p>
              </div>

              {error && (
                <div className="mt-5 rounded-lg border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-400">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-5 rounded-lg border border-green-900/40 bg-green-950/20 p-4 text-sm text-green-400">
                  {message}
                </div>
              )}

              <button
                type="button"
                onClick={updateRate}
                disabled={saving}
                className="mt-6 w-full rounded-lg bg-red-600 px-5 py-3 font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Update Gold Value'}
              </button>

            </>
          )}

        </div>

        <div className="mt-6 rounded-xl border border-red-900/30 bg-red-950/10 p-5">
          <p className="font-bold text-red-400">
            🔐 Administrator Only
          </p>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            Changing this value affects Gold-to-Naira and Gold-to-USD
            calculations across STRIKEHUB. Only administrator accounts can
            update the conversion.
          </p>
        </div>

      </section>
    </main>
  )
}