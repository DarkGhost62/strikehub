'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Title = {
  id: string
  name: string
  description: string | null
  rarity: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type GiftRecipient = {
  id: string
  display_name: string | null
  in_game_name: string | null
}

type ShopListing = {
  id: string
  title_id: string | null
  name: string
  price_gold: number
  is_limited: boolean
  quantity: number | null
  remaining_quantity: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
}

const RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
  'Mythic',
]

export default function AdminTitlesPage() {
  const supabase = createClient()

  const [titles, setTitles] = useState<Title[]>([])
  const [shopListings, setShopListings] = useState<ShopListing[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rarity, setRarity] = useState('Common')
  const [isActive, setIsActive] = useState(true)

  const [shopModalOpen, setShopModalOpen] = useState(false)
  const [shopTitle, setShopTitle] = useState<Title | null>(null)

  const [shopPrice, setShopPrice] = useState('10')
  const [shopLimited, setShopLimited] = useState(false)
  const [shopQuantity, setShopQuantity] = useState('1')
  const [shopStartsAt, setShopStartsAt] = useState('')
  const [shopExpiresAt, setShopExpiresAt] = useState('')
  const [shopActive, setShopActive] = useState(true)

  // Gift state
  const [giftTitle, setGiftTitle] = useState<Title | null>(null)
  const [giftUid, setGiftUid] = useState('')
  const [giftReason, setGiftReason] = useState('')
  const [giftRecipient, setGiftRecipient] = useState<GiftRecipient | null>(null)
  const [giftLookingUp, setGiftLookingUp] = useState(false)
  const [giftSending, setGiftSending] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function verifyAdmin() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('You must be logged in.')
    }

    const { data: role, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (roleError) {
      throw new Error(roleError.message)
    }

    if (!role || !['admin', 'super_admin'].includes(role.role)) {
      throw new Error('You do not have permission to access this page.')
    }

    return user
  }

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      await verifyAdmin()

      const { data: titleData, error: titleError } = await supabase
        .from('titles')
        .select(
          'id, name, description, rarity, is_active, created_at, updated_at'
        )
        .order('created_at', { ascending: false })

      if (titleError) {
        throw new Error(titleError.message)
      }

      const { data: shopData, error: shopError } = await supabase
        .from('shop_items')
        .select(
          'id, title_id, name, price_gold, is_limited, quantity, remaining_quantity, starts_at, expires_at, is_active'
        )
        .eq('item_type', 'title')
        .order('created_at', { ascending: false })

      if (shopError) {
        throw new Error(shopError.message)
      }

      setTitles(titleData ?? [])
      setShopListings(shopData ?? [])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Unable to load titles.')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setRarity('Common')
    setIsActive(true)
  }

  function startEdit(title: Title) {
    setEditingId(title.id)
    setName(title.name)
    setDescription(title.description ?? '')
    setRarity(title.rarity)
    setIsActive(title.is_active)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function saveTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage('')
    setError('')

    const cleanName = name.trim()
    const cleanDescription = description.trim()

    if (!cleanName) {
      setError('Please enter a title name.')
      return
    }

    if (cleanName.length > 50) {
      setError('Title name must be 50 characters or fewer.')
      return
    }

    setSaving(true)

    try {
      const user = await verifyAdmin()

      if (editingId) {
        const { error: updateError } = await supabase
          .from('titles')
          .update({
            name: cleanName,
            description: cleanDescription || null,
            rarity,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)

        if (updateError) {
          throw new Error(updateError.message)
        }

        setMessage('Title updated successfully.')
      } else {
        const { error: insertError } = await supabase.from('titles').insert({
          name: cleanName,
          description: cleanDescription || null,
          rarity,
          is_active: isActive,
        })

        if (insertError) {
          throw new Error(insertError.message)
        }

        setMessage('Title created successfully.')
      }

      resetForm()
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Unable to save title.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTitle(title: Title) {
    setMessage('')
    setError('')

    try {
      await verifyAdmin()

      const { error: updateError } = await supabase
        .from('titles')
        .update({
          is_active: !title.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', title.id)

      if (updateError) {
        throw new Error(updateError.message)
      }

      setMessage(
        title.is_active
          ? `${title.name} has been deactivated.`
          : `${title.name} has been activated.`
      )

      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Unable to update title.')
    }
  }

  async function deleteTitle(title: Title) {
    const confirmed = window.confirm(
      `Delete "${title.name}"?\n\nThis cannot be undone.`
    )

    if (!confirmed) return

    setMessage('')
    setError('')

    try {
      await verifyAdmin()

      const linkedShop = shopListings.find(
        (listing) => listing.title_id === title.id
      )

      if (linkedShop) {
        setError(
          'This title is linked to a Shop listing. Remove the Shop listing first.'
        )
        return
      }

      const { error: deleteError } = await supabase
        .from('titles')
        .delete()
        .eq('id', title.id)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      setMessage(`${title.name} was deleted.`)
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Unable to delete title.')
    }
  }

  function openShopModal(title: Title) {
    setShopTitle(title)
    setMessage('')
    setError('')

    const existingListing = shopListings.find(
      (listing) => listing.title_id === title.id
    )

    if (existingListing) {
      setShopPrice(String(existingListing.price_gold))
      setShopLimited(existingListing.is_limited)
      setShopQuantity(String(existingListing.quantity ?? 1))
      setShopStartsAt(
        existingListing.starts_at
          ? toDateTimeLocal(existingListing.starts_at)
          : ''
      )
      setShopExpiresAt(
        existingListing.expires_at
          ? toDateTimeLocal(existingListing.expires_at)
          : ''
      )
      setShopActive(existingListing.is_active)
    } else {
      setShopPrice('10')
      setShopLimited(false)
      setShopQuantity('1')
      setShopStartsAt('')
      setShopExpiresAt('')
      setShopActive(true)
    }

    setShopModalOpen(true)
  }

  function toDateTimeLocal(value: string) {
    const date = new Date(value)

    const pad = (number: number) =>
      String(number).padStart(2, '0')

    return `${date.getFullYear()}-${pad(
      date.getMonth() + 1
    )}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`
  }

  async function saveShopListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!shopTitle) return

    setMessage('')
    setError('')
    setSaving(true)

    try {
      const user = await verifyAdmin()

      const price = Number(shopPrice)

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Shop price must be greater than 0 Gold.')
      }

      const quantity = Number(shopQuantity)

      if (
        shopLimited &&
        (!Number.isInteger(quantity) || quantity <= 0)
      ) {
        throw new Error(
          'Limited quantity must be a whole number greater than 0.'
        )
      }

      const existingListing = shopListings.find(
        (listing) => listing.title_id === shopTitle.id
      )

      const payload = {
        name: shopTitle.name,
        description: shopTitle.description,
        item_type: 'title',
        rarity: shopTitle.rarity.toLowerCase(),
        price_gold: Math.floor(price),
        image_url: null,
        is_limited: shopLimited,
        quantity: shopLimited ? quantity : null,
        remaining_quantity: shopLimited
          ? existingListing?.remaining_quantity ?? quantity
          : null,
        starts_at: shopStartsAt
          ? new Date(shopStartsAt).toISOString()
          : null,
        expires_at: shopExpiresAt
          ? new Date(shopExpiresAt).toISOString()
          : null,
        is_active: shopActive,
        created_by: user.id,
        title_id: shopTitle.id,
        badge_id: null,
      }

      if (existingListing) {
        const { error: updateError } = await supabase
          .from('shop_items')
          .update({
            name: payload.name,
            description: payload.description,
            item_type: payload.item_type,
            rarity: payload.rarity,
            price_gold: payload.price_gold,
            image_url: payload.image_url,
            is_limited: payload.is_limited,
            quantity: payload.quantity,
            remaining_quantity: payload.remaining_quantity,
            starts_at: payload.starts_at,
            expires_at: payload.expires_at,
            is_active: payload.is_active,
            title_id: payload.title_id,
            badge_id: payload.badge_id,
          })
          .eq('id', existingListing.id)

        if (updateError) {
          throw new Error(updateError.message)
        }

        setMessage(`${shopTitle.name} Shop listing updated successfully.`)
      } else {
        const { error: insertError } = await supabase
          .from('shop_items')
          .insert(payload)

        if (insertError) {
          throw new Error(insertError.message)
        }

        setMessage(`${shopTitle.name} was added to the Shop successfully.`)
      }

      setShopModalOpen(false)
      setShopTitle(null)
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Unable to save Shop listing.')
    } finally {
      setSaving(false)
    }
  }

  async function removeShopListing(title: Title) {
    const listing = shopListings.find(
      (item) => item.title_id === title.id
    )

    if (!listing) return

    const confirmed = window.confirm(
      `Remove "${title.name}" from the Shop?`
    )

    if (!confirmed) return

    setMessage('')
    setError('')

    try {
      await verifyAdmin()

      // IMPORTANT:
      // Never delete the shop_items row here. Players' inventory and
      // equipped cosmetics use this row as the permanent item reference.
      // Removing an item from the Shop only means making its Shop listing
      // inactive. This preserves every player's ownership.
      const { error: updateError } = await supabase
        .from('shop_items')
        .update({ is_active: false })
        .eq('id', listing.id)
        .eq('item_type', 'title')

      if (updateError) {
        throw new Error(updateError.message)
      }

      setMessage(
        `${title.name} was removed from the Shop. Player-owned copies were not affected.`
      )
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Unable to remove Shop listing.')
    }
  }

  function openGiftModal(title: Title) {
    setGiftTitle(title)
    setGiftUid('')
    setGiftReason('')
    setGiftRecipient(null)
    setGiftLookingUp(false)
    setError('')
    setMessage('')
  }

  function closeGiftModal() {
    if (giftSending) return

    setGiftTitle(null)
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

      setGiftRecipient(data as GiftRecipient)
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : 'Could not find that player.'
      )
    } finally {
      setGiftLookingUp(false)
    }
  }

  async function sendGift() {
    if (!giftTitle || !giftRecipient) return

    setError('')
    setMessage('')
    setGiftSending(true)

    try {
      const { data, error: giftError } = await supabase.rpc('admin_gift_title', {
        p_recipient_user_id: giftRecipient.id,
        p_title_id: giftTitle.id,
        p_reason: giftReason.trim() || null,
      })

      if (giftError) throw new Error(giftError.message)

      const result = data as {
        success?: boolean
        message?: string
        title_name?: string
      } | null

      if (result?.success === false) {
        throw new Error(result.message || 'Could not gift title.')
      }

      setMessage(
        `"${giftTitle.name}" was gifted successfully. The player will receive a notification.`
      )
      closeGiftModal()
    } catch (giftError) {
      setError(
        giftError instanceof Error
          ? giftError.message
          : 'Could not gift title.'
      )
    } finally {
      setGiftSending(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-5">
          <div className="text-center">
            <div className="animate-pulse text-4xl">🏷️</div>
            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading Titles Management...
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen pb-20 text-white">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">

        {/* HEADER */}
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-xs font-bold text-gray-500 transition hover:text-white"
            >
              ← Back to Admin
            </Link>

            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500">
              COSMETIC MANAGEMENT
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Titles
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Create player titles, control availability, and connect titles
              directly to the STRIKEHUB Shop.
            </p>
          </div>

          <Link
            href="/admin/badges"
            className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-3 text-xs font-black text-red-400 transition hover:bg-red-500/10"
          >
            🏅 Manage Badges →
          </Link>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4">
            <p className="text-xs font-semibold leading-5 text-red-300">
              {error}
            </p>
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
            <p className="text-xs font-semibold leading-5 text-emerald-300">
              ✓ {message}
            </p>
          </div>
        )}

        {/* CREATE / EDIT */}
        <section className="rounded-3xl border border-white/10 bg-[#0b0a0d]/95 p-5 shadow-xl sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500">
                {editingId ? 'EDIT TITLE' : 'CREATE TITLE'}
              </p>

              <h2 className="mt-2 text-xl font-black">
                {editingId ? 'Edit Player Title' : 'New Player Title'}
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Titles are text-based cosmetics shown on player profiles.
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400 transition hover:bg-white/5 hover:text-white"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={saveTitle}>
            <div className="grid gap-5 md:grid-cols-2">

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Title Name
                </span>

                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={50}
                  placeholder="Example: Shadow Hunter"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-gray-700 focus:border-yellow-500/50"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Rarity
                </span>

                <select
                  value={rarity}
                  onChange={(event) => setRarity(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#151217] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-yellow-500/50"
                >
                  {RARITIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Description
                </span>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Describe how the player earned or unlocked this title."
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-gray-700 focus:border-yellow-500/50"
                />
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="h-4 w-4 accent-yellow-500"
                />

                <span>
                  <span className="block text-xs font-black text-white">
                    Active Title
                  </span>

                  <span className="mt-1 block text-[10px] text-gray-600">
                    Inactive titles cannot be newly used or displayed.
                  </span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 rounded-xl bg-yellow-500 px-6 py-3 text-sm font-black text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Save Changes'
                  : 'Create Title'}
            </button>
          </form>
        </section>

        {/* TITLE LIST */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-[#0b0a0d]/95 p-5 shadow-xl sm:p-7">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                TITLE LIBRARY
              </p>

              <h2 className="mt-2 text-xl font-black">
                {titles.length} Title{titles.length === 1 ? '' : 's'}
              </h2>
            </div>
          </div>

          {titles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-12 text-center">
              <div className="text-4xl">🏷️</div>

              <p className="mt-4 text-sm font-black text-gray-300">
                No titles yet
              </p>

              <p className="mt-1 text-xs text-gray-600">
                Create your first player title above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {titles.map((title) => {
                const listing = shopListings.find(
                  (item) => item.title_id === title.id
                )

                return (
                  <div
                    key={title.id}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-white">
                            {title.name}
                          </h3>

                          <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-yellow-400">
                            {title.rarity}
                          </span>

                          <span
                            className={`rounded-lg border px-2 py-1 text-[8px] font-black uppercase tracking-wider ${
                              title.is_active
                                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                                : 'border-white/10 bg-white/[0.02] text-gray-600'
                            }`}
                          >
                            {title.is_active ? 'Active' : 'Inactive'}
                          </span>

                          {listing && (
                            <span
                              className={`rounded-lg border px-2 py-1 text-[8px] font-black uppercase tracking-wider ${
                                listing.is_active
                                  ? 'border-red-500/20 bg-red-500/5 text-red-400'
                                  : 'border-white/10 bg-white/[0.02] text-gray-600'
                              }`}
                            >
                              {listing.is_active
                                ? `SHOP • ${listing.price_gold} GOLD`
                                : 'SHOP • PAUSED'}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-xs leading-5 text-gray-500">
                          {title.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(title)}
                          className="rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-300 transition hover:bg-white/5 hover:text-white"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleTitle(title)}
                          className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-yellow-400 transition hover:bg-yellow-500/10"
                        >
                          {title.is_active ? 'Deactivate' : 'Activate'}
                        </button>

                        {listing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openShopModal(title)}
                              className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-red-400 transition hover:bg-red-500/10"
                            >
                              Shop Settings
                            </button>

                            <button
                              type="button"
                              onClick={() => removeShopListing(title)}
                              className="rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-500 transition hover:bg-red-500/5 hover:text-red-400"
                            >
                              Remove Shop
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openShopModal(title)}
                            className="rounded-xl bg-red-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-red-500"
                          >
                            🛒 Add to Shop
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openGiftModal(title)}
                          disabled={!title.is_active || !listing}
                          title={!listing ? 'Add this title to the Shop before gifting it.' : undefined}
                          className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-yellow-400 transition hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          🎁 Gift
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteTitle(title)}
                          className="rounded-xl border border-red-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-gray-600 transition hover:border-red-500/20 hover:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* SHOP MODAL */}
      {giftTitle && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-yellow-500/20 bg-[#101010] p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400">
                  Admin Gift
                </p>
                <h2 className="mt-2 text-2xl font-black">Gift {giftTitle.name}</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  This gives the title directly to a player without charging Gold.
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
                  <p className="text-[10px] font-black uppercase tracking-wider text-green-400">
                    Player Found
                  </p>
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
                The title will be added directly to the player's account. No Gold will be deducted.
                A notification will be created automatically.
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
                  onClick={() => void sendGift()}
                  disabled={giftSending || !giftRecipient}
                  className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {giftSending ? 'Gifting...' : '🎁 Gift Title'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shopModalOpen && shopTitle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-[#100d12] p-6 shadow-2xl sm:p-7">

            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                  SHOP LISTING
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  {shopTitle.name}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Connect this title to the player Shop.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShopModalOpen(false)
                  setShopTitle(null)
                }}
                className="text-xl text-gray-600 transition hover:text-white"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveShopListing} className="mt-7 space-y-5">

              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Price — Gold
                </span>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={shopPrice}
                  onChange={(event) => setShopPrice(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white outline-none focus:border-yellow-500/50"
                />
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="checkbox"
                  checked={shopLimited}
                  onChange={(event) => setShopLimited(event.target.checked)}
                  className="h-4 w-4 accent-red-500"
                />

                <span>
                  <span className="block text-xs font-black text-white">
                    Limited Quantity
                  </span>

                  <span className="mt-1 block text-[10px] text-gray-600">
                    Enable a limited number of purchases.
                  </span>
                </span>
              </label>

              {shopLimited && (
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    Quantity
                  </span>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={shopQuantity}
                    onChange={(event) => setShopQuantity(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-yellow-500/50"
                  />
                </label>
              )}

              <div className="grid gap-5 sm:grid-cols-2">

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    Starts
                  </span>

                  <input
                    type="datetime-local"
                    value={shopStartsAt}
                    onChange={(event) =>
                      setShopStartsAt(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs font-semibold text-white outline-none focus:border-yellow-500/50"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                    Expires
                  </span>

                  <input
                    type="datetime-local"
                    value={shopExpiresAt}
                    onChange={(event) =>
                      setShopExpiresAt(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs font-semibold text-white outline-none focus:border-yellow-500/50"
                  />
                </label>

              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="checkbox"
                  checked={shopActive}
                  onChange={(event) =>
                    setShopActive(event.target.checked)
                  }
                  className="h-4 w-4 accent-emerald-500"
                />

                <span>
                  <span className="block text-xs font-black text-white">
                    Listing Active
                  </span>

                  <span className="mt-1 block text-[10px] text-gray-600">
                    Players can see and purchase this title when active.
                  </span>
                </span>
              </label>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : shopListings.some(
                        (listing) =>
                          listing.title_id === shopTitle.id
                      )
                      ? 'Save Shop Listing'
                      : '🛒 Add Title to Shop'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShopModalOpen(false)
                    setShopTitle(null)
                  }}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-gray-400 transition hover:bg-white/5 hover:text-white"
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </main>
  )
}