'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type GiftRecipient = {
  id: string
  display_name: string | null
  in_game_name: string | null
}

type Background = {
  id: string
  name: string
  description: string | null
  rarity: string
  price_gold: number
  image_url: string | null
  is_limited: boolean
  quantity: number | null
  remaining_quantity: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export default function AdminBackgroundsPage() {
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [backgrounds, setBackgrounds] = useState<Background[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [editing, setEditing] = useState<Background | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rarity, setRarity] = useState('common')
  const [priceGold, setPriceGold] = useState('10')
  const [imageUrl, setImageUrl] = useState('')
  const [isLimited, setIsLimited] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [isActive, setIsActive] = useState(true)

  // Gift state
  const [giftBackground, setGiftBackground] = useState<Background | null>(null)
  const [giftUid, setGiftUid] = useState('')
  const [giftReason, setGiftReason] = useState('')
  const [giftRecipient, setGiftRecipient] = useState<GiftRecipient | null>(null)
  const [giftLookingUp, setGiftLookingUp] = useState(false)
  const [giftSending, setGiftSending] = useState(false)

  useEffect(() => {
    void loadBackgrounds()
  }, [])

  async function loadBackgrounds() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('shop_items')
      .select(
        'id,name,description,rarity,price_gold,image_url,is_limited,quantity,remaining_quantity,starts_at,expires_at,is_active,created_at'
      )
      .eq('item_type', 'background')
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setBackgrounds([])
    } else {
      setBackgrounds((data || []) as Background[])
    }

    setLoading(false)
  }

  function resetForm() {
    setEditing(null)
    setName('')
    setDescription('')
    setRarity('common')
    setPriceGold('10')
    setImageUrl('')
    setIsLimited(false)
    setQuantity('')
    setStartsAt('')
    setExpiresAt('')
    setIsActive(true)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function editBackground(background: Background) {
    setEditing(background)
    setName(background.name)
    setDescription(background.description || '')
    setRarity((background.rarity || 'common').toLowerCase())
    setPriceGold(String(background.price_gold ?? 10))
    setImageUrl(background.image_url || '')
    setIsLimited(background.is_limited)
    setQuantity(background.quantity == null ? '' : String(background.quantity))
    setStartsAt(
      background.starts_at
        ? new Date(background.starts_at).toISOString().slice(0, 16)
        : ''
    )
    setExpiresAt(
      background.expires_at
        ? new Date(background.expires_at).toISOString().slice(0, 16)
        : ''
    )
    setIsActive(background.is_active)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function uploadImage(file: File) {
    setError('')
    setMessage('')

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setError('Please choose a PNG, JPG/JPEG, or WEBP image.')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Background artwork must be 8 MB or smaller.')
      return
    }

    setUploading(true)

    try {
      const extension =
        file.type === 'image/png'
          ? 'png'
          : file.type === 'image/webp'
            ? 'webp'
            : 'jpg'

      const path = `backgrounds/${crypto.randomUUID()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('shop')
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data } = supabase.storage.from('shop').getPublicUrl(path)

      setImageUrl(data.publicUrl)
      setMessage(
        'Background artwork uploaded. JPG, PNG or WEBP artwork is recommended for profile backgrounds.'
      )
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Could not upload artwork.'
      )
    } finally {
      setUploading(false)
    }
  }

  async function saveBackground() {
    setError('')
    setMessage('')

    if (!name.trim()) {
      setError('Enter a background name.')
      return
    }

    const price = Number(priceGold)

    if (!Number.isInteger(price) || price < 0) {
      setError('Price must be a whole number of Gold.')
      return
    }

    const qty = isLimited ? Number(quantity) : null

    if (isLimited && (qty === null || !Number.isInteger(qty) || qty <= 0)) {
      setError('Limited backgrounds need a quantity greater than 0.')
      return
    }

    if (
      startsAt &&
      expiresAt &&
      new Date(expiresAt).getTime() <= new Date(startsAt).getTime()
    ) {
      setError('Expires At must be later than Starts At.')
      return
    }

    setSaving(true)

    try {
      let remainingQuantity = qty

      if (editing && isLimited && qty !== null) {
        const oldQuantity = editing.quantity ?? 0
        const oldRemaining = editing.remaining_quantity ?? 0
        const sold = Math.max(oldQuantity - oldRemaining, 0)

        remainingQuantity = Math.max(qty - sold, 0)
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || `${name.trim()} profile background.`,
        item_type: 'background',
        rarity: rarity.toLowerCase(),
        price_gold: price,
        image_url: imageUrl.trim() || null,
        is_limited: isLimited,
        quantity: qty,
        remaining_quantity: remainingQuantity,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        is_active: isActive,
      }

      if (editing) {
        const { error: updateError } = await supabase
          .from('shop_items')
          .update(payload)
          .eq('id', editing.id)
          .eq('item_type', 'background')

        if (updateError) {
          throw new Error(updateError.message)
        }

        setMessage('Background updated successfully.')
      } else {
        const { data: userData } = await supabase.auth.getUser()

        const { error: insertError } = await supabase
          .from('shop_items')
          .insert({
            ...payload,
            created_by: userData.user?.id ?? null,
          })

        if (insertError) {
          throw new Error(insertError.message)
        }

        setMessage(
          'Background created successfully and is now available in Shop according to its active/schedule settings.'
        )
      }

      resetForm()
      await loadBackgrounds()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save background.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleBackground(background: Background) {
    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('shop_items')
      .update({ is_active: !background.is_active })
      .eq('id', background.id)
      .eq('item_type', 'background')

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(background.is_active ? 'Background deactivated.' : 'Background activated.')
    await loadBackgrounds()
  }

  async function deleteBackground(background: Background) {
    const confirmed = window.confirm(
      `Remove "${background.name}" from the Shop?\n\nThe background will stay in the system and remain in players' Inventory.`
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    const { error: updateError } = await supabase
      .from('shop_items')
      .update({ is_active: false })
      .eq('id', background.id)
      .eq('item_type', 'background')

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage('Background removed from the Shop. Player-owned copies were not affected.')

    if (editing?.id === background.id) {
      resetForm()
    }

    await loadBackgrounds()
  }

  function openGiftModal(background: Background) {
    setGiftBackground(background)
    setGiftUid('')
    setGiftReason('')
    setGiftRecipient(null)
    setError('')
    setMessage('')
  }

  function closeGiftModal() {
    if (giftSending) return

    setGiftBackground(null)
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
    if (!giftBackground || !giftRecipient) return

    setError('')
    setMessage('')
    setGiftSending(true)

    try {
      const { data, error: giftError } = await supabase.rpc('admin_gift_background', {
        p_recipient_user_id: giftRecipient.id,
        p_shop_item_id: giftBackground.id,
        p_reason: giftReason.trim() || null,
      })

      if (giftError) throw new Error(giftError.message)

      const result = data as {
        success?: boolean
        message?: string
        item_name?: string
      } | null

      if (result?.success === false) {
        throw new Error(result.message || 'Could not gift background.')
      }

      setMessage(
        `"${giftBackground.name}" was gifted successfully. The player will receive a notification.`
      )
      closeGiftModal()
    } catch (giftError) {
      setError(
        giftError instanceof Error
          ? giftError.message
          : 'Could not gift background.'
      )
    } finally {
      setGiftSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">
              Admin Management
            </p>

            <h1 className="mt-2 text-3xl font-black">Profile Backgrounds</h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Create and manage profile backgrounds that fill the player&apos;s profile card.
              Backgrounds use the existing Shop, Inventory and equipped-item systems.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/admin"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-gray-300 hover:bg-white/10"
            >
              ← Admin Panel
            </a>

            {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-gray-300 hover:bg-white/10"
            >
              + New Background
            </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-300">
            {message}
          </div>
        )}

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
              {editing ? 'Edit Background' : 'Create Background'}
            </p>

            <h2 className="mt-1 text-xl font-black">
              {editing ? editing.name : 'New Profile Background'}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Name
              </span>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Inferno Background"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500/50"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Rarity
              </span>

              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
              >
                {RARITIES.map((item) => (
                  <option key={item} value={item}>
                    {item.toUpperCase()}
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
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what makes this background special..."
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500/50"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Price (Gold)
              </span>

              <input
                type="number"
                min="0"
                value={priceGold}
                onChange={(e) => setPriceGold(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500/50"
              />
            </label>

            <div className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Artwork
              </span>

              <input
                ref={fileInputRef}
                id="background-artwork-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]

                  if (file) {
                    void uploadImage(file)
                  }
                }}
              />

              <label
                htmlFor="background-artwork-upload"
                className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-center text-xs font-black text-red-400 transition hover:bg-red-500/10"
              >
                {uploading
                  ? 'Uploading artwork...'
                  : '🖼️ Choose Background Artwork'}
              </label>

              <p className="mt-2 text-[10px] leading-4 text-gray-600">
                PNG, JPG/JPEG or WEBP. Landscape artwork is recommended so the background fills the profile card cleanly.
              </p>

              {imageUrl && (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
                  <div className="relative flex min-h-32 items-center justify-center overflow-hidden rounded-lg bg-[#151515]">
                    <div className="absolute inset-3 rounded-xl border border-white/10 bg-black/40" />
                    <div className="relative z-10 px-8 py-8 text-center">
                      <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-white/10" />
                      <div className="h-2 w-24 rounded bg-white/10" />
                    </div>

                    <img
                      src={imageUrl}
                      alt="Background preview"
                      className="absolute inset-0 z-20 h-full w-full object-contain"
                    />
                  </div>

                  <p className="mt-2 text-center text-[9px] font-black uppercase tracking-wider text-gray-600">
                    Profile background preview
                  </p>
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <input
                type="checkbox"
                checked={isLimited}
                onChange={(e) => setIsLimited(e.target.checked)}
              />

              <span>
                <span className="block text-xs font-black">
                  Limited quantity
                </span>

                <span className="block text-[10px] text-gray-600">
                  Restrict how many players can purchase it.
                </span>
              </span>
            </label>

            {isLimited && (
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Quantity
                </span>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                />

                {editing && (
                  <span className="mt-2 block text-[10px] text-gray-600">
                    Existing purchases are preserved when the quantity is
                    edited.
                  </span>
                )}
              </label>
            )}

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Starts At (optional)
              </span>

              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Expires At (optional)
              </span>

              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:col-span-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />

              <span>
                <span className="block text-xs font-black">Active</span>

                <span className="block text-[10px] text-gray-600">
                  Active backgrounds can be displayed in the Shop.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-4 text-xs leading-5 text-gray-500">
            <span className="font-black text-red-400">How Backgrounds work:</span>{' '}
            the background is saved as a Shop item. A player purchases it with Gold,
            it enters their Inventory, and equipping it uses the existing
            equipped-item system. The player profile uses the equipped background
            around the entire profile card.
          </div>

          <button
            type="button"
            onClick={() => void saveBackground()}
            disabled={saving || uploading}
            className="mt-5 w-full rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : editing
                ? 'Save Changes'
                : 'Create Background'}
          </button>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
                Background Library
              </p>

              <h2 className="text-xl font-black">All Backgrounds</h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-gray-500">
              {backgrounds.length} BACKGROUND{backgrounds.length === 1 ? '' : 'S'}
            </span>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-gray-600">
              Loading backgrounds...
            </div>
          ) : backgrounds.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
              <div className="text-4xl">🖼️</div>

              <p className="mt-3 text-sm font-black">No backgrounds yet</p>

              <p className="mt-1 text-xs text-gray-600">
                Create the first profile background above.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {backgrounds.map((background) => (
                <article
                  key={background.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
                >
                  <div className="relative flex h-52 items-center justify-center overflow-hidden bg-[#101010]">
                    <div className="absolute inset-5 rounded-2xl border border-white/10 bg-black/30" />

                    <div className="relative z-10 text-center">
                      <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-white/10" />
                      <div className="mx-auto h-2 w-28 rounded bg-white/10" />
                      <div className="mx-auto mt-2 h-2 w-20 rounded bg-white/5" />
                    </div>

                    {background.image_url && (
                      <img
                        src={background.image_url}
                        alt={background.name}
                        className="absolute inset-0 z-20 h-full w-full object-cover"
                      />
                    )}

                    <span
                      className={`absolute right-3 top-3 z-30 rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                        background.is_active
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {background.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black">{background.name}</h3>

                        <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-yellow-400">
                          {background.rarity}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-black">
                          {background.price_gold} Gold
                        </p>

                        {background.is_limited && (
                          <p className="text-[9px] text-gray-600">
                            {background.remaining_quantity ?? 0} left
                          </p>
                        )}
                      </div>
                    </div>

                    {background.description && (
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">
                        {background.description}
                      </p>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => editBackground(background)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[9px] font-black text-gray-300 hover:bg-white/10"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => void toggleBackground(background)}
                        className="rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-2 py-2 text-[9px] font-black text-yellow-400 hover:bg-yellow-500/10"
                      >
                        {background.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={() => openGiftModal(background)}
                        disabled={!background.is_active}
                        className="rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-2 py-2 text-[9px] font-black text-yellow-400 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        🎁 Gift
                      </button>

                      <button
                        type="button"
                        onClick={() => void deleteBackground(background)}
                        className="rounded-lg border border-red-500/15 bg-red-500/5 px-2 py-2 text-[9px] font-black text-red-400 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      {giftBackground && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-yellow-500/20 bg-[#101010] p-6 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400">
                  Admin Gift
                </p>
                <h2 className="mt-2 text-2xl font-black">Gift {giftBackground.name}</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  This gives the background directly to a player without charging Gold.
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
                The background will be added directly to the player's Inventory. No Gold will be deducted.
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
                  {giftSending ? 'Gifting...' : '🎁 Gift Background'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
