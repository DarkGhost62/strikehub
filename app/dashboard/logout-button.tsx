'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      setLoading(false)
      return
    }

    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="mt-3 flex w-full items-center gap-3 rounded-xl border border-red-500/10 px-3 py-3 text-left text-sm font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
    >
      <span>↪</span>
      <span>{loading ? 'Logging out...' : 'Logout'}</span>
    </button>
  )
}