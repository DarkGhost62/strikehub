'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [checkingUid, setCheckingUid] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [referralCode, setReferralCode] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')

    if (ref) {
      setReferralCode(ref.trim())
    }
  }, [])

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setMessage('')
    setError('')

    const form = new FormData(event.currentTarget)

    const uid = String(form.get('uid') || '').trim()
    const email = String(form.get('email') || '').trim()
    const phone = String(form.get('phone') || '').trim()
    const country = String(form.get('country') || '').trim()
    const inGameName = String(form.get('inGameName') || '').trim()

    const submittedReferralCode = String(
      form.get('referralCode') || ''
    ).trim()

    const password = String(form.get('password') || '')
    const confirmPassword = String(form.get('confirmPassword') || '')
    const termsAccepted = form.get('terms') === 'on'

    /*
     * STRIKEHUB PROFILE IMAGE
     *
     * Randomly choose one of the 15 profile images.
     *
     * The selected path is stored in the user's profile metadata
     * during registration so the same image can be saved to the
     * profiles table by the profile creation process.
     */
    const profileImageNumber = Math.floor(Math.random() * 15) + 1

    const profileImageUrl = `/profile-images/profile-${String(
      profileImageNumber
    ).padStart(2, '0')}.png`

    if (!/^\d{12}$/.test(uid)) {
      setError('BloodStrike UID must contain exactly 12 digits.')
      setLoading(false)
      return
    }

    if (!termsAccepted) {
      setError('You must agree to the Terms & Conditions.')
      setLoading(false)
      return
    }

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

    if (!inGameName) {
      setError('Enter your BloodStrike in-game name.')
      setLoading(false)
      return
    }

    // Check UID availability before creating the account
    setCheckingUid(true)

    const { data: uidAvailable, error: uidError } =
      await supabase.rpc('is_uid_available', {
        uid_to_check: uid,
      })

    setCheckingUid(false)

    if (uidError) {
      setError('Unable to check BloodStrike UID. Please try again.')
      setLoading(false)
      return
    }

    if (!uidAvailable) {
      setError(
        'This BloodStrike UID is already registered on STRIKEHUB.'
      )
      setLoading(false)
      return
    }

    /*
     * Create the Supabase account.
     *
     * profile_image_url is included in the auth metadata so the
     * profile creation process can save the selected image.
     */
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,

      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,

        data: {
          bloodstrike_uid: uid,
          phone,
          country,
          in_game_name: inGameName,
          referral_code: submittedReferralCode || null,
          terms_accepted: true,

          // Random STRIKEHUB profile image
          profile_image_url: profileImageUrl,
        },
      },
    })

    if (signUpError) {
      if (
        signUpError.message.toLowerCase().includes('already registered')
      ) {
        setError('An account with this email already exists.')
      } else {
        setError(signUpError.message)
      }

      setLoading(false)
      return
    }

    setMessage(
      'Registration successful! Check your email to verify your STRIKEHUB account.'
    )

    event.currentTarget.reset()
    setReferralCode('')
    setLoading(false)
  }

  const buttonText = checkingUid
    ? 'Checking UID...'
    : loading
      ? 'Creating account...'
      : 'Create account'

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
            Create your account
          </h2>
        </div>

        <form
          onSubmit={handleRegister}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
        >

          {/* BloodStrike UID */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              BloodStrike UID
            </label>

            <input
              name="uid"
              type="text"
              inputMode="numeric"
              maxLength={12}
              pattern="[0-9]{12}"
              required
              placeholder="12-digit UID"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />

            <p className="mt-1 text-xs text-zinc-500">
              Your UID must contain exactly 12 digits.
            </p>
          </div>

          {/* In-game name */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              In-game name
            </label>

            <input
              name="inGameName"
              required
              placeholder="Your BloodStrike name"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          {/* Email */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
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

          {/* Phone */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              Phone number
            </label>

            <input
              name="phone"
              type="tel"
              required
              placeholder="Phone number"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          {/* Country */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              Country
            </label>

            <input
              name="country"
              required
              placeholder="Country"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          {/* Password */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              Password
            </label>

            <input
              name="password"
              type="password"
              minLength={8}
              required
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          {/* Confirm password */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              Confirm password
            </label>

            <input
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              placeholder="Repeat password"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />
          </div>

          {/* Referral */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              Referral code
              <span className="ml-2 text-xs text-zinc-500">
                Optional
              </span>
            </label>

            <input
              name="referralCode"
              type="text"
              value={referralCode}
              onChange={(event) => setReferralCode(event.target.value)}
              placeholder="Enter referral code"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
            />

            {referralCode && (
              <p className="mt-1 text-xs text-green-400">
                Referral code applied from your invite link.
              </p>
            )}
          </div>

          {/* Terms */}

          <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-400">
            <input
              name="terms"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 accent-red-600"
            />

            <span>
              I agree to the STRIKEHUB{' '}
              <a
                href="/terms"
                className="text-red-400 hover:text-red-300"
              >
                Terms & Conditions
              </a>{' '}
              and understand the platform rules.
            </span>
          </label>

          {/* Messages */}

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

          {/* Submit */}

          <button
            type="submit"
            disabled={loading || checkingUid}
            className="w-full rounded-lg bg-red-600 px-4 py-3 font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonText}
          </button>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <a
              href="/login"
              className="text-red-400 hover:text-red-300"
            >
              Login
            </a>
          </p>

        </form>
      </div>
    </main>
  )
}