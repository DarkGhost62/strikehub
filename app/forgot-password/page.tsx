'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setMessage('')
    setError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage(
        'If an account exists for this email, a password reset link has been sent.'
      )
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <div className="mx-auto max-w-md">

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black">
            STRIKE<span className="text-red-500">HUB</span>
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            COMPETE. EARN. RISE.
          </p>

          <h2 className="mt-8 text-2xl font-bold">
            Reset your password
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-green-900 bg-green-950/40 p-3 text-sm text-green-300">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-600 px-4 py-3 font-bold hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>

          <p className="text-center text-sm">
            <a
              href="/login"
              className="text-red-400 hover:text-red-300"
            >
              Back to login
            </a>
          </p>
        </form>
      </div>
    </main>
  )
}