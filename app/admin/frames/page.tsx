'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Frame = {
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

type GiftRecipient = {
  id: string
  display_name: string | null
  in_game_name: string | null
}

const RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]

export default function AdminFramesPage() {
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [frames, setFrames] = useState<Frame[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [editing, setEditing] = useState<Frame | null>(null)
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
  const [giftFrame, setGiftFrame] = useState<Frame | null>(null)
  const [giftUid, setGiftUid] = useState('')
  const [giftReason, setGiftReason] = useState('')
  const [giftRecipient, setGiftRecipient] =
    useState<GiftRecipient | null>(null)
  const [giftLookingUp, setGiftLookingUp] = useState(false)
  const [giftSending, setGiftSending] = useState(false)

  useEffect(() => {
    void loadFrames()
  }, [])

  async function loadFrames() {
    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from('shop_items')
      .select(
        'id,name,description,rarity,price_gold,image_url,is_limited,quantity,remaining_quantity,starts_at,expires_at,is_active,created_at'
      )
      .eq('item_type', 'frame')
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setFrames([])
    } else {
      setFrames((data || []) as Frame[])
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

  function editFrame(frame: Frame) {
    setEditing(frame)
    setName(frame.name)
    setDescription(frame.description || '')
    setRarity((frame.rarity || 'common').toLowerCase())
    setPriceGold(String(frame.price_gold ?? 10))
    setImageUrl(frame.image_url || '')
    setIsLimited(frame.is_limited)
    setQuantity(
      frame.quantity == null ? '' : String(frame.quantity)
    )

    setStartsAt(
      frame.starts_at
        ? new Date(frame.starts_at).toISOString().slice(0, 16)
        : ''
    )

    setExpiresAt(
      frame.expires_at
        ? new Date(frame.expires_at).toISOString().slice(0, 16)
        : ''
    )

    setIsActive(frame.is_active)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  async function uploadImage(file: File) {
    setError('')
    setMessage('')

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setError(
        'Please choose a PNG, JPG/JPEG, or WEBP image.'
      )
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setError(
        'Frame artwork must be 8 MB or smaller.'
      )
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

      const path = `frames/${crypto.randomUUID()}.${extension}`

      const { error: uploadError } =
        await supabase.storage
          .from('shop')
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
          })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const { data } = supabase.storage
        .from('shop')
        .getPublicUrl(path)

      setImageUrl(data.publicUrl)

      setMessage(
        'Frame artwork uploaded successfully.'
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

  async function saveFrame() {
    setError('')
    setMessage('')

    if (!name.trim()) {
      setError('Enter a frame name.')
      return
    }

    const price = Number(priceGold)

    if (!Number.isInteger(price) || price < 0) {
      setError(
        'Price must be a whole number of Gold.'
      )
      return
    }

    const qty = isLimited ? Number(quantity) : null

    if (
  isLimited &&
  (qty === null || !Number.isInteger(qty) || qty <= 0)
) {
      setError(
        'Limited frames need a quantity greater than 0.'
      )
      return
    }

    if (
      startsAt &&
      expiresAt &&
      new Date(expiresAt).getTime() <=
        new Date(startsAt).getTime()
    ) {
      setError(
        'Expires At must be later than Starts At.'
      )
      return
    }

    setSaving(true)

    try {
      let remainingQuantity = qty

      if (
        editing &&
        isLimited &&
        qty !== null
      ) {
        const oldQuantity = editing.quantity ?? 0
        const oldRemaining =
          editing.remaining_quantity ?? 0

        const sold = Math.max(
          oldQuantity - oldRemaining,
          0
        )

        remainingQuantity = Math.max(
          qty - sold,
          0
        )
      }

      const payload = {
        name: name.trim(),

        // Never send NULL because shop_items.description
        // is required in the current database.
        description:
          description.trim() ||
          `${name.trim()} profile frame.`,

        item_type: 'frame',
        rarity: rarity.toLowerCase(),
        price_gold: price,
        image_url: imageUrl.trim() || null,
        is_limited: isLimited,
        quantity: qty,
        remaining_quantity: remainingQuantity,

        starts_at: startsAt
          ? new Date(startsAt).toISOString()
          : null,

        expires_at: expiresAt
          ? new Date(expiresAt).toISOString()
          : null,

        is_active: isActive,
      }

      if (editing) {
        const { error: updateError } =
          await supabase
            .from('shop_items')
            .update(payload)
            .eq('id', editing.id)
            .eq('item_type', 'frame')

        if (updateError) {
          throw new Error(updateError.message)
        }

        setMessage(
          'Frame updated successfully.'
        )
      } else {
        const { data: userData } =
          await supabase.auth.getUser()

        const { error: insertError } =
          await supabase
            .from('shop_items')
            .insert({
              ...payload,
              created_by:
                userData.user?.id ?? null,
            })

        if (insertError) {
          throw new Error(insertError.message)
        }

        setMessage(
          'Frame created successfully.'
        )
      }

      resetForm()
      await loadFrames()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save frame.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleFrame(frame: Frame) {
    setError('')
    setMessage('')

    const { error: updateError } =
      await supabase
        .from('shop_items')
        .update({
          is_active: !frame.is_active,
        })
        .eq('id', frame.id)
        .eq('item_type', 'frame')

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(
      frame.is_active
        ? 'Frame deactivated.'
        : 'Frame activated.'
    )

    await loadFrames()
  }

  async function deleteFrame(frame: Frame) {
    setError('')
    setMessage('')

    const [
      { count: salesCount, error: salesError },
      {
        count: inventoryCount,
        error: inventoryError,
      },
    ] = await Promise.all([
      supabase
        .from('item_sales')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('item_id', frame.id),

      supabase
        .from('user_inventory')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq('item_id', frame.id),
    ])

    if (salesError) {
      setError(
        `Could not check frame sales: ${salesError.message}`
      )
      return
    }

    if (inventoryError) {
      setError(
        `Could not check frame inventory: ${inventoryError.message}`
      )
      return
    }

    if (
      (salesCount ?? 0) > 0 ||
      (inventoryCount ?? 0) > 0
    ) {
      setError(
        `"${frame.name}" cannot be deleted because players already own or purchased it. Use Deactivate instead.`
      )
      return
    }

    const confirmed = window.confirm(
      `Delete "${frame.name}" permanently?`
    )

    if (!confirmed) return

    const { error: deleteError } =
      await supabase
        .from('shop_items')
        .delete()
        .eq('id', frame.id)
        .eq('item_type', 'frame')

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setMessage('Frame deleted.')

    if (editing?.id === frame.id) {
      resetForm()
    }

    await loadFrames()
  }

  function openGiftModal(frame: Frame) {
    setGiftFrame(frame)
    setGiftUid('')
    setGiftReason('')
    setGiftRecipient(null)
    setError('')
    setMessage('')
  }

  function closeGiftModal() {
    if (giftSending) return

    setGiftFrame(null)
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
      setError(
        'BloodStrike UID must be exactly 12 digits.'
      )
      return
    }

    setGiftLookingUp(true)

    try {
      const { data, error: lookupError } =
        await supabase
          .from('profiles')
          .select(
            'id, display_name, in_game_name'
          )
          .eq('bloodstrike_uid', uid)
          .maybeSingle()

      if (lookupError) {
        throw new Error(
          lookupError.message
        )
      }

      if (!data) {
        throw new Error(
          'No STRIKEHUB account was found with that BloodStrike UID.'
        )
      }

      setGiftRecipient(
        data as GiftRecipient
      )
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
    if (!giftFrame || !giftRecipient) {
      return
    }

    setError('')
    setMessage('')
    setGiftSending(true)

    try {
      const {
        data,
        error: giftError,
      } = await supabase.rpc(
        'admin_gift_frame',
        {
          p_recipient_user_id:
            giftRecipient.id,

          p_shop_item_id:
            giftFrame.id,

          p_reason:
            giftReason.trim() || null,
        }
      )

      if (giftError) {
        throw new Error(
          giftError.message
        )
      }

      const result = data as {
        success?: boolean
        frame_name?: string
      } | null

      if (result?.success === false) {
        throw new Error(
          'Could not gift frame.'
        )
      }

      setMessage(
        `"${giftFrame.name}" was gifted successfully. The player will receive a notification.`
      )

      closeGiftModal()
    } catch (giftError) {
      setError(
        giftError instanceof Error
          ? giftError.message
          : 'Could not gift frame.'
      )
    } finally {
      setGiftSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

          <div>

            <button
              type="button"
              onClick={() => {
                window.location.href = '/admin'
              }}
              className="mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-red-500 hover:text-red-400"
            >
              ← Admin Panel
            </button>

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">
              Admin Management
            </p>

            <h1 className="mt-2 text-3xl font-black">
              Profile Frames
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Create and manage frames that surround
              the player&apos;s entire profile card.
            </p>

          </div>

          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-gray-300 hover:bg-white/10"
            >
              + New Frame
            </button>
          )}

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

        {/* CREATE / EDIT */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6">

          <div className="mb-5">

            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
              {editing ? 'Edit Frame' : 'Create Frame'}
            </p>

            <h2 className="mt-1 text-xl font-black">
              {editing
                ? editing.name
                : 'New Profile Frame'}
            </h2>

          </div>

          <div className="grid gap-4 md:grid-cols-2">

            {/* NAME */}
            <label className="block">

              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Name
              </span>

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Inferno Frame"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500/50"
              />

            </label>

            {/* RARITY */}
            <label className="block">

              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Rarity
              </span>

              <select
                value={rarity}
                onChange={(e) =>
                  setRarity(e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
              >
                {RARITIES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item.toUpperCase()}
                  </option>
                ))}
              </select>

            </label>

            {/* DESCRIPTION */}
            <label className="block md:col-span-2">

              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Description
              </span>

              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                rows={3}
                placeholder="Describe what makes this frame special..."
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500/50"
              />

            </label>

            {/* PRICE */}
            <label className="block">

              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Price (Gold)
              </span>

              <input
                type="number"
                min="0"
                value={priceGold}
                onChange={(e) =>
                  setPriceGold(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-red-500/50"
              />

            </label>

            {/* ARTWORK */}
            <div>

              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Artwork
              </span>

              <input
                ref={fileInputRef}
                id="frame-artwork-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file =
                    e.target.files?.[0]

                  if (file) {
                    void uploadImage(file)
                  }
                }}
              />

              <label
                htmlFor="frame-artwork-upload"
                className="mt-2 flex cursor-pointer items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-center text-xs font-black text-red-400 hover:bg-red-500/10"
              >
                {uploading
                  ? 'Uploading artwork...'
                  : '🖼️ Choose Frame Artwork'}
              </label>

              <p className="mt-2 text-[10px] leading-4 text-gray-600">
                PNG, JPG/JPEG or WEBP.
                Transparent PNG is recommended
                so the frame does not cover the
                profile contents.
              </p>

              {imageUrl && (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">

                  <img
                    src={imageUrl}
                    alt="Frame preview"
                    className="h-32 w-full object-contain"
                  />

                </div>
              )}

            </div>

            {/* LIMITED */}
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">

              <input
                type="checkbox"
                checked={isLimited}
                onChange={(e) =>
                  setIsLimited(
                    e.target.checked
                  )
                }
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

            {/* QUANTITY */}
            {isLimited && (
              <label className="block">

                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Quantity
                </span>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                />

              </label>
            )}

            {/* START */}
            <label className="block">

              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Starts At
              </span>

              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) =>
                  setStartsAt(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
              />

            </label>

            {/* EXPIRES */}
            <label className="block">

              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Expires At
              </span>

              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) =>
                  setExpiresAt(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
              />

            </label>

            {/* ACTIVE */}
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:col-span-2">

              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) =>
                  setIsActive(
                    e.target.checked
                  )
                }
              />

              <span>

                <span className="block text-xs font-black">
                  Active
                </span>

                <span className="block text-[10px] text-gray-600">
                  Active controls whether players
                  can see the frame in Shop.
                </span>

              </span>

            </label>

          </div>

          <div className="mt-5 rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-4 text-xs leading-5 text-gray-500">

            <span className="font-black text-red-400">
              How Frames work:
            </span>{' '}

            Frames are Shop items. Players can
            purchase them with Gold, receive them
            through gifts, place them in Inventory,
            and equip them around their profile.

            <br />

            <span className="font-black text-blue-300">
              Admin gifting:
            </span>{' '}

            Admins can gift a frame even when it is
            inactive. Inactive only means it is not
            available for normal Shop purchases.

          </div>

          <button
            type="button"
            onClick={() =>
              void saveFrame()
            }
            disabled={
              saving || uploading
            }
            className="mt-5 w-full rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? 'Saving...'
              : editing
                ? 'Save Changes'
                : 'Create Frame'}
          </button>

        </section>

        {/* FRAME LIBRARY */}
        <section>

          <div className="mb-4 flex items-center justify-between">

            <div>

              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">
                Frame Library
              </p>

              <h2 className="text-xl font-black">
                All Frames
              </h2>

            </div>

            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-gray-500">
              {frames.length} FRAME
              {frames.length === 1
                ? ''
                : 'S'}
            </span>

          </div>

          {loading ? (

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-gray-600">
              Loading frames...
            </div>

          ) : frames.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">

              <div className="text-4xl">
                🖼️
              </div>

              <p className="mt-3 text-sm font-black">
                No frames yet
              </p>

              <p className="mt-1 text-xs text-gray-600">
                Create the first profile frame above.
              </p>

            </div>

          ) : (

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

              {frames.map((frame) => (

                <article
                  key={frame.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
                >

                  {/* PREVIEW */}
                  <div className="relative flex h-52 items-center justify-center overflow-hidden bg-[#101010]">

                    <div className="absolute inset-5 rounded-2xl border border-white/10 bg-black/30" />

                    <div className="relative z-10 text-center">

                      <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-white/10" />

                      <div className="mx-auto h-2 w-28 rounded bg-white/10" />

                      <div className="mx-auto mt-2 h-2 w-20 rounded bg-white/5" />

                    </div>

                    {frame.image_url && (
                      <img
                        src={frame.image_url}
                        alt={frame.name}
                        className="absolute inset-0 z-20 h-full w-full object-contain p-2"
                      />
                    )}

                    <span
                      className={`absolute right-3 top-3 z-30 rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                        frame.is_active
                          ? 'bg-green-500/15 text-green-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {frame.is_active
                        ? 'Active'
                        : 'Inactive'}
                    </span>

                  </div>

                  {/* DETAILS */}
                  <div className="p-4">

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <h3 className="font-black">
                          {frame.name}
                        </h3>

                        <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-yellow-400">
                          {frame.rarity}
                        </p>

                      </div>

                      <div className="text-right">

                        <p className="text-sm font-black">
                          {frame.price_gold} Gold
                        </p>

                        {frame.is_limited && (
                          <p className="text-[9px] text-gray-600">
                            {frame.remaining_quantity ?? 0}{' '}
                            left
                          </p>
                        )}

                      </div>

                    </div>

                    {frame.description && (
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">
                        {frame.description}
                      </p>
                    )}

                    {/* ACTIONS */}
                    <div className="mt-4 grid grid-cols-2 gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          editFrame(frame)
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[9px] font-black text-gray-300 hover:bg-white/10"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void toggleFrame(
                            frame
                          )
                        }
                        className="rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-2 py-2 text-[9px] font-black text-yellow-400 hover:bg-yellow-500/10"
                      >
                        {frame.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>

                      {/* IMPORTANT:
                          Gift is NOT disabled when inactive.
                          Activation only affects Shop listing.
                      */}
                      <button
                        type="button"
                        onClick={() =>
                          openGiftModal(
                            frame
                          )
                        }
                        className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-2 py-2 text-[9px] font-black text-blue-300 hover:bg-blue-500/10"
                      >
                        🎁 Gift
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void deleteFrame(
                            frame
                          )
                        }
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

      {/* GIFT MODAL */}
      {giftFrame && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">

          <div className="w-full max-w-lg rounded-3xl border border-blue-500/20 bg-[#101010] p-6 shadow-2xl shadow-black/60">

            <div className="flex items-start justify-between gap-4">

              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">
                  Admin Gift
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Gift {giftFrame.name}
                </h2>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  This gives the frame directly to
                  a player without charging Gold.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeGiftModal
                }
                disabled={
                  giftSending
                }
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-gray-400 hover:bg-white/10"
              >
                ✕
              </button>

            </div>

            <div className="mt-6 space-y-4">

              {/* UID */}
              <label className="block">

                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Player BloodStrike UID
                </span>

                <div className="mt-2 flex gap-2">

                  <input
                    value={giftUid}
                    onChange={(e) => {

                      setGiftUid(
                        e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 12)
                      )

                      setGiftRecipient(
                        null
                      )

                    }}
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="12-digit UID"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none placeholder:text-gray-700 focus:border-blue-500/50"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      void lookupGiftRecipient()
                    }
                    disabled={
                      giftLookingUp ||
                      giftUid.length !== 12
                    }
                    className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs font-black text-blue-300 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {giftLookingUp
                      ? 'Finding...'
                      : 'Find'}
                  </button>

                </div>

              </label>

              {/* PLAYER FOUND */}
              {giftRecipient && (

                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4">

                  <p className="text-[10px] font-black uppercase tracking-wider text-green-400">
                    Player Found
                  </p>

                  <p className="mt-2 text-sm font-black text-white">
                    {giftRecipient.in_game_name ||
                      giftRecipient.display_name ||
                      'STRIKEHUB Player'}
                  </p>

                  {giftRecipient.display_name && (
                    <p className="mt-1 text-xs text-gray-500">
                      {giftRecipient.display_name}
                    </p>
                  )}

                </div>

              )}

              {/* REASON */}
              <label className="block">

                <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                  Reason (Optional)
                </span>

                <textarea
                  value={giftReason}
                  onChange={(e) =>
                    setGiftReason(
                      e.target.value
                    )
                  }
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. Tournament winner, special award..."
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-gray-300 outline-none placeholder:text-gray-700 focus:border-blue-500/50"
                />

              </label>

              {/* INFO */}
              <div className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.03] p-4 text-xs leading-5 text-gray-500">

                The frame will be added directly
                to the player&apos;s Inventory.

                <br />

                No Gold will be deducted.

                <br />

                A notification will be created
                automatically for the player.

              </div>

              {/* BUTTONS */}
              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={
                    closeGiftModal
                  }
                  disabled={
                    giftSending
                  }
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-gray-300 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void sendGift()
                  }
                  disabled={
                    giftSending ||
                    !giftRecipient
                  }
                  className="flex-1 rounded-xl bg-blue-500 px-4 py-3 text-sm font-black text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {giftSending
                    ? 'Gifting...'
                    : '🎁 Gift Frame'}
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </main>
  )
}