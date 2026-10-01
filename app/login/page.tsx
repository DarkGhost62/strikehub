'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const form = new FormData(event.currentTarget)

    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight">
            STRIKE<span className="text-red-500">HUB</span>
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            COMPETE. EARN. RISE.
          </p>

          <h2 className="mt-8 text-2xl font-bold">
            Welcome back
          </h2>
        </div>

        <form
          onSubmit={handleLogin}
          className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Email
            </label>

            <input
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Password
            </label>

            <input
              name="password"
              type="password"
              required
              placeholder="Your password"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-red-600 px-4 py-3 font-bold transition hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div className="flex justify-between text-sm">
            <a
              href="/forgot-password"
              className="text-zinc-400 hover:text-white"
            >
              Forgot password?
            </a>

            <a
              href="/register"
              className="text-red-400 hover:text-red-300"
            >
              Create account
            </a>
          </div>
        </form>
      </div>
    </main>
  )
}