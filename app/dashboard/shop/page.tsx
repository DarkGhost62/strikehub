'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
}

type Wallet = {
  gold_balance: number
}

const categories = [
  { id: 'all', label: 'All Items', icon: '🛍️' },
  { id: 'frame', label: 'Frames', icon: '🖼️' },
  { id: 'background', label: 'Backgrounds', icon: '🌌' },
  { id: 'name_effect', label: 'Name Effects', icon: '✨' },
  { id: 'chat_effect', label: 'Chat Effects', icon: '💬' },
  { id: 'cosmetic', label: 'Cosmetics', icon: '🔥' },
]

const rarityStyles: Record<string, string> = {
  common: 'border-gray-500/20 bg-gray-500/5 text-gray-400',
  rare: 'border-blue-500/30 bg-blue-500/5 text-blue-400',
  epic: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
  legendary: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
  mythic: 'border-red-500/30 bg-red-500/5 text-red-400',
}

const typeIcons: Record<string, string> = {
  frame: '🖼️',
  background: '🌌',
  name_effect: '✨',
  chat_effect: '💬',
  cosmetic: '🔥',
}

export default function ShopPage() {
  const supabase = createClient()

  const [items, setItems] = useState<ShopItem[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ownedItems, setOwnedItems] = useState<string[]>([])
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null)

  async function loadShop() {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Please log in to access the shop.')
      setLoading(false)
      return
    }

    const [itemsResult, walletResult, inventoryResult] = await Promise.all([
      supabase
        .from('shop_items')
        .select(
          'id, name, description, item_type, rarity, price_gold, image_url, is_limited, quantity, remaining_quantity, starts_at, expires_at'
        )
        .eq('is_active', true)
        .order('created_at', { ascending: false }),

      supabase
        .from('wallets')
        .select('gold_balance')
        .eq('user_id', user.id)
        .maybeSingle(),

      supabase
        .from('user_inventory')
        .select('item_id')
        .eq('user_id', user.id),
    ])

    if (itemsResult.error) {
      setError(`Could not load the shop: ${itemsResult.error.message}`)
      setLoading(false)
      return
    }

    if (walletResult.error) {
      setError(`Could not load your wallet: ${walletResult.error.message}`)
      setLoading(false)
      return
    }

    setItems((itemsResult.data ?? []) as ShopItem[])
    setWallet(walletResult.data ?? { gold_balance: 0 })
    setOwnedItems(
      (inventoryResult.data ?? []).map((item) => item.item_id)
    )

    setLoading(false)
  }

  async function purchaseItem(item: ShopItem) {
    if (buyingItemId) return

    try {
      setBuyingItemId(item.id)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Please log in to purchase this item.')
        return
      }

      const { data, error: purchaseError } = await supabase.rpc(
        'purchase_shop_item',
        {
          p_item_id: item.id,
        }
      )

      if (purchaseError) {
        throw purchaseError
      }

      if (!data?.success) {
        throw new Error('Purchase could not be completed.')
      }

      await loadShop()
    } catch (purchaseError) {
      console.error('Purchase error:', purchaseError)

      const message =
        purchaseError instanceof Error
          ? purchaseError.message
          : 'Something went wrong while purchasing this item.'

      setError(message)
    } finally {
      setBuyingItemId(null)
    }
  }

  useEffect(() => {
    loadShop()
  }, [])

  const filteredItems = useMemo(() => {
    if (category === 'all') return items
    return items.filter((item) => item.item_type === category)
  }, [items, category])

  function formatType(value: string) {
    return value
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function isNotAvailable(item: ShopItem) {
    if (
      item.is_limited &&
      item.remaining_quantity !== null &&
      item.remaining_quantity <= 0
    ) {
      return true
    }

    if (item.starts_at && new Date(item.starts_at) > new Date()) {
      return true
    }

    if (item.expires_at && new Date(item.expires_at) < new Date()) {
      return true
    }

    return false
  }

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
        {/* Back */}
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
              STRIKEHUB STORE
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Shop
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
              Customize your STRIKEHUB identity with exclusive frames,
              backgrounds, effects, and cosmetics.
            </p>
          </div>

          {/* Wallet */}
          <Link
            href="/dashboard/wallet"
            className="group flex w-full items-center gap-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] px-5 py-4 transition hover:border-yellow-500/40 hover:bg-yellow-500/[0.07] sm:w-auto"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-xl">
              🪙
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">
                Your Balance
              </p>
              <p className="mt-1 text-xl font-black text-yellow-400">
                {wallet ? wallet.gold_balance.toLocaleString() : '—'}{' '}
                <span className="text-xs">GOLD</span>
              </p>
            </div>

            <span className="ml-2 text-gray-600 transition group-hover:text-yellow-400">
              →
            </span>
          </Link>
        </section>

        {/* Category tabs */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2">
            {categories.map((item) => {
              const active = category === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold transition ${
                    active
                      ? 'border-red-500/40 bg-red-500/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-gray-500 hover:border-white/20 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Shop banner */}
        <section className="mb-8 overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-950/50 via-[#160b0d] to-[#100c12] p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
                EXCLUSIVE COLLECTION
              </p>

              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                Build your identity.
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                Collect rare cosmetics and make your STRIKEHUB profile stand
                out from the crowd.
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-center">
                <p className="text-xl">⭐</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-gray-500">
                  Rare
                </p>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 text-center">
                <p className="text-xl">💎</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-gray-500">
                  Epic
                </p>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-center">
                <p className="text-xl">🔥</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-gray-500">
                  Mythic
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Content */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-[390px] animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
            <div className="text-3xl">⚠️</div>
            <h2 className="mt-3 text-lg font-black">Shop Error</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">
              {error}
            </p>

            <button
              type="button"
              onClick={loadShop}
              className="mt-5 rounded-xl bg-red-600 px-5 py-3 text-xs font-black transition hover:bg-red-500"
            >
              Try Again
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-4xl">
              🛍️
            </div>

            <h2 className="mt-5 text-xl font-black">
              The shop is waiting for its first drop.
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              There are currently no items in this category. New STRIKEHUB
              cosmetics will appear here when the admin adds them.
            </p>

            {category !== 'all' && (
              <button
                type="button"
                onClick={() => setCategory('all')}
                className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-bold text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                View All Items
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-600">
                  COLLECTION
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  {filteredItems.length} item
                  {filteredItems.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => {
                const owned = ownedItems.includes(item.id)
                const unavailable = isNotAvailable(item)
                const cannotAfford =
                  (wallet?.gold_balance ?? 0) < item.price_gold

                return (
                  <article
                    key={item.id}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-[#100d11]/90 transition duration-300 hover:-translate-y-1 hover:border-red-500/25 hover:shadow-2xl hover:shadow-red-950/20"
                  >
                    {/* Preview */}
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

                      {item.is_limited && (
                        <div className="absolute right-3 top-3">
                          <span className="rounded-lg border border-red-500/30 bg-red-600/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">
                            Limited
                          </span>
                        </div>
                      )}

                      {owned && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
                          <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-xs font-black text-green-400">
                            ✓ OWNED
                          </span>
                        </div>
                      )}

                      {unavailable && !owned && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-[2px]">
                          <span className="rounded-xl border border-white/10 bg-black/70 px-4 py-2 text-xs font-black uppercase text-gray-400">
                            Unavailable
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-600">
                            {formatType(item.item_type)}
                          </p>

                          <h3 className="mt-1 truncate text-lg font-black">
                            {item.name}
                          </h3>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-lg font-black text-yellow-400">
                            {item.price_gold.toLocaleString()}
                          </p>
                          <p className="text-[8px] font-black uppercase tracking-wider text-gray-600">
                            Gold
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 min-h-10 text-xs leading-5 text-gray-600">
                        {item.description || 'A special STRIKEHUB cosmetic.'}
                      </p>

                      {item.is_limited &&
                        item.remaining_quantity !== null && (
                          <p className="mt-3 text-[9px] font-bold text-red-400">
                            {item.remaining_quantity} remaining
                          </p>
                        )}

                      <button
                        type="button"
                        disabled={
                          owned ||
                          unavailable ||
                          cannotAfford ||
                          item.price_gold <= 0 ||
                          buyingItemId === item.id
                        }
                        onClick={() => purchaseItem(item)}
                        className={`mt-5 w-full rounded-xl py-3 text-xs font-black transition ${
                          owned
                            ? 'cursor-not-allowed border border-green-500/20 bg-green-500/5 text-green-500'
                            : unavailable
                              ? 'cursor-not-allowed border border-white/5 bg-white/[0.02] text-gray-700'
                              : cannotAfford
                                ? 'cursor-not-allowed border border-white/5 bg-white/[0.02] text-gray-600'
                                : 'bg-red-600 text-white hover:bg-red-500'
                        }`}
                      >
                        {owned
                          ? 'Already Owned'
                          : unavailable
                            ? 'Unavailable'
                            : cannotAfford
                              ? 'Not Enough Gold'
                              : buyingItemId === item.id
                            ? 'Purchasing...'
                            : 'Buy for ' +
                              item.price_gold.toLocaleString() +
                              ' Gold'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {/* Footer note */}
        <div className="mt-10 rounded-2xl border border-white/5 bg-white/[0.015] p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-700">
            STRIKEHUB COSMETICS
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Items purchased from the shop are permanently added to your
            inventory.
          </p>
        </div>
      </div>
    </main>
  )
}