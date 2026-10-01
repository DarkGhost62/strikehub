'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  bloodstrike_uid: string | null
  email: string | null
  phone: string | null
  country: string | null
  in_game_name: string | null
  display_name: string | null
  profile_image_url: string | null
  points: number | null
  matches_won: number | null
  total_kills: number | null
}

type EquippedItem = {
  item_id: string
  item_type: string
  name: string
  image_url: string | null
}

type EquippedBadge = {
  id: string
  badge_id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
}

type EquippedTitle = {
  id: string
  title_id: string
  name: string
  description: string | null
  rarity: string
}

const PROFILE_IMAGES = Array.from(
  { length: 15 },
  (_, index) =>
    `/profile-images/profile-${String(index + 1).padStart(2, '0')}.png`
)

function getRandomProfileImage() {
  return PROFILE_IMAGES[
    Math.floor(Math.random() * PROFILE_IMAGES.length)
  ]
}

export default function ProfilePage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [equippedItem, setEquippedItem] = useState<EquippedItem | null>(null)
  const [equippedBackground, setEquippedBackground] =
    useState<EquippedItem | null>(null)
  const [equippedBadges, setEquippedBadges] = useState<EquippedBadge[]>([])
  const [equippedTitle, setEquippedTitle] =
    useState<EquippedTitle | null>(null)

  const [gameName, setGameName] = useState('')
  const [originalGameName, setOriginalGameName] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      setError('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Unable to identify your account. Please log in again.')
        setLoading(false)
        return
      }

      // ============================================
      // LOAD PLAYER PROFILE
      // ============================================

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(
          'bloodstrike_uid, email, phone, country, in_game_name, display_name, profile_image_url, points, matches_won, total_kills'
        )
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Profile loading error:', profileError)
        setError(`Could not load your profile: ${profileError.message}`)
        setLoading(false)
        return
      }

      if (!data) {
        setError('Your profile could not be found.')
        setLoading(false)
        return
      }

      /*
       * ============================================
       * PROFILE IMAGE
       * ============================================
       *
       * Existing player with an image:
       *     Keep the existing image.
       *
       * Existing player without an image:
       *     Randomly select one of the 15 STRIKEHUB
       *     profile images and save it permanently.
       */

      let profileImageUrl = data.profile_image_url as string | null

      if (!profileImageUrl) {
        profileImageUrl = getRandomProfileImage()

        const { error: profileImageUpdateError } = await supabase
          .from('profiles')
          .update({
            profile_image_url: profileImageUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        if (profileImageUpdateError) {
          console.error(
            'Profile image assignment error:',
            profileImageUpdateError
          )

          /*
           * Even if saving fails, show the randomly selected image
           * during this visit. The next successful profile load will
           * try to save one again.
           */
        }
      }

      const loadedProfile: Profile = {
        bloodstrike_uid: data.bloodstrike_uid,
        email: data.email ?? user.email ?? null,
        phone: data.phone,
        country: data.country,
        in_game_name: data.in_game_name,
        display_name: data.display_name,
        profile_image_url: profileImageUrl,
        points: data.points,
        matches_won: data.matches_won,
        total_kills: data.total_kills,
      }

      setProfile(loadedProfile)

      const currentGameName = loadedProfile.in_game_name ?? ''
      setGameName(currentGameName)
      setOriginalGameName(currentGameName)

      // ============================================
      // LOAD REAL EQUIPPED BADGES + TITLE
      // ============================================

      const {
        data: equippedCosmeticRows,
        error: equippedCosmeticError,
      } = await supabase
        .from('user_equipped_items')
        .select('item_id, item_type')
        .eq('user_id', user.id)

      if (equippedCosmeticError) {
        console.error(
          'Equipped cosmetics loading error:',
          equippedCosmeticError
        )
        setEquippedBadges([])
        setEquippedTitle(null)
      } else {
        const equippedRows = equippedCosmeticRows ?? []

        // REAL EQUIPPED BADGES
        const equippedBadgeRows = equippedRows.filter(
          (item) => item.item_type === 'badge'
        )

        if (equippedBadgeRows.length > 0) {
          const badgeShopIds = equippedBadgeRows.map((item) => item.item_id)

          const {
            data: badgeShopItems,
            error: badgeShopError,
          } = await supabase
            .from('shop_items')
            .select('id, badge_id')
            .in('id', badgeShopIds)

          if (badgeShopError) {
            console.error(
              'Equipped badge shop-item loading error:',
              badgeShopError
            )
            setEquippedBadges([])
          } else {
            const badgeIds = (badgeShopItems ?? [])
              .map((item) => item.badge_id)
              .filter(Boolean) as string[]

            if (badgeIds.length > 0) {
              const {
                data: badgeData,
                error: badgeDataError,
              } = await supabase
                .from('badges')
                .select('id, name, description, image_url, rarity')
                .in('id', badgeIds)
                .eq('is_active', true)

              if (badgeDataError) {
                console.error(
                  'Equipped badge loading error:',
                  badgeDataError
                )
                setEquippedBadges([])
              } else {
                const loadedBadges: EquippedBadge[] = (badgeData ?? [])
                  .map((badge) => ({
                    id: badge.id,
                    badge_id: badge.id,
                    name: badge.name,
                    description: badge.description ?? null,
                    image_url: badge.image_url ?? null,
                    rarity: badge.rarity,
                  }))
                  .slice(0, 3)

                setEquippedBadges(loadedBadges)
              }
            } else {
              setEquippedBadges([])
            }
          }
        } else {
          setEquippedBadges([])
        }

        // REAL EQUIPPED TITLE
        const equippedTitleRow = equippedRows.find(
          (item) => item.item_type === 'title'
        )

        if (equippedTitleRow) {
          const {
            data: titleShopItem,
            error: titleShopError,
          } = await supabase
            .from('shop_items')
            .select('id, title_id')
            .eq('id', equippedTitleRow.item_id)
            .maybeSingle()

          if (titleShopError || !titleShopItem?.title_id) {
            console.error(
              'Equipped title shop-item loading error:',
              titleShopError
            )
            setEquippedTitle(null)
          } else {
            const {
              data: titleData,
              error: titleDataError,
            } = await supabase
              .from('titles')
              .select('id, name, description, rarity')
              .eq('id', titleShopItem.title_id)
              .eq('is_active', true)
              .maybeSingle()

            if (titleDataError || !titleData) {
              console.error(
                'Equipped title loading error:',
                titleDataError
              )
              setEquippedTitle(null)
            } else {
              setEquippedTitle({
                id: titleShopItem.id,
                title_id: titleData.id,
                name: titleData.name,
                description: titleData.description ?? null,
                rarity: titleData.rarity,
              })
            }
          }
        } else {
          setEquippedTitle(null)
        }
      }

      // ============================================
      // LOAD CURRENTLY EQUIPPED ITEM
      // ============================================

      const {
        data: equippedRows,
        error: equippedError,
      } = await supabase
        .from('user_equipped_items')
        .select('item_id, item_type')
        .eq('user_id', user.id)

      if (equippedError) {
        console.error('Equipped item loading error:', equippedError)
        setEquippedItem(null)
      } else if (equippedRows && equippedRows.length > 0) {
        const equippedFrame = equippedRows.find(
          (item) => item.item_type === 'frame'
        )

        const equippedBg = equippedRows.find(
          (item) => item.item_type === 'background'
        )

        const cosmeticIds = [
          equippedFrame?.item_id,
          equippedBg?.item_id,
        ].filter(Boolean) as string[]

        if (cosmeticIds.length > 0) {
          const { data: shopItems, error: shopItemsError } =
            await supabase
              .from('shop_items')
              .select('id, name, image_url, item_type')
              .in('id', cosmeticIds)

          if (shopItemsError) {
            console.error(
              'Equipped shop items loading error:',
              shopItemsError
            )
            setEquippedItem(null)
            setEquippedBackground(null)
          } else {
            const frameShopItem = shopItems?.find(
              (item) => item.id === equippedFrame?.item_id
            )

            const backgroundShopItem = shopItems?.find(
              (item) => item.id === equippedBg?.item_id
            )

            setEquippedItem(
              frameShopItem
                ? {
                    item_id: frameShopItem.id,
                    item_type: frameShopItem.item_type,
                    name: frameShopItem.name,
                    image_url: frameShopItem.image_url,
                  }
                : null
            )

            setEquippedBackground(
              backgroundShopItem
                ? {
                    item_id: backgroundShopItem.id,
                    item_type: backgroundShopItem.item_type,
                    name: backgroundShopItem.name,
                    image_url: backgroundShopItem.image_url,
                  }
                : null
            )
          }
        } else {
          setEquippedItem(null)
          setEquippedBackground(null)
        }
      } else {
        setEquippedItem(null)
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  // ============================================
  // SAVE GAME NAME
  // ============================================

  async function saveGameName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage('')
    setError('')

    const cleanedName = gameName.trim()

    if (!cleanedName) {
      setError('Please enter your BloodStrike game name.')
      return
    }

    if (cleanedName.length < 2) {
      setError('Game name must contain at least 2 characters.')
      return
    }

    if (cleanedName.length > 30) {
      setError('Game name must be 30 characters or fewer.')
      return
    }

    if (cleanedName === originalGameName) {
      setMessage('Your game name is already up to date.')
      return
    }

    setSaving(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('Your session has expired. Please log in again.')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        in_game_name: cleanedName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Game name update error:', updateError)
      setError(`Could not update your game name: ${updateError.message}`)
      setSaving(false)
      return
    }

    setGameName(cleanedName)
    setOriginalGameName(cleanedName)

    setProfile((current) =>
      current
        ? {
            ...current,
            in_game_name: cleanedName,
          }
        : current
    )

    setMessage('Game name updated successfully.')
    setSaving(false)
  }

  // ============================================
  // LOADING SCREEN
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-5">
          <div className="text-center">
            <div className="animate-pulse text-4xl">👤</div>

            <p className="mt-4 text-sm font-bold text-gray-500">
              Loading profile...
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ============================================
  // PROFILE PAGE
  // ============================================

  const displayName = profile?.display_name || 'StrikeHub Player'
  const gameNameValue = profile?.in_game_name || 'BloodStrike Player'
  const points = Number(profile?.points ?? 0)
  const wins = Number(profile?.matches_won ?? 0)
  const kills = Number(profile?.total_kills ?? 0)

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">

        {/* HEADER */}
        <div className="mb-6 sm:mb-7">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 transition hover:text-red-400"
          >
            ← Back to Dashboard
          </Link>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                Account
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                My Profile
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Your STRIKEHUB identity, achievements and collections.
              </p>
            </div>

            <p className="hidden pb-1 text-[9px] font-black uppercase tracking-[0.35em] text-gray-600 sm:block">
              COMPETE. EARN. RISE.
            </p>
          </div>
        </div>

        {/* PROFILE PLAYER CARD */}
        <section
          className={`relative overflow-hidden rounded-[2rem] shadow-2xl ${
            equippedItem?.item_type === 'frame'
              ? 'shadow-blue-950/30'
              : 'border border-white/10 shadow-black/30'
          }`}
        >
          <div className="relative min-h-[340px] overflow-hidden rounded-[2rem] bg-[#0b090c] sm:aspect-[16/9] sm:min-h-0">

            {/* Profile background */}
            {equippedBackground?.image_url ? (
              <img
                src={equippedBackground.image_url}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
              />
            ) : (
              <>
                <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_70%_35%,rgba(120,15,20,.34),transparent_28%),radial-gradient(circle_at_20%_70%,rgba(255,70,10,.10),transparent_32%)]" />

                <div className="absolute inset-0 z-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:36px_36px]" />

                <div className="absolute -right-20 -top-24 z-0 h-72 w-72 rounded-full bg-red-600/10 blur-[100px]" />

                <div className="absolute -bottom-28 left-1/3 z-0 h-72 w-72 rounded-full bg-orange-500/10 blur-[100px]" />
              </>
            )}

            {equippedBackground?.image_url && (
              <div className="pointer-events-none absolute inset-0 z-0 bg-black/20" />
            )}

            {/* Frame */}
            {equippedItem?.item_type === 'frame' &&
              equippedItem.image_url && (
                <img
                  src={equippedItem.image_url}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 h-full w-full object-fill"
                />
              )}

            {/* Safe content area */}
            <div className="relative z-40 flex min-h-[340px] items-center px-[14%] py-[12%] sm:aspect-[16/9] sm:min-h-0 sm:px-[13%] sm:py-[10%]">
              <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">

                {/* Avatar */}
                <div className="relative z-50 h-32 w-32 shrink-0 sm:h-36 sm:w-36">
                  <div className="absolute inset-0 rounded-[1.4rem] border border-red-500/70 bg-black/60 p-1.5 shadow-[0_0_35px_rgba(255,40,0,.18)]">
                    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1rem] bg-red-500/10 text-4xl font-black text-red-400">
                      {profile?.profile_image_url ? (
                        <img
                          src={profile.profile_image_url}
                          alt={displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                </div>

                {/* Identity */}
                <div className="relative z-50 min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">
                    STRIKEHUB PLAYER
                  </p>

                  <div className="mt-1 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                    <h2 className="truncate text-3xl font-black tracking-tight text-white sm:text-4xl">
                      {displayName}
                    </h2>
                  </div>

                  {equippedTitle && (
                    <div className="mt-3 inline-flex rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 shadow-[0_0_20px_rgba(255,180,0,.08)]">
                      <span className="text-xs font-black uppercase tracking-wider text-yellow-400">
                        {equippedTitle.name}
                      </span>
                    </div>
                  )}

                  {equippedBadges.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                      {equippedBadges.slice(0, 3).map((badge) => (
                        <EquippedBadgeSlot
                          key={badge.id}
                          badge={badge}
                        />
                      ))}
                    </div>
                  )}

                  <p className="mt-3 text-sm font-semibold text-gray-400">
                    {gameNameValue}
                  </p>

                  <div className="relative z-50 mt-3 flex -translate-y-2 flex-wrap justify-center gap-1.5 sm:-translate-y-4 sm:justify-start sm:gap-2">
                    <ProfileChip icon="🎮" text="BloodStrike" />

                    <ProfileChip
                      icon="⭐"
                      text={`${points.toLocaleString()} Points`}
                      gold
                    />

                    <ProfileChip
                      icon="🏆"
                      text={`${wins.toLocaleString()} Wins`}
                    />

                    <ProfileChip
                      icon="🎯"
                      text={`${kills.toLocaleString()} Kills`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COLLECTIONS */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-[#0b0a0d]/95 p-5 shadow-xl sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                Collections
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Your equipped cosmetics and profile customizations.
              </p>
            </div>

            <Link
              href="/dashboard/inventory"
              className="inline-flex items-center justify-center rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-5 py-2.5 text-xs font-black text-yellow-400 transition hover:border-yellow-500/50 hover:bg-yellow-500/10"
            >
              Manage Inventory →
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CollectionCard
              label="Profile Frame"
              name={
                equippedItem?.item_type === 'frame'
                  ? equippedItem.name
                  : 'Not Equipped'
              }
              imageUrl={
                equippedItem?.item_type === 'frame'
                  ? equippedItem.image_url
                  : null
              }
              equipped={equippedItem?.item_type === 'frame'}
              description="Wraps your profile background."
            />

            <CollectionCard
              label="Profile Background"
              name={
                equippedBackground?.item_type === 'background'
                  ? equippedBackground.name
                  : 'Default Background'
              }
              imageUrl={
                equippedBackground?.item_type === 'background'
                  ? equippedBackground.image_url
                  : null
              }
              equipped={
                equippedBackground?.item_type === 'background'
              }
              description="Your current profile background."
            />

            <CollectionCard
              label="Name Effect"
              name="Not Equipped"
              imageUrl={null}
              equipped={false}
              description="Add a unique effect to your name."
            />

            <CollectionCard
              label="Chat Effect"
              name="Not Equipped"
              imageUrl={null}
              equipped={false}
              description="Customize your community chat."
            />
          </div>
        </section>

        {/* REAL BADGES + TITLE */}
        {(equippedBadges.length > 0 || equippedTitle) && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">

            {equippedBadges.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-[#0b0a0d]/95 p-5 shadow-xl sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                      Badges
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Your equipped achievements.
                    </p>
                  </div>

                  <Link
                    href="/dashboard/inventory"
                    className="text-[10px] font-black uppercase tracking-wider text-red-400 transition hover:text-red-300"
                  >
                    View Inventory →
                  </Link>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {equippedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="w-24 rounded-2xl border border-white/10 bg-black/20 p-3"
                      title={badge.name}
                    >
                      <div className="flex h-16 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        {badge.image_url ? (
                          <img
                            src={badge.image_url}
                            alt={badge.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="text-3xl">🏅</span>
                        )}
                      </div>

                      <p className="mt-2 truncate text-center text-[10px] font-black text-gray-200">
                        {badge.name}
                      </p>

                      <p className="mt-1 text-center text-[8px] font-black uppercase tracking-wider text-yellow-400">
                        {badge.rarity}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {equippedTitle && (
              <section className="rounded-3xl border border-white/10 bg-[#0b0a0d]/95 p-5 shadow-xl sm:p-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500">
                    Equipped Title
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Your currently equipped player title.
                  </p>
                </div>

                <div className="mt-5">
                  <div className="inline-flex rounded-full border border-yellow-500/50 bg-yellow-500/10 px-5 py-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-yellow-400">
                      {equippedTitle.name}
                    </span>
                  </div>

                  {equippedTitle.description && (
                    <p className="mt-3 text-xs leading-5 text-gray-500">
                      {equippedTitle.description}
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ACCOUNT INFORMATION */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-[#0e0d10]/95 p-6 backdrop-blur sm:p-8">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
              Account Information
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Player Details
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Your account identifiers are protected and cannot be changed here.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <InfoField
              label="STRIKEHUB Display Name"
              value={profile?.display_name}
              locked
            />

            <InfoField
              label="BloodStrike UID"
              value={profile?.bloodstrike_uid}
              locked
            />

            <InfoField
              label="Email"
              value={profile?.email}
              locked
            />

            <InfoField
              label="Phone Number"
              value={profile?.phone}
              locked
            />

            <InfoField
              label="Country"
              value={profile?.country}
              locked
            />
          </div>
        </section>

        {/* CHANGE GAME NAME */}
        <section className="mt-6 rounded-3xl border border-red-500/20 bg-[#100d11]/95 p-6 shadow-xl shadow-red-950/10 sm:p-8">
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
              BloodStrike
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Change Game Name
            </h2>

            <p className="mt-1 text-xs leading-5 text-gray-500">
              Update the in-game name connected to your STRIKEHUB account.
              Your BloodStrike UID will remain unchanged.
            </p>
          </div>

          <form onSubmit={saveGameName}>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                Current / New Game Name
              </span>

              <input
                type="text"
                value={gameName}
                onChange={(event) => {
                  setGameName(event.target.value)
                  setMessage('')
                  setError('')
                }}
                maxLength={30}
                placeholder="Enter your BloodStrike game name"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/50 focus:bg-black/40"
              />

              <div className="mt-2 flex items-center justify-between">
                <p className="text-[10px] text-gray-600">
                  2–30 characters
                </p>

                <p className="text-[10px] text-gray-600">
                  {gameName.length}/30
                </p>
              </div>
            </label>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <p className="text-xs font-semibold leading-5 text-red-300">
                  {error}
                </p>
              </div>
            )}

            {message && (
              <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3">
                <p className="text-xs font-semibold leading-5 text-green-300">
                  ✓ {message}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-6 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Game Name'}
              </button>

              <p className="text-[10px] leading-4 text-gray-600">
                Your UID stays the same even when your game name changes.
              </p>
            </div>
          </form>
        </section>

        {/* SECURITY */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/5">
              🔒
            </div>

            <div>
              <p className="text-xs font-bold text-gray-300">
                Account protection
              </p>

              <p className="mt-1 text-[11px] leading-5 text-gray-600">
                Your BloodStrike UID and STRIKEHUB account identity are protected.
                If you need to change account credentials, use the appropriate
                account settings.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function ProfileChip({
  icon,
  text,
  gold = false,
}: {
  icon: string
  text: string
  gold?: boolean
}) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-wider sm:px-3 sm:text-[9px] ${
        gold
          ? 'border-yellow-500/25 bg-yellow-500/5 text-yellow-400'
          : 'border-white/10 bg-black/30 text-gray-300'
      }`}
    >
      {icon} {text}
    </span>
  )
}

function EquippedBadgeSlot({
  badge,
}: {
  badge: EquippedBadge
}) {
  return (
    <div
      title={`${badge.name} • ${badge.rarity}`}
      aria-label={`${badge.name} badge`}
      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-yellow-500/30 bg-black/40 p-1 shadow-[0_0_18px_rgba(255,180,0,.10)] transition duration-200 hover:scale-105 hover:border-yellow-400/60"
    >
      {badge.image_url ? (
        <img
          src={badge.image_url}
          alt={badge.name}
          className="pointer-events-none block h-full w-full object-contain"
        />
      ) : (
        <span className="text-xl">🏅</span>
      )}
    </div>
  )
}

function CollectionCard({
  label,
  name,
  imageUrl,
  equipped,
  description,
}: {
  label: string
  name: string
  imageUrl: string | null
  equipped: boolean
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-center text-[9px] font-black uppercase tracking-[0.25em] text-gray-500">
        {label}
      </p>

      <div className="mt-3 flex h-20 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-gray-700">
            NO PREVIEW
          </span>
        )}
      </div>

      <p className="mt-3 truncate text-center text-sm font-black text-gray-200">
        {name}
      </p>

      <div className="mt-2 flex justify-center">
        <span
          className={`rounded-lg border px-3 py-1 text-[9px] font-black uppercase tracking-wider ${
            equipped
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
              : 'border-white/10 bg-white/[0.02] text-gray-600'
          }`}
        >
          {equipped ? 'Equipped' : 'Not Equipped'}
        </span>
      </div>

      <p className="mt-2 text-center text-[10px] leading-4 text-gray-600">
        {description}
      </p>
    </div>
  )
}

function InfoField({
  label,
  value,
  locked,
}: {
  label: string
  value?: string | null
  locked?: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-wider text-gray-600">
          {label}
        </p>

        {locked && (
          <span className="text-[9px] text-gray-700">
            🔒 Locked
          </span>
        )}
      </div>

      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <p className="truncate text-sm font-semibold text-gray-300">
          {value || 'Not provided'}
        </p>
      </div>
    </div>
  )
}