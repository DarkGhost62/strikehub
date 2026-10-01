'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SupabaseTestPage() {
  const [status, setStatus] = useState('Testing Supabase connection...')

  useEffect(() => {
    async function testConnection() {
      const supabase = createClient()

      const { error } = await supabase.auth.getSession()

      if (error) {
        setStatus(`Connection error: ${error.message}`)
      } else {
        setStatus('✅ STRIKEHUB is successfully connected to Supabase!')
      }
    }

    testConnection()
  }, [])

  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="rounded-2xl border border-red-900/50 bg-zinc-950 p-10 text-center">
        <h1 className="mb-4 text-3xl font-bold">STRIKEHUB</h1>
        <p className="text-zinc-400">{status}</p>
      </div>
    </main>
  )
}