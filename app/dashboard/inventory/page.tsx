'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type InventoryRecord = {
  item_id: string
  quantity: number
  purchased_at: string
}

type ShopItem = {
  id: string
  name: string
  description: string
  item_type: string
  rarity: string
  price_gold: number
  image_url: string | null
}

type EquippedRecord = {
  item_id: string
  item_type: string
}

type InventoryItem = ShopItem & InventoryRecord

const rarityStyles: Record<string, string> = {
  common: 'border-gray-500/20 bg-gray-500/5 text-gray-400',
  rare: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
  epic: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
  legendary:
    'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
  mythic: 'border-red-500/30 bg-red-500/5 text-red-400',
}

const typeIcons: Record<string, string> = {
  frame: '🖼️',
  background: '🌌',
  name_effect: '✨',
  chat_effect: '💬',
  cosmetic: '🔥',
  badge: '🏅',
}

function formatType(value: string) {
  return value
    .split('_')
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(' ')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function InventoryPage() {
  const supabase = createClient()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [equippedItems, setEquippedItems] = useState<
    EquippedRecord[]
  >([])

  const [loading, setLoading] = useState(true)
  const [actionItemId, setActionItemId] = useState<string | null>(
    null
  )
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  function isEquipped(itemId: string) {
    return equippedItems.some(
      (equipped) => equipped.item_id === itemId
    )
  }

  async function loadInventory() {
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Please log in to view your inventory.')
        return
      }

      // Load owned items
      const {
        data: inventory,
        error: inventoryError,
      } = await supabase
        .from('user_inventory')
        .select('item_id, quantity, purchased_at')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false })

      if (inventoryError) throw inventoryError

      // Load currently equipped items
      const {
        data: equipped,
        error: equippedError,
      } = await supabase
        .from('user_equipped_items')
        .select('item_id, item_type')
        .eq('user_id', user.id)

      if (equippedError) throw equippedError

      setEquippedItems(equipped ?? [])

      if (!inventory || inventory.length === 0) {
        setItems([])
        return
      }

      const itemIds = inventory.map(
        (item) => item.item_id
      )

      // Load shop item information
      const {
        data: shopItems,
        error: shopError,
      } = await supabase
        .from('shop_items')
        .select(
          'id, name, description, item_type, rarity, price_gold, image_url'
        )
        .in('id', itemIds)

      if (shopError) throw shopError

      const itemMap = new Map(
        (shopItems ?? []).map(
          (item) => [item.id, item as ShopItem]
        )
      )

      const combined = inventory
        .map((record) => {
          const item = itemMap.get(record.item_id)

          if (!item) return null

          return {
            ...item,
            ...record,
          }
        })
        .filter(
          (item): item is InventoryItem =>
            item !== null
        )

      setItems(combined)
    } catch (loadError) {
      console.error('Inventory error:', loadError)

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load your inventory.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function equipItem(item: InventoryItem) {
    setActionItemId(item.id)
    setActionMessage('')
    setError('')

    try {
      // Badges are the only cosmetic type that can have multiple
      // equipped at once. STRIKEHUB allows a maximum of 3.
      if (item.item_type === 'badge') {
        const equippedBadgeCount = equippedItems.filter(
          (equipped) => equipped.item_type === 'badge'
        ).length

        if (equippedBadgeCount >= 3) {
          throw new Error(
            'You already have 3 badges equipped. Unequip one badge before equipping another.'
          )
        }
      }

      const { error: rpcError } = await supabase.rpc(
        'equip_shop_item',
        {
          p_item_id: item.id,
        }
      )

      if (rpcError) throw rpcError

      setActionMessage(
        item.item_type === 'badge'
          ? `${item.name} is now equipped. You can equip up to 3 badges.`
          : `${item.name} is now equipped.`
      )

      await loadInventory()
    } catch (equipError) {
      console.error('Equip error:', equipError)

      setError(
        equipError instanceof Error
          ? equipError.message
          : 'Could not equip this item.'
      )
    } finally {
      setActionItemId(null)
    }
  }

  async function unequipItem(item: InventoryItem) {
    setActionItemId(item.id)
    setActionMessage('')
    setError('')

    try {
      const { error: rpcError } = await supabase.rpc(
        'unequip_shop_item',
        {
          p_item_id: item.id,
        }
      )

      if (rpcError) throw rpcError

      setActionMessage(
        `${item.name} has been unequipped.`
      )

      await loadInventory()
    } catch (unequipError) {
      console.error('Unequip error:', unequipError)

      setError(
        unequipError instanceof Error
          ? unequipError.message
          : 'Could not unequip this item.'
      )
    } finally {
      setActionItemId(null)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [])

  return (
    <main className="min-h-screen bg-[#09080c] text-white">
      {/* Atmospheric background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-red-600/10 blur-[120px]" />

        <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-orange-600/5 blur-[140px]" />

        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-purple-600/5 blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,0,0,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,0.8) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-white"
        >
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <section className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-red-500">
              STRIKEHUB COLLECTION
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              My Inventory
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
              View, equip, and manage the frames, backgrounds,
              effects, and cosmetics you have collected from
              the STRIKEHUB Store.
            </p>
          </div>

          <Link
            href="/dashboard/shop"
            className="inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-xs font-black transition hover:bg-red-500 sm:w-auto"
          >
            Visit Shop →
          </Link>
        </section>

        {/* Collection stats */}
        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">
              Items Collected
            </p>

            <p className="mt-2 text-3xl font-black">
              {items.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">
              Total Quantity
            </p>

            <p className="mt-2 text-3xl font-black">
              {items.reduce(
                (total, item) => total + item.quantity,
                0
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/[0.03] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">
              Equipped
            </p>

            <p className="mt-2 text-lg font-black text-yellow-400">
              {equippedItems.length} item
              {equippedItems.length === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-[9px] font-bold text-gray-600">
              Badges: {equippedItems.filter((item) => item.item_type === 'badge').length}/3
            </p>
          </div>
        </section>

        {/* Feedback */}
        {actionMessage && (
          <div className="mb-6 rounded-2xl border border-green-500/20 bg-green-500/5 px-5 py-4 text-sm font-bold text-green-400">
            ✓ {actionMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4">
            <p className="text-sm font-bold text-red-400">
              {error}
            </p>

            <button
              type="button"
              onClick={loadInventory}
              className="mt-3 rounded-lg border border-red-500/20 px-4 py-2 text-xs font-black text-red-400 transition hover:bg-red-500/10"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-[440px] animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-4xl">
              🎒
            </div>

            <h2 className="mt-5 text-xl font-black">
              Your inventory is empty.
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              Purchase a frame, background, effect, or
              cosmetic from the STRIKEHUB Store and it will
              appear here.
            </p>

            <Link
              href="/dashboard/shop"
              className="mt-6 inline-flex rounded-xl bg-red-600 px-5 py-3 text-xs font-black transition hover:bg-red-500"
            >
              Browse Shop
            </Link>
          </div>
        ) : (
          /* Inventory */
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => {
              const equipped = isEquipped(item.id)
              const busy = actionItemId === item.id

              return (
                <article
                  key={item.id}
                  className={`group overflow-hidden rounded-2xl border bg-[#100d11]/90 transition duration-300 hover:-translate-y-1 ${
                    equipped
                      ? 'border-yellow-500/40 shadow-2xl shadow-yellow-950/10'
                      : 'border-white/10 hover:border-red-500/25 hover:shadow-2xl hover:shadow-red-950/20'
                  }`}
                >
                  {/* Image */}
                  <div className="relative h-52 overflow-hidden border-b border-white/5 bg-gradient-to-br from-[#241014] via-[#120c10] to-[#0b0a0e]">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] text-5xl shadow-2xl">
                          {typeIcons[item.item_type] ?? '🎁'}
                        </div>
                      </div>
                    )}

                    {/* Rarity */}
                    <div className="absolute left-3 top-3">
                      <span
                        className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                          rarityStyles[item.rarity] ??
                          rarityStyles.common
                        }`}
                      >
                        {item.rarity}
                      </span>
                    </div>

                    {/* Equipped badge */}
                    <div className="absolute right-3 top-3">
                      {equipped ? (
                        <span className="rounded-lg border border-yellow-500/30 bg-yellow-500/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-black">
                          ✓ Equipped
                        </span>
                      ) : (
                        <span className="rounded-lg border border-green-500/30 bg-green-600/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">
                          Owned
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-600">
                      {formatType(item.item_type)}
                    </p>

                    <h2 className="mt-1 truncate text-lg font-black">
                      {item.name}
                    </h2>

                    <p className="mt-3 min-h-10 text-xs leading-5 text-gray-600">
                      {item.description ||
                        'A special STRIKEHUB cosmetic.'}
                    </p>

                    {/* Purchase information */}
                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                      <div>
                        <p className="text-[8px] font-black uppercase tracking-wider text-gray-600">
                          Purchased
                        </p>

                        <p className="mt-1 text-xs font-bold text-gray-400">
                          {formatDate(item.purchased_at)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase tracking-wider text-gray-600">
                          Quantity
                        </p>

                        <p className="mt-1 text-sm font-black text-yellow-400">
                          ×{item.quantity}
                        </p>
                      </div>
                    </div>

                    {/* Equip controls */}
                    <div className="mt-4">
                      {equipped ? (
                        <button
                          type="button"
                          onClick={() => unequipItem(item)}
                          disabled={busy}
                          className="flex w-full items-center justify-center rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs font-black text-yellow-400 transition hover:bg-yellow-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? 'Unequipping...'
                            : '✓ Equipped — Unequip'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => equipItem(item)}
                          disabled={busy}
                          className="flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy
                            ? 'Equipping...'
                            : 'Equip Item'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* Footer note */}
        <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.015] p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-700">
            STRIKEHUB INVENTORY
          </p>

          <p className="mt-2 text-xs text-gray-600">
            Your purchased items stay in your collection
            permanently. Equipping an item does not consume it.
          </p>
        </div>
      </div>
    </main>
  )
}