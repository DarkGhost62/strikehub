'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [checkingUid, setCheckingUid] = useState(false)
  const [verifyingUid, setVerifyingUid] = useState(false)
  const [uid, setUid] = useState('')
  const [verifiedUid, setVerifiedUid] = useState('')
  const [verifiedUsername, setVerifiedUsername] = useState('')
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

  function handleUidChange(value: string) {
    const nextUid = value.replace(/\D/g, '').slice(0, 12)

    setUid(nextUid)
    setMessage('')
    setError('')

    // If the UID changes after verification, require verification again.
    if (nextUid !== verifiedUid) {
      setVerifiedUid('')
      setVerifiedUsername('')
    }
  }

  async function handleVerifyUid() {
    const cleanUid = uid.trim()

    setMessage('')
    setError('')

    if (!/^\d{12}$/.test(cleanUid)) {
      setError('BloodStrike UID must contain exactly 12 digits.')
      return
    }

    setVerifyingUid(true)

    try {
      const response = await fetch('/api/verify-bloodstrike', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: cleanUid,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.verified || !result?.username) {
        setVerifiedUid('')
        setVerifiedUsername('')
        setError(
          result?.error ||
            result?.message ||
            'Unable to verify this BloodStrike UID. Please check the UID and try again.'
        )
        return
      }

      setVerifiedUid(cleanUid)
      setVerifiedUsername(String(result.username).trim())
      setMessage('BloodStrike UID verified successfully.')
    } catch {
      setVerifiedUid('')
      setVerifiedUsername('')
      setError('Unable to verify BloodStrike UID. Please try again.')
    } finally {
      setVerifyingUid(false)
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setMessage('')
    setError('')

    const form = new FormData(event.currentTarget)

    const currentUid = uid.trim()
    const email = String(form.get('email') || '').trim()
    const phone = String(form.get('phone') || '').trim()
    const country = String(form.get('country') || '').trim()

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

    if (!/^\d{12}$/.test(currentUid)) {
      setError('BloodStrike UID must contain exactly 12 digits.')
      setLoading(false)
      return
    }

    if (verifiedUid !== currentUid || !verifiedUsername) {
      setError('Please verify your BloodStrike UID before creating your account.')
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

    // Check UID availability before creating the account
    setCheckingUid(true)

    const { data: uidAvailable, error: uidError } =
      await supabase.rpc('is_uid_available', {
        uid_to_check: currentUid,
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
          bloodstrike_uid: currentUid,
          phone,
          country,

          // Always use the verified BloodStrike username.
          in_game_name: verifiedUsername,

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
    setUid('')
    setVerifiedUid('')
    setVerifiedUsername('')
    setReferralCode('')
    setLoading(false)
  }

  const buttonText = checkingUid
    ? 'Checking UID...'
    : loading
      ? 'Creating account...'
      : 'Create account'

  const verifyButtonText = verifyingUid
    ? 'Verifying...'
    : verifiedUid === uid && verifiedUsername
      ? 'Verified ✓'
      : 'Verify'

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

            <div className="flex gap-2">
              <input
                name="uid"
                type="text"
                inputMode="numeric"
                maxLength={12}
                pattern="[0-9]{12}"
                value={uid}
                onChange={(event) => handleUidChange(event.target.value)}
                required
                placeholder="12-digit UID"
                className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-red-500"
              />

              <button
                type="button"
                onClick={handleVerifyUid}
                disabled={
                  verifyingUid ||
                  loading ||
                  checkingUid ||
                  !/^\d{12}$/.test(uid)
                }
                className="shrink-0 rounded-lg bg-red-600 px-4 py-3 font-bold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyButtonText}
              </button>
            </div>

            <p className="mt-1 text-xs text-zinc-500">
              Your UID must contain exactly 12 digits.
            </p>

            {verifiedUid === uid && verifiedUsername && (
              <p className="mt-1 text-xs text-green-400">
                ✓ UID verified successfully.
              </p>
            )}
          </div>

          {/* In-game name */}

          <div>
            <label className="mb-1 block text-sm text-zinc-300">
              In-game name
            </label>

            <input
              name="inGameName"
              type="text"
              value={verifiedUsername}
              readOnly
              required
              placeholder="Verify your UID first"
              className="w-full cursor-not-allowed rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-300 outline-none"
            />

            <p className="mt-1 text-xs text-zinc-500">
              Your in-game name is automatically retrieved from BloodStrike and cannot be changed.
            </p>
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
            disabled={loading || checkingUid || verifyingUid}
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
