'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Badge = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  is_active: boolean
  created_at: string
  updated_at: string
}

const rarities = ['common', 'rare', 'epic', 'legendary']

export default function AdminBadgesPage() {
  const supabase = createClient()
  const [badges, setBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rarity, setRarity] = useState('common')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')

  const [giftBadge, setGiftBadge] = useState<Badge | null>(null)
  const [giftUid, setGiftUid] = useState('')
  const [giftReason, setGiftReason] = useState('')
  const [giftRecipient, setGiftRecipient] = useState<{ id: string; display_name: string | null; in_game_name: string | null } | null>(null)
  const [giftLookingUp, setGiftLookingUp] = useState(false)
  const [giftSending, setGiftSending] = useState(false)

  const [shopPrice, setShopPrice] = useState<Record<string, string>>({})
  const [shopListed, setShopListed] = useState<Record<string, boolean>>({})
  const [shopLoading, setShopLoading] = useState(false)

  async function verifyAdmin() {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) { window.location.href = '/login'; return false }

    const { data: role, error: roleError } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).single()

    if (roleError || role?.role !== 'admin') { window.location.href = '/'; return false }
    return true
  }

  async function loadBadges() {
    setLoading(true); setError('')
    const { data, error: loadError } = await supabase
      .from('badges')
      .select('id, name, description, image_url, rarity, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (loadError) { setError(`Could not load badges: ${loadError.message}`); setBadges([]) }
    else setBadges((data ?? []) as Badge[])
    setLoading(false)
  }

  async function loadBadgeShopListings(badgeList: Badge[]) {
    if (!badgeList.length) return

    const { data, error: shopError } = await supabase
      .from('shop_items')
      .select('id, badge_id, price_gold, is_active')
      .eq('item_type', 'badge')
      .in('badge_id', badgeList.map((badge) => badge.id))

    if (shopError) {
      setError(`Could not load badge Shop listings: ${shopError.message}`)
      return
    }

    const prices: Record<string, string> = {}
    const listed: Record<string, boolean> = {}

    for (const row of data ?? []) {
      const badgeId = row.badge_id as string
      prices[badgeId] = String(row.price_gold ?? '')
      listed[badgeId] = Boolean(row.is_active)
    }

    setShopPrice(prices)
    setShopListed(listed)
  }

  async function loadBadgesWithShop() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('badges')
      .select('id, name, description, image_url, rarity, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(`Could not load badges: ${loadError.message}`)
      setBadges([])
      setLoading(false)
      return
    }

    const nextBadges = (data ?? []) as Badge[]
    setBadges(nextBadges)
    await loadBadgeShopListings(nextBadges)
    setLoading(false)
  }

  async function addBadgeToShop(badge: Badge) {
    const rawPrice = shopPrice[badge.id]?.trim() ?? ''
    const price = Number(rawPrice)

    if (!Number.isInteger(price) || price <= 0) {
      setError('Enter a valid whole-number Gold price greater than 0.')
      return
    }

    setShopLoading(true)
    setError('')
    setMessage('')

    try {
      const { data: existing, error: lookupError } = await supabase
        .from('shop_items')
        .select('id')
        .eq('item_type', 'badge')
        .eq('badge_id', badge.id)
        .maybeSingle()

      if (lookupError) throw new Error(lookupError.message)

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('shop_items')
          .update({
            name: badge.name,
            description: badge.description,
            rarity: badge.rarity.toLowerCase(),
            price_gold: price,
            image_url: badge.image_url,
            is_active: true,
          })
          .eq('id', existing.id)

        if (updateError) throw new Error(updateError.message)
      } else {
        const { error: insertError } = await supabase
          .from('shop_items')
          .insert({
            name: badge.name,
            description: badge.description,
            item_type: 'badge',
            rarity: badge.rarity.toLowerCase(),
            price_gold: price,
            image_url: badge.image_url,
            is_active: true,
            title_id: null,
            badge_id: badge.id,
          })

        if (insertError) throw new Error(insertError.message)
      }

      setMessage(`"${badge.name}" is now listed in the Shop.`)
      await loadBadgesWithShop()
    } catch (shopError) {
      setError(shopError instanceof Error ? shopError.message : 'Could not list badge in Shop.')
    } finally {
      setShopLoading(false)
    }
  }

  async function removeBadgeFromShop(badge: Badge) {
    setShopLoading(true)
    setError('')
    setMessage('')

    try {
      const { error: updateError } = await supabase
        .from('shop_items')
        .update({ is_active: false })
        .eq('item_type', 'badge')
        .eq('badge_id', badge.id)

      if (updateError) throw new Error(updateError.message)

      setMessage(`"${badge.name}" was removed from the Shop. Existing owners keep it.`)
      await loadBadgesWithShop()
    } catch (shopError) {
      setError(shopError instanceof Error ? shopError.message : 'Could not remove badge from Shop.')
    } finally {
      setShopLoading(false)
    }
  }

  useEffect(() => {
    async function start() {
      const allowed = await verifyAdmin()
      if (allowed) await loadBadgesWithShop()
    }
    start()
  }, [])

  function resetForm() {
    setEditingId(null); setName(''); setDescription(''); setRarity('common')
    setImageUrl(''); setImageFile(null)
  }

  function editBadge(badge: Badge) {
    setEditingId(badge.id); setName(badge.name); setDescription(badge.description ?? '')
    setRarity(badge.rarity); setImageUrl(badge.image_url ?? ''); setImageFile(null)
    setMessage(''); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function uploadBadgeImage(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filePath = `badges/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('shop').upload(filePath, file, {
      cacheControl: '3600', upsert: false,
    })
    if (uploadError) throw new Error(`Image upload failed. Make sure the existing "shop" storage bucket allows admin uploads. ${uploadError.message}`)
    return supabase.storage.from('shop').getPublicUrl(filePath).data.publicUrl
  }

  async function saveBadge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setError('')
    const cleanedName = name.trim()
    const cleanedDescription = description.trim()

    if (!cleanedName) { setError('Badge name is required.'); return }
    if (cleanedName.length > 60) { setError('Badge name must be 60 characters or fewer.'); return }

    setSaving(true)
    try {
      let finalImageUrl = imageUrl.trim()
      if (imageFile) finalImageUrl = await uploadBadgeImage(imageFile)

      const payload = {
        name: cleanedName,
        description: cleanedDescription || null,
        rarity,
        image_url: finalImageUrl || null,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error: updateError } = await supabase.from('badges').update(payload).eq('id', editingId)
        if (updateError) throw new Error(updateError.message)
        setMessage('Badge updated successfully.')
      } else {
        const { error: insertError } = await supabase.from('badges').insert({ ...payload, is_active: true })
        if (insertError) throw new Error(insertError.message)
        setMessage('Badge created successfully.')
      }

      resetForm(); await loadBadgesWithShop()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save badge.')
    } finally { setSaving(false) }
  }

  async function toggleBadge(badge: Badge) {
    setMessage(''); setError('')
    const { error: updateError } = await supabase.from('badges').update({
      is_active: !badge.is_active, updated_at: new Date().toISOString(),
    }).eq('id', badge.id)
    if (updateError) { setError(`Could not update badge: ${updateError.message}`); return }
    setMessage(`${badge.name} is now ${!badge.is_active ? 'active' : 'inactive'}.`)
    await loadBadgesWithShop()
  }

  async function deleteBadge(badge: Badge) {
    if (!window.confirm(`Delete "${badge.name}"? This cannot be undone.`)) return
    setMessage(''); setError('')
    const { error: deleteError } = await supabase.from('badges').delete().eq('id', badge.id)
    if (deleteError) { setError(`Could not delete badge: ${deleteError.message}`); return }
    setMessage(`"${badge.name}" was deleted.`); await loadBadgesWithShop()
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) { setImageFile(null); return }
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); event.target.value = ''; return }
    if (file.size > 5 * 1024 * 1024) { setError('Badge images must be 5 MB or smaller.'); event.target.value = ''; return }
    setError(''); setImageFile(file)
  }

  function closeGiftModal() {
    if (giftSending) return
    setGiftBadge(null)
    setGiftUid('')
    setGiftReason('')
    setGiftRecipient(null)
    setGiftLookingUp(false)
  }

  async function lookupGiftRecipient() {
    setError('')
    setMessage('')
    setGiftRecipient(null)

    const uid = giftUid.trim()

    if (!/^\d{12}$/.test(uid)) {
      setError('BloodStrike UID must be exactly 12 digits.')
      return
    }

    setGiftLookingUp(true)

    try {
      const { data, error: lookupError } = await supabase
        .from('profiles')
        .select('id, display_name, in_game_name')
        .eq('bloodstrike_uid', uid)
        .maybeSingle()

      if (lookupError) throw new Error(lookupError.message)
      if (!data) throw new Error('No STRIKEHUB account was found with that BloodStrike UID.')

      setGiftRecipient(data as { id: string; display_name: string | null; in_game_name: string | null })
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : 'Could not find that player.')
    } finally {
      setGiftLookingUp(false)
    }
  }

  async function sendGift() {
    if (!giftBadge || !giftRecipient) return

    setError('')
    setMessage('')
    setGiftSending(true)

    try {
      const { data, error: giftError } = await supabase.rpc('admin_gift_badge', {
        p_recipient_user_id: giftRecipient.id,
        p_badge_id: giftBadge.id,
        p_reason: giftReason.trim() || null,
      })

      if (giftError) throw new Error(giftError.message)

      const result = data as { success?: boolean; message?: string } | null
      if (result?.success === false) {
        throw new Error(result.message || 'Could not gift badge.')
      }

      setMessage(`"${giftBadge.name}" was gifted successfully. The player will receive a notification.`)
      closeGiftModal()
    } catch (giftError) {
      setError(giftError instanceof Error ? giftError.message : 'Could not gift badge.')
    } finally {
      setGiftSending(false)
    }
  }

  function usePromptTemplate() {
    setPrompt('Create a premium STRIKEHUB esports badge. Describe the symbol, shape, colors, material, lighting, rarity, and visual meaning. The artwork should be centered, clean, readable at small size, and suitable as a player profile badge.')
  }

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <header className="border-b border-red-900/30 bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div>
            <Link href="/admin" className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">← Admin Panel</Link>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Badge Management</h1>
            <p className="mt-1 text-xs text-gray-500">Create, manage, and prepare player badges for the STRIKEHUB Shop.</p>
          </div>
          <Link href="/admin/titles" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black transition hover:border-red-500/30 hover:bg-white/10">Titles →</Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-6">
        {error && <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
        {message && <div className="mb-6 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300">✓ {message}</div>}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <section className="rounded-3xl border border-red-500/20 bg-gradient-to-br from-[#18070a] via-[#101010] to-[#0c0c0c] p-6 shadow-2xl shadow-red-950/10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">{editingId ? 'Edit Badge' : 'Create Badge'}</p>
            <h2 className="mt-2 text-2xl font-black">{editingId ? 'Update badge' : 'New badge'}</h2>

            <form onSubmit={saveBadge} className="mt-6 space-y-5">
              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Badge Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Inferno Champion" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none transition placeholder:text-gray-700 focus:border-red-500/50" />
              </label>

              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Explain what this badge represents." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none transition placeholder:text-gray-700 focus:border-red-500/50" />
              </label>

              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Rarity</span>
                <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm font-bold outline-none focus:border-red-500/50">
                  {rarities.map((value) => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
                </select>
              </label>

              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Badge Image</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-xs file:font-black file:text-white" />
                <p className="mt-2 text-[10px] leading-4 text-gray-600">PNG/WebP is recommended. Maximum 5 MB.</p>
              </label>

              <label className="block"><span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Or Image URL</span>
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none placeholder:text-gray-700 focus:border-red-500/50" />
              </label>

              <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-black text-yellow-400">AI BADGE IDEA</p><p className="mt-1 text-[10px] leading-4 text-gray-500">Describe the badge you want. The secure image-generation connection will be added before this becomes an active generator.</p></div>
                  <button type="button" onClick={usePromptTemplate} className="shrink-0 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-[9px] font-black text-yellow-400 hover:bg-yellow-500/10">Example</button>
                </div>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} placeholder="Describe the badge artwork..." className="mt-3 w-full resize-none rounded-xl border border-yellow-500/10 bg-black/30 px-4 py-3 text-xs text-gray-300 outline-none placeholder:text-gray-700 focus:border-yellow-500/30" />
                <button type="button" disabled className="mt-3 w-full cursor-not-allowed rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-xs font-black text-yellow-500/60">AI GENERATION — CONNECT API</button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Badge'}</button>
                {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-gray-300 hover:bg-white/10">Cancel</button>}
              </div>
            </form>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">Badge Library</p><h2 className="mt-1 text-2xl font-black">{badges.length} {badges.length === 1 ? 'Badge' : 'Badges'}</h2></div>
              <button type="button" onClick={loadBadges} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black hover:bg-white/10">Refresh</button>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-[#101010] p-10 text-center text-sm font-bold text-gray-500">Loading badges...</div>
            ) : badges.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-[#101010] p-10 text-center">
                <div className="text-4xl">🏅</div><h3 className="mt-4 text-lg font-black">No badges created yet</h3><p className="mt-2 text-xs leading-5 text-gray-600">Create your first real STRIKEHUB badge using the form.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {badges.map((badge) => (
                  <article key={badge.id} className="rounded-2xl border border-white/10 bg-[#101010] p-4 transition hover:border-red-500/20">
                    <div className="flex gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                        {badge.image_url ? <img src={badge.image_url} alt={badge.name} className="h-full w-full object-contain" /> : <span className="text-2xl opacity-30">🏅</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black">{badge.name}</h3>
                          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-yellow-400">{badge.rarity}</span>
                          <span className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${badge.is_active ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-500'}`}>{badge.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{badge.description || 'No description.'}</p>
                        <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-gray-600">
                          Shop: {shopListed[badge.id] ? `Listed • ${shopPrice[badge.id] || 'No price'} Gold` : 'Not listed'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => editBadge(badge)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black hover:bg-white/10">Edit</button>
                          <button type="button" onClick={() => toggleBadge(badge)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black hover:bg-white/10">{badge.is_active ? 'Deactivate' : 'Activate'}</button>
                          <button type="button" onClick={() => deleteBadge(badge)} className="rounded-lg border border-red-500/15 bg-red-500/5 px-3 py-2 text-[9px] font-black text-red-400 hover:bg-red-500/10">Delete</button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={shopPrice[badge.id] ?? ''}
                            onChange={(e) => setShopPrice((current) => ({ ...current, [badge.id]: e.target.value }))}
                            placeholder="Gold"
                            className="w-20 rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-3 py-2 text-[9px] font-black text-yellow-300 outline-none placeholder:text-gray-600"
                          />
                          {shopListed[badge.id] ? (
                            <button
                              type="button"
                              onClick={() => removeBadgeFromShop(badge)}
                              disabled={shopLoading}
                              className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-[9px] font-black text-orange-400 hover:bg-orange-500/10 disabled:opacity-40"
                            >
                              Remove Shop
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addBadgeToShop(badge)}
                              disabled={shopLoading}
                              className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-[9px] font-black text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                            >
                              {shopPrice[badge.id] ? 'List in Shop' : 'Set Price + List'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setGiftBadge(badge)
                              setGiftUid('')
                              setGiftReason('')
                              setGiftRecipient(null)
                              setError('')
                              setMessage('')
                            }}
                            disabled={!badge.is_active}
                            className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-[9px] font-black text-yellow-400 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            🎁 Gift
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      {giftBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-yellow-500/20 bg-[#101010] p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400">Admin Gift</p>
                <h2 className="mt-2 text-2xl font-black">Gift {giftBadge.name}</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  This gives the badge directly to a player without charging Gold.
                </p>
              </div>
              <button
                type="button"
                onClick={closeGiftModal}
                disabled={giftSending}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-gray-400 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Player BloodStrike UID
                </span>
                <div className="mt-2 flex gap-2">
                  <input
                    value={giftUid}
                    onChange={(e) => {
                      setGiftUid(e.target.value.replace(/\D/g, '').slice(0, 12))
                      setGiftRecipient(null)
                    }}
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="12-digit UID"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none placeholder:text-gray-700 focus:border-yellow-500/50"
                  />
                  <button
                    type="button"
                    onClick={lookupGiftRecipient}
                    disabled={giftLookingUp || giftUid.length !== 12}
                    className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-xs font-black text-yellow-400 hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {giftLookingUp ? 'Finding...' : 'Find'}
                  </button>
                </div>
              </label>

              {giftRecipient && (
                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-green-400">Player Found</p>
                  <p className="mt-2 text-sm font-black text-white">
                    {giftRecipient.in_game_name || giftRecipient.display_name || 'STRIKEHUB Player'}
                  </p>
                  {giftRecipient.display_name && (
                    <p className="mt-1 text-xs text-gray-500">{giftRecipient.display_name}</p>
                  )}
                </div>
              )}

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Reason (Optional)
                </span>
                <textarea
                  value={giftReason}
                  onChange={(e) => setGiftReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. Tournament winner, special award..."
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-gray-300 outline-none placeholder:text-gray-700 focus:border-yellow-500/50"
                />
              </label>

              <div className="rounded-2xl border border-yellow-500/10 bg-yellow-500/[0.03] p-4 text-xs leading-5 text-gray-500">
                The badge will be added directly to the player's account. No Gold will be deducted.
                A <span className="font-bold text-yellow-400">shop</span> notification will be created automatically.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeGiftModal}
                  disabled={giftSending}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-gray-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendGift}
                  disabled={giftSending || !giftRecipient}
                  className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {giftSending ? 'Gifting...' : '🎁 Gift Badge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
