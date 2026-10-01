'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setMessage('')
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage(
        'Your password has been changed successfully.'
      )

      setPassword('')
      setConfirmPassword('')
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
            Create new password
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              New password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Confirm password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
              placeholder="Repeat your password"
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
            {loading ? 'Updating...' : 'Update password'}
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