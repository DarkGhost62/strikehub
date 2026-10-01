'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type StakeType = 'match_winner' | 'total_kills'
type Status = 'open' | 'closed' | 'completed' | 'cancelled'

type StakeOption = {
  id?: string
  label: string
  odds: string
  result_status: 'pending' | 'won' | 'lost' | 'cancelled'
}

type Fixture = {
  id: string
  title: string
  description: string | null
  stake_type: StakeType
  fixture_image_url: string | null
  starts_at: string
  status: Status
  result: string | null
  result_value: number | null
  created_at: string
  stake_options: StakeOption[]
}

const MAX_IMAGE_SIZE = 15 * 1024 * 1024

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function typeLabel(type: StakeType) {
  return type === 'match_winner' ? 'Match Winner' : 'Total Kills'
}

export default function AdminStakesPage() {
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState<'all' | Status>('all')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [stakeType, setStakeType] = useState<StakeType>('match_winner')
  const [startsAt, setStartsAt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [resultFixture, setResultFixture] = useState<Fixture | null>(null)
  const [resultOptionId, setResultOptionId] = useState('')
  const [resultText, setResultText] = useState('')
  const [resultValue, setResultValue] = useState('')
  const [settlingResult, setSettlingResult] = useState(false)

  const [options, setOptions] = useState<StakeOption[]>([
    { label: '', odds: '', result_status: 'pending' },
    { label: '', odds: '', result_status: 'pending' },
  ])

  async function checkAdmin() {
    const { data, error: adminError } = await supabase.rpc('is_admin')
    if (adminError || !data) {
      window.location.href = '/dashboard'
      return false
    }
    return true
  }

  async function loadFixtures() {
    setLoading(true)
    setError('')

    const allowed = await checkAdmin()
    if (!allowed) return

    const { data, error: loadError } = await supabase
      .from('stake_fixtures')
      .select(`
        id,
        title,
        description,
        stake_type,
        fixture_image_url,
        starts_at,
        status,
        result,
        result_value,
        created_at,
        stake_options (
          id,
          label,
          odds,
          result_status
        )
      `)
      .order('starts_at', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setFixtures([])
    } else {
      setFixtures((data || []) as Fixture[])
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadFixtures()
  }, [])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setStakeType('match_winner')
    setStartsAt('')
    setImageUrl('')
    setOptions([
      { label: '', odds: '', result_status: 'pending' },
      { label: '', odds: '', result_status: 'pending' },
    ])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function editFixture(fixture: Fixture) {
    setEditingId(fixture.id)
    setTitle(fixture.title)
    setDescription(fixture.description || '')
    setStakeType(fixture.stake_type)
    setStartsAt(new Date(fixture.starts_at).toISOString().slice(0, 16))
    setImageUrl(fixture.fixture_image_url || '')
    setOptions(
      fixture.stake_options.length
        ? fixture.stake_options.map((item) => ({
            id: item.id,
            label: item.label,
            odds: String(item.odds),
            result_status: item.result_status,
          }))
        : [
            { label: '', odds: '', result_status: 'pending' },
            { label: '', odds: '', result_status: 'pending' },
          ]
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function uploadImage(file: File) {
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Fixture image must be 15 MB or smaller.')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }

    setUploading(true)
    setError('')

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('stake-fixture-images')
      .upload(path, file, { upsert: false, contentType: file.type })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('stake-fixture-images')
      .getPublicUrl(path)

    setImageUrl(data.publicUrl)
    setUploading(false)
    setSuccess('Fixture image uploaded.')
  }

  function updateOption(index: number, field: 'label' | 'odds', value: string) {
    setOptions((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    )
  }

  function addOption() {
    setOptions((current) => [
      ...current,
      { label: '', odds: '', result_status: 'pending' },
    ])
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function saveFixture(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const cleanTitle = title.trim()
    const cleanOptions = options
      .map((item) => ({ label: item.label.trim(), odds: Number(item.odds) }))
      .filter((item) => item.label)

    if (!cleanTitle) return setError('Fixture title is required.')
    if (!startsAt) return setError('Start date and time are required.')
    if (cleanOptions.length < 2) return setError('Add at least two betting options.')
    if (cleanOptions.some((item) => !Number.isFinite(item.odds) || item.odds <= 1)) {
      return setError('Every option must have valid odds greater than 1.00.')
    }
    if (stakeType === 'match_winner' && cleanOptions.length !== 2) {
      return setError('Match Winner fixtures must have exactly two options.')
    }

    setSaving(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('You must be logged in as an admin.')

      let fixtureId = editingId

      if (editingId) {
        const { error: updateError } = await supabase
          .from('stake_fixtures')
          .update({
            title: cleanTitle,
            description: description.trim() || null,
            stake_type: stakeType,
            fixture_image_url: imageUrl || null,
            starts_at: new Date(startsAt).toISOString(),
          })
          .eq('id', editingId)

        if (updateError) throw updateError

        const { error: deleteOptionsError } = await supabase
          .from('stake_options')
          .delete()
          .eq('fixture_id', editingId)

        if (deleteOptionsError) throw deleteOptionsError
      } else {
        const { data: fixture, error: insertError } = await supabase
          .from('stake_fixtures')
          .insert({
            title: cleanTitle,
            description: description.trim() || null,
            stake_type: stakeType,
            fixture_image_url: imageUrl || null,
            starts_at: new Date(startsAt).toISOString(),
            status: 'open',
            created_by: userData.user.id,
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        fixtureId = fixture.id
      }

      const { error: optionsError } = await supabase
        .from('stake_options')
        .insert(
          cleanOptions.map((item) => ({
            fixture_id: fixtureId,
            label: item.label,
            odds: item.odds,
            result_status: 'pending',
          }))
        )

      if (optionsError) throw optionsError

      setSuccess(editingId ? 'Stake fixture updated.' : 'Stake fixture created.')
      resetForm()
      await loadFixtures()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save fixture.')
    } finally {
      setSaving(false)
    }
  }

  function openResultModal(fixture: Fixture) {
    setError('')
    setSuccess('')
    setResultFixture(fixture)
    setResultOptionId(fixture.stake_options[0]?.id || '')
    setResultText(fixture.stake_options[0]?.label || '')
    setResultValue('')
  }

  function closeResultModal() {
    if (settlingResult) return
    setResultFixture(null)
    setResultOptionId('')
    setResultText('')
    setResultValue('')
  }

  function getSupabaseErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object') {
      const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
      const parts = [
        typeof value.message === 'string' ? value.message : '',
        typeof value.details === 'string' ? `Details: ${value.details}` : '',
        typeof value.hint === 'string' ? `Hint: ${value.hint}` : '',
        typeof value.code === 'string' ? `Code: ${value.code}` : '',
      ].filter(Boolean)

      if (parts.length > 0) return parts.join(' — ')
    }

    if (error instanceof Error && error.message) return error.message
    if (typeof error === 'string' && error.trim()) return error

    return fallback
  }

  async function submitResult() {
    if (!resultFixture) return

    setError('')
    setSuccess('')

    let winningOptionId = resultOptionId
    let cleanResult = ''
    let numericResult: number | null = null

    if (resultFixture.stake_type === 'total_kills') {
      const value = Number(resultValue)

      if (!resultValue.trim() || !Number.isFinite(value) || value < 0) {
        setError('Enter the actual final kill count.')
        return
      }

      numericResult = value

      const parsedOptions = resultFixture.stake_options.map((option) => {
        const match = option.label.trim().match(/^(over|under)\s+(\d+(?:\.\d+)?)$/i)
        return {
          option,
          direction: match?.[1]?.toLowerCase() || null,
          threshold: match ? Number(match[2]) : null,
        }
      })

      const overOptions = parsedOptions.filter((item) => item.direction === 'over')
      const underOptions = parsedOptions.filter((item) => item.direction === 'under')

      if (overOptions.length !== 1 || underOptions.length !== 1) {
        setError('Total Kills options must contain exactly one OVER number and one UNDER number, for example OVER 100 and UNDER 100.')
        return
      }

      const over = overOptions[0]
      const under = underOptions[0]

      if (
        over.threshold === null ||
        under.threshold === null ||
        over.threshold !== under.threshold
      ) {
        setError('OVER and UNDER must use the same kill threshold.')
        return
      }

      if (value === over.threshold) {
        setError(`A final score of exactly ${over.threshold} kills is not covered by OVER ${over.threshold} or UNDER ${under.threshold}. Use a market with an appropriate threshold.`)
        return
      }

      const winner = value > over.threshold ? over : under
      winningOptionId = winner.option.id || ''

      if (!winningOptionId) {
        setError('The winning option could not be identified.')
        return
      }

      cleanResult = `${value} Kills`
    } else {
      const selectedOption = resultFixture.stake_options.find((item) => item.id === resultOptionId)

      if (!selectedOption) {
        setError('Select the winning team/result option.')
        return
      }

      cleanResult = selectedOption.label.trim()
      if (!cleanResult) {
        setError('Enter the game result.')
        return
      }
    }

    setSettlingResult(true)

    try {
      const { data, error: settlementError } = await supabase.rpc('admin_settle_stake_fixture', {
        p_fixture_id: resultFixture.id,
        p_winning_option_id: winningOptionId,
        p_result: cleanResult,
        p_result_value: numericResult,
        p_action: 'complete',
      })

      if (settlementError) throw settlementError

      const summary = data as {
        won_count?: number
        lost_count?: number
        pending_count?: number
      } | null

      setSuccess(
        `Fixture completed and stakes settled. Won: ${summary?.won_count ?? 0}, Lost: ${summary?.lost_count ?? 0}, Still pending: ${summary?.pending_count ?? 0}.`
      )
      closeResultModal()
      await loadFixtures()
    } catch (err) {
      setError(getSupabaseErrorMessage(err, 'Unable to settle the fixture result.'))
    } finally {
      setSettlingResult(false)
    }
  }

  async function changeStatus(fixture: Fixture, status: Status) {
    setError('')
    setSuccess('')

    if (status === 'completed') {
      openResultModal(fixture)
      return
    }

    if (status === 'cancelled') {
      setSettlingResult(true)
      try {
        const { data, error: settlementError } = await supabase.rpc('admin_settle_stake_fixture', {
          p_fixture_id: fixture.id,
          p_winning_option_id: null,
          p_result: 'Cancelled',
          p_result_value: null,
          p_action: 'cancel',
        })

        if (settlementError) throw settlementError

        const summary = data as { refunded_tickets?: number } | null
        setSuccess(`Fixture cancelled. Refunded tickets: ${summary?.refunded_tickets ?? 0}.`)
        await loadFixtures()
      } catch (err) {
        setError(getSupabaseErrorMessage(err, 'Unable to cancel the fixture and refund tickets.'))
      } finally {
        setSettlingResult(false)
      }
      return
    }

    const { error: updateError } = await supabase
      .from('stake_fixtures')
      .update({ status })
      .eq('id', fixture.id)

    if (updateError) setError(updateError.message)
    else {
      setSuccess(`Fixture marked ${status}.`)
      await loadFixtures()
    }
  }

  const visibleFixtures = fixtures.filter((fixture) =>
    filter === 'all' ? true : fixture.status === filter
  )

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="text-xs font-bold text-red-400 hover:text-red-300">
              ← Back to Admin
            </Link>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.3em] text-red-400">Admin Management</p>
            <h1 className="mt-2 text-3xl font-black">Stake Management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Create and manage betting fixtures, odds, images and fixture status.
            </p>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-gray-300 hover:bg-white/10">
              + New Fixture
            </button>
          )}
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>}
        {success && <div className="mb-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-300">{success}</div>}

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">{editingId ? 'Edit Fixture' : 'Create Stake Fixture'}</p>
            <h2 className="mt-1 text-xl font-black">{editingId ? 'Update fixture' : 'New fixture'}</h2>
          </div>

          <form onSubmit={saveFixture} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Fixture Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bencer vs Misfits" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500/50" />
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Stake Type</span>
                <select value={stakeType} onChange={(e) => setStakeType(e.target.value as StakeType)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none">
                  <option value="match_winner">Match Winner</option>
                  <option value="total_kills">Total Kills</option>
                </select>
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Date & Time</span>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none" />
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Fixture Image</span>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0])} className="mt-2 block w-full text-xs text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-red-500 file:px-3 file:py-2 file:text-xs file:font-black file:text-white" />
                <p className="mt-2 text-[10px] text-gray-600">JPG, PNG, WEBP · maximum 15 MB</p>
                {uploading && <p className="mt-2 text-xs text-yellow-400">Uploading image...</p>}
                {imageUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                    <img src={imageUrl} alt="Fixture preview" className="h-36 w-full object-cover" />
                    <button type="button" onClick={() => setImageUrl('')} className="w-full border-t border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-red-300">Remove image</button>
                  </div>
                )}
              </label>
            </div>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional fixture details..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500/50" />
            </label>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Betting Options & Odds</p>
                  <p className="mt-1 text-xs text-gray-600">Match Winner requires exactly two options.</p>
                </div>
                {stakeType === 'total_kills' && (
                  <button type="button" onClick={addOption} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-gray-300 hover:bg-white/5">+ Add Option</button>
                )}
              </div>

              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 md:grid-cols-[1fr_180px_auto]">
                    <input value={option.label} onChange={(e) => updateOption(index, 'label', e.target.value)} placeholder={stakeType === 'match_winner' ? `Option ${index + 1}` : 'e.g. Over 18 Kills'} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none" />
                    <input value={option.odds} onChange={(e) => updateOption(index, 'odds', e.target.value)} type="number" min="1.01" step="0.01" placeholder="Odds e.g. 1.80" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none" />
                    {stakeType === 'total_kills' && options.length > 2 ? (
                      <button type="button" onClick={() => removeOption(index)} className="rounded-xl border border-red-500/20 px-4 py-3 text-xs font-black text-red-300 hover:bg-red-500/10">Remove</button>
                    ) : <div />}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button disabled={saving || uploading} type="submit" className="rounded-xl bg-yellow-400 px-6 py-3 text-sm font-black text-black disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update Fixture' : 'Create Fixture'}
              </button>
              {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-white/10 px-6 py-3 text-sm font-bold text-gray-300 hover:bg-white/5">Cancel</button>}
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">Existing Stakes</p>
              <h2 className="mt-1 text-xl font-black">Fixtures</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'open', 'closed', 'completed', 'cancelled'] as const).map((item) => (
                <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase ${filter === item ? 'bg-red-500 text-white' : 'border border-white/10 text-gray-500 hover:bg-white/5'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading fixtures...</div>
          ) : visibleFixtures.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center text-sm text-gray-600">No fixtures found.</div>
          ) : (
            <div className="space-y-4">
              {visibleFixtures.map((fixture) => (
                <article key={fixture.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  <div className="grid gap-5 p-4 md:grid-cols-[180px_1fr]">
                    <div className="overflow-hidden rounded-xl bg-black/30">
                      {fixture.fixture_image_url ? <img src={fixture.fixture_image_url} alt={fixture.title} className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center text-3xl">🎯</div>}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black">{fixture.title}</h3>
                          <p className="mt-1 text-xs text-gray-500">{typeLabel(fixture.stake_type)} · {formatDate(fixture.starts_at)}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${fixture.status === 'open' ? 'bg-green-500/10 text-green-400' : fixture.status === 'completed' ? 'bg-blue-500/10 text-blue-400' : fixture.status === 'cancelled' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{fixture.status}</span>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {fixture.stake_options.map((option) => (
                          <div key={option.id || option.label} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                            <span className="text-sm font-bold text-gray-300">{option.label}</span>
                            <span className="text-sm font-black text-yellow-400">{Number(option.odds).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {fixture.status !== 'completed' && fixture.status !== 'cancelled' && <button type="button" onClick={() => editFixture(fixture)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5">Edit</button>}
                        {fixture.status === 'open' && <button type="button" onClick={() => void changeStatus(fixture, 'closed')} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500/10">Close Betting</button>}
                        {fixture.status === 'closed' && <button type="button" onClick={() => void changeStatus(fixture, 'open')} className="rounded-lg border border-green-500/20 px-3 py-2 text-xs font-bold text-green-300 hover:bg-green-500/10">Reopen</button>}
                        {fixture.status === 'closed' && <button type="button" onClick={() => openResultModal(fixture)} className="rounded-lg border border-blue-500/20 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/10">Set Result</button>}
                        {fixture.status !== 'completed' && fixture.status !== 'cancelled' && <button type="button" onClick={() => void changeStatus(fixture, 'cancelled')} className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10">Cancel</button>}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {resultFixture && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#111014] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">Stake Result</p>
                  <h2 className="mt-2 text-2xl font-black">Set Game Result</h2>
                  <p className="mt-1 text-sm text-gray-500">{resultFixture.title}</p>
                </div>
                <button type="button" onClick={closeResultModal} disabled={settlingResult} className="rounded-lg px-3 py-2 text-gray-500 hover:bg-white/5 hover:text-white">✕</button>
              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm leading-5 text-red-300">
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-4">
                {resultFixture.stake_type === 'total_kills' ? (
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Actual Final Kills</span>
                    <input
                      value={resultValue}
                      onChange={(e) => setResultValue(e.target.value)}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 130"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                    />
                    <p className="mt-2 text-[10px] leading-5 text-gray-600">
                      Enter the actual final kill count. The system automatically determines whether OVER or UNDER won.
                    </p>
                    <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-gray-400">
                      {resultFixture.stake_options.map((option) => (
                        <div key={option.id || option.label} className="flex items-center justify-between py-1">
                          <span>{option.label}</span>
                          <span className="text-gray-600">{Number(option.odds).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </label>
                ) : (
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Winning Team / Result Option</span>
                    <select
                      value={resultOptionId}
                      onChange={(e) => setResultOptionId(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                    >
                      {resultFixture.stake_options.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={closeResultModal} disabled={settlingResult} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => void submitResult()} disabled={settlingResult} className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{settlingResult ? 'Saving Result...' : 'Complete Fixture'}</button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-yellow-500/10 bg-yellow-500/5 p-4 text-xs leading-6 text-gray-500">
          <strong className="text-yellow-400">Result note:</strong> For Total Kills, enter the actual final kill count and the system determines the winning OVER/UNDER option automatically. Gold settlement is applied automatically when a fixture result is completed or cancelled.
        </div>
      </div>
    </main>
  )
}