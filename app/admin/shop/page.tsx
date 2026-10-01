'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type ShopItem = {
  id: string
  name: string
  description: string
  item_type: string
  rarity: string
  price_gold: number
  image_url: string | null
  is_limited: boolean
  quantity: number | null
  remaining_quantity: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
}

type FormState = {
  name: string
  description: string
  item_type: string
  rarity: string
  price_gold: string
  image_url: string
  is_limited: boolean
  quantity: string
  starts_at: string
  expires_at: string
  is_active: boolean
}

const emptyForm: FormState = {
  name: '',
  description: '',
  item_type: 'frame',
  rarity: 'common',
  price_gold: '',
  image_url: '',
  is_limited: false,
  quantity: '',
  starts_at: '',
  expires_at: '',
  is_active: true,
}

const itemTypes = [
  { value: 'frame', label: 'Frame' },
  { value: 'background', label: 'Background' },
  { value: 'name_effect', label: 'Name Effect' },
  { value: 'chat_effect', label: 'Chat Effect' },
  { value: 'cosmetic', label: 'Cosmetic' },
]

const rarities = [
  { value: 'common', label: 'Common' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'mythic', label: 'Mythic' },
]

function formatDate(value: string | null) {
  if (!value) return 'No date'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'No date'

  return date.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function rarityClass(rarity: string) {
  switch (rarity) {
    case 'common':
      return 'border-white/10 bg-white/[0.03] text-gray-400'
    case 'rare':
      return 'border-blue-500/20 bg-blue-500/5 text-blue-400'
    case 'epic':
      return 'border-purple-500/20 bg-purple-500/5 text-purple-400'
    case 'legendary':
      return 'border-orange-500/20 bg-orange-500/5 text-orange-400'
    case 'mythic':
      return 'border-red-500/20 bg-red-500/5 text-red-400'
    default:
      return 'border-white/10 bg-white/[0.03] text-gray-400'
  }
}

function typeLabel(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function AdminShopPage() {
  const supabase = createClient()

  const [items, setItems] = useState<ShopItem[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function checkAdmin() {
    const { data, error } = await supabase.rpc('is_admin')

    if (error || !data) {
      window.location.href = '/dashboard'
      return false
    }

    return true
  }

  async function loadItems() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('shop_items')
      .select(
        'id,name,description,item_type,rarity,price_gold,image_url,is_limited,quantity,remaining_quantity,starts_at,expires_at,is_active'
      )
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setItems((data || []) as ShopItem[])
    }

    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const allowed = await checkAdmin()

      if (allowed) {
        await loadItems()
      }
    }

    init()
  }, [])

  function updateForm<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function clearMessages() {
    setMessage('')
    setError('')
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setSelectedFile(null)
    setPreviewUrl(null)
  }

  function startEdit(item: ShopItem) {
    clearMessages()

    setEditingId(item.id)

    setForm({
      name: item.name,
      description: item.description,
      item_type: item.item_type,
      rarity: item.rarity,
      price_gold: String(item.price_gold),
      image_url: item.image_url || '',
      is_limited: item.is_limited,
      quantity: item.quantity ? String(item.quantity) : '',
      starts_at: toDateTimeLocal(item.starts_at),
      expires_at: toDateTimeLocal(item.expires_at),
      is_active: item.is_active,
    })

    setSelectedFile(null)
    setPreviewUrl(item.image_url || null)

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  function handleFileChange(file: File | null) {
    clearMessages()

    setSelectedFile(file)

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }

    if (!file) {
      setPreviewUrl(form.image_url || null)
      return
    }

    if (!file.type.startsWith('image/')) {
      setSelectedFile(null)
      setPreviewUrl(form.image_url || null)
      setError('Please select an image file.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setSelectedFile(null)
      setPreviewUrl(form.image_url || null)
      setError('Image must be 5MB or smaller.')
      return
    }

    const localUrl = URL.createObjectURL(file)
    setPreviewUrl(localUrl)
  }

  async function uploadImage() {
    if (!selectedFile) return null

    setUploading(true)
    setError('')

    try {
      const extension =
        selectedFile.name.split('.').pop()?.toLowerCase() || 'png'

      const safeName =
        selectedFile.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9-_]/g, '-')
          .slice(0, 60) || 'shop-item'

      const filePath = `items/${Date.now()}-${safeName}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('shop')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: selectedFile.type,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('shop').getPublicUrl(filePath)

      return publicUrl
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : 'Image upload failed.'
      )
    } finally {
      setUploading(false)
    }
  }

  async function deleteStorageImage(imageUrl: string | null) {
    if (!imageUrl) return

    try {
      const marker = '/storage/v1/object/public/shop/'

      const index = imageUrl.indexOf(marker)

      if (index === -1) return

      const path = decodeURIComponent(
        imageUrl.substring(index + marker.length)
      )

      if (!path) return

      await supabase.storage.from('shop').remove([path])
    } catch {
      // The database update should not fail just because old image cleanup failed.
    }
  }

  async function saveItem() {
    clearMessages()

    if (!form.name.trim()) {
      setError('Item name is required.')
      return
    }

    if (!form.description.trim()) {
      setError('Description is required.')
      return
    }

    const price = Number(form.price_gold)

    if (!Number.isInteger(price) || price < 0) {
      setError('Gold price must be a whole number of 0 or more.')
      return
    }

    if (form.is_limited) {
      const quantity = Number(form.quantity)

      if (!Number.isInteger(quantity) || quantity <= 0) {
        setError('Enter a valid quantity for a limited item.')
        return
      }
    }

    if (
      form.starts_at &&
      form.expires_at &&
      new Date(form.expires_at) <= new Date(form.starts_at)
    ) {
      setError('Expiry date must be later than the start date.')
      return
    }

    setSaving(true)

    try {
      let imageUrl = form.image_url.trim() || null

      if (selectedFile) {
        const uploadedUrl = await uploadImage()

        if (!uploadedUrl) {
          throw new Error('The image could not be uploaded.')
        }

        imageUrl = uploadedUrl
      }

      const quantity = form.is_limited
        ? Number(form.quantity)
        : null

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        item_type: form.item_type,
        rarity: form.rarity,
        price_gold: price,
        image_url: imageUrl,
        is_limited: form.is_limited,
        quantity,
        starts_at: form.starts_at
          ? new Date(form.starts_at).toISOString()
          : null,
        expires_at: form.expires_at
          ? new Date(form.expires_at).toISOString()
          : null,
        is_active: form.is_active,
      }

      if (editingId) {
        const oldItem = items.find((item) => item.id === editingId)

        const updatePayload: Record<string, unknown> = {
          ...payload,
          updated_at: new Date().toISOString(),
        }

        if (
          form.is_limited &&
          oldItem?.is_limited &&
          oldItem.quantity !== quantity
        ) {
          const sold =
            Math.max(
              0,
              (oldItem.quantity || 0) -
                (oldItem.remaining_quantity || 0)
            )

          updatePayload.remaining_quantity = Math.max(
            0,
            (quantity ?? 0) - sold
          )
        } else if (form.is_limited && !oldItem?.is_limited) {
          updatePayload.remaining_quantity = quantity
        } else if (!form.is_limited) {
          updatePayload.remaining_quantity = null
        }

        const { error: updateError } = await supabase
          .from('shop_items')
          .update(updatePayload)
          .eq('id', editingId)

        if (updateError) {
          throw new Error(updateError.message)
        }

        if (
          selectedFile &&
          oldItem?.image_url &&
          oldItem.image_url !== imageUrl
        ) {
          await deleteStorageImage(oldItem.image_url)
        }

        setMessage('Shop item updated successfully.')
      } else {
        const { error: insertError } = await supabase
          .from('shop_items')
          .insert({
            ...payload,
            remaining_quantity: quantity,
          })

        if (insertError) {
          throw new Error(insertError.message)
        }

        setMessage('Shop item created successfully.')
      }

      resetForm()
      await loadItems()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleItem(item: ShopItem) {
    clearMessages()

    const { error } = await supabase
      .from('shop_items')
      .update({
        is_active: !item.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) {
      setError(error.message)
      return
    }

    setMessage(
      item.is_active
        ? `${item.name} is now hidden.`
        : `${item.name} is now published.`
    )

    await loadItems()
  }

  async function deleteItem(item: ShopItem) {
    const confirmed = window.confirm(
      `Delete "${item.name}" permanently?\n\nThis cannot be undone.`
    )

    if (!confirmed) return

    clearMessages()
    setDeletingId(item.id)

    try {
      const { error } = await supabase
        .from('shop_items')
        .delete()
        .eq('id', item.id)

      if (error) {
        throw new Error(error.message)
      }

      if (item.image_url) {
        await deleteStorageImage(item.image_url)
      }

      if (editingId === item.id) {
        resetForm()
      }

      setMessage(`${item.name} was deleted.`)
      await loadItems()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete item.'
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#09080c] text-white">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-red-600/[0.07] blur-[140px]" />
        <div className="absolute right-[-10%] top-[20%] h-[500px] w-[500px] rounded-full bg-orange-500/[0.04] blur-[150px]" />
        <div className="absolute bottom-[-15%] left-[35%] h-[500px] w-[500px] rounded-full bg-purple-600/[0.03] blur-[150px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-sm text-gray-500 transition hover:text-white"
            >
              ← Back to Admin
            </Link>

            <p className="mt-8 text-[11px] font-black uppercase tracking-[0.3em] text-red-500">
              Admin Control
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Shop Manager
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
              Create and manage the cosmetics available in the STRIKEHUB
              player shop.
            </p>
          </div>

          <Link
            href="/dashboard/shop"
            className="hidden rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-bold text-gray-300 transition hover:border-red-500/30 hover:bg-red-500/5 hover:text-white sm:block"
          >
            View Player Shop →
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm font-semibold text-green-400">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-400">
            ⚠ {error}
          </div>
        )}

        <section
          className={`rounded-3xl border p-6 shadow-2xl sm:p-8 ${
            editingId
              ? 'border-yellow-500/30 bg-[#151109]'
              : 'border-white/10 bg-[#100d11]/90'
          }`}
        >
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <p
                className={`text-[11px] font-black uppercase tracking-[0.3em] ${
                  editingId ? 'text-yellow-400' : 'text-red-500'
                }`}
              >
                {editingId ? 'Edit Product' : 'New Product'}
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {editingId ? 'Edit Shop Item' : 'Create Shop Item'}
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                {editingId
                  ? 'Update this item without creating a duplicate.'
                  : 'New items will appear in the player shop when active.'}
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-bold text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                Cancel Editing
              </button>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                Item Name
              </label>

              <input
                value={form.name}
                onChange={(e) =>
                  updateForm('name', e.target.value)
                }
                placeholder="e.g. Inferno Frame"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                Gold Price
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={form.price_gold}
                onChange={(e) =>
                  updateForm('price_gold', e.target.value)
                }
                placeholder="500"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                Description
              </label>

              <textarea
                rows={4}
                value={form.description}
                onChange={(e) =>
                  updateForm('description', e.target.value)
                }
                placeholder="Describe the item..."
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                Item Type
              </label>

              <select
                value={form.item_type}
                onChange={(e) =>
                  updateForm('item_type', e.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-[#171218] px-4 py-3 text-sm outline-none focus:border-red-500/40"
              >
                {itemTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                Rarity
              </label>

              <select
                value={form.rarity}
                onChange={(e) =>
                  updateForm('rarity', e.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-[#171218] px-4 py-3 text-sm outline-none focus:border-red-500/40"
              >
                {rarities.map((rarity) => (
                  <option key={rarity.value} value={rarity.value}>
                    {rarity.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="mb-4">
              <p className="text-sm font-bold">Shop Item Image</p>
              <p className="mt-1 text-xs text-gray-600">
                Upload an image directly. You can also use an existing image
                URL.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
              <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Shop item preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-4xl">🖼️</div>
                    <p className="mt-2 text-xs text-gray-600">
                      No image
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Upload Image
                </label>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) =>
                    handleFileChange(e.target.files?.[0] || null)
                  }
                  className="block w-full cursor-pointer rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-gray-400 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-red-500"
                />

                <p className="mt-2 text-[11px] text-gray-600">
                  PNG, JPG, WEBP or GIF • Maximum 5MB
                </p>

                <div className="my-5 h-px bg-white/5" />

                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Image URL
                </label>

                <input
                  value={form.image_url}
                  onChange={(e) => {
                    updateForm('image_url', e.target.value)

                    if (!selectedFile) {
                      setPreviewUrl(e.target.value || null)
                    }
                  }}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
                />

                <p className="mt-2 text-[11px] text-gray-600">
                  You can leave this empty if you upload an image above.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
            <label className="flex cursor-pointer items-center gap-4">
              <input
                type="checkbox"
                checked={form.is_limited}
                onChange={(e) =>
                  updateForm('is_limited', e.target.checked)
                }
                className="h-5 w-5 accent-red-600"
              />

              <div>
                <p className="text-sm font-bold">Limited Quantity</p>
                <p className="mt-1 text-xs text-gray-600">
                  Limit how many copies players can purchase.
                </p>
              </div>
            </label>

            {form.is_limited && (
              <div className="mt-5">
                <label className="mb-2 block text-xs font-semibold text-gray-400">
                  Available Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantity}
                  onChange={(e) =>
                    updateForm('quantity', e.target.value)
                  }
                  placeholder="100"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-red-500/40"
                />
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                Start Date / Time
              </label>

              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) =>
                  updateForm('starts_at', e.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-[#171218] px-4 py-3 text-sm outline-none focus:border-red-500/40"
              />

              <p className="mt-2 text-[11px] text-gray-600">
                Optional. Leave empty for immediate availability.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-400">
                Expiry Date / Time
              </label>

              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) =>
                  updateForm('expires_at', e.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-[#171218] px-4 py-3 text-sm outline-none focus:border-red-500/40"
              />

              <p className="mt-2 text-[11px] text-gray-600">
                Optional. Leave empty for no expiry.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
            <label className="flex cursor-pointer items-center gap-4">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  updateForm('is_active', e.target.checked)
                }
                className="h-5 w-5 accent-red-600"
              />

              <div>
                <p className="text-sm font-bold">Publish Item</p>
                <p className="mt-1 text-xs text-gray-600">
                  Active items are visible in the player shop.
                </p>
              </div>
            </label>
          </div>

          <button
            type="button"
            disabled={saving || uploading}
            onClick={saveItem}
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-red-600 py-4 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? 'Uploading Image...'
              : saving
                ? editingId
                  ? 'Updating Shop Item...'
                  : 'Creating Shop Item...'
                : editingId
                  ? '✓ Update Shop Item'
                  : '+ Create Shop Item'}
          </button>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-600">
                Inventory
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Shop Items
              </h2>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-gray-500">
              {items.length} total
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
              <div className="text-3xl animate-pulse">🛒</div>
              <p className="mt-3 text-sm text-gray-500">
                Loading shop items...
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
              <div className="text-4xl">🛍️</div>
              <h3 className="mt-4 text-xl font-black">
                No shop items yet
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Create your first STRIKEHUB cosmetic above.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-[#100d11] transition hover:border-white/20"
                >
                  <div className="relative flex h-64 items-center justify-center overflow-hidden bg-gradient-to-br from-red-950/20 via-black/20 to-orange-950/10">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-contain p-8"
                      />
                    ) : (
                      <div className="text-5xl">🛍️</div>
                    )}

                    <div className="absolute left-4 top-4 rounded-lg border border-white/10 bg-black/70 px-3 py-1 text-[9px] font-black uppercase tracking-wider">
                      {typeLabel(item.item_type)}
                    </div>

                    <div
                      className={`absolute right-4 top-4 rounded-lg border px-3 py-1 text-[9px] font-black uppercase tracking-wider ${rarityClass(
                        item.rarity
                      )}`}
                    >
                      {item.rarity}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black">
                          {item.name}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-gray-600">
                          {item.description}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-yellow-400">
                          {item.price_gold}
                        </p>
                        <p className="text-[8px] font-black uppercase tracking-wider text-yellow-600">
                          Gold
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-lg border px-2 py-1 text-[9px] font-bold ${
                          item.is_active
                            ? 'border-green-500/20 bg-green-500/5 text-green-400'
                            : 'border-gray-500/20 bg-gray-500/5 text-gray-500'
                        }`}
                      >
                        {item.is_active ? 'Active' : 'Hidden'}
                      </span>

                      {item.is_limited && (
                        <span className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-2 py-1 text-[9px] font-bold text-orange-400">
                          {item.remaining_quantity ?? 0}/
                          {item.quantity ?? 0} Left
                        </span>
                      )}
                    </div>

                    <div className="mt-3 text-[10px] text-gray-700">
                      {item.starts_at &&
                        `Starts: ${formatDate(item.starts_at)}`}
                      {item.starts_at && item.expires_at && ' • '}
                      {item.expires_at &&
                        `Expires: ${formatDate(item.expires_at)}`}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] py-3 text-xs font-bold text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        ✏️ Edit Item
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleItem(item)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] py-3 text-xs font-bold text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
                      >
                        {item.is_active ? 'Hide Item' : 'Publish'}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => deleteItem(item)}
                      className="mt-2 w-full rounded-xl border border-red-500/10 bg-red-500/5 py-3 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingId === item.id
                        ? 'Deleting...'
                        : '🗑️ Delete Item'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}