import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check admin role
  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleError || roleData?.role !== 'admin') {
    redirect('/')
  }

  // Get Admin Wallet
  const { data: wallet } = await supabase
    .from('admin_wallet')
    .select('gold_balance, naira_balance')
    .eq('id', 1)
    .single()

  // Get conversion rate
  const { data: conversion } = await supabase
    .from('conversion_rates')
    .select('naira_per_gold, usd_per_gold')
    .eq('id', 1)
    .single()

  const goldBalance = Number(wallet?.gold_balance ?? 0)
  const nairaPerGold = Number(conversion?.naira_per_gold ?? 0)
  const usdPerGold = Number(conversion?.usd_per_gold ?? 0)

  const goldValueNaira = goldBalance * nairaPerGold
  const goldValueUsd = goldBalance * usdPerGold

  return (
    <main className="min-h-screen bg-[#070707] text-white">

      {/* Header */}
      <header className="border-b border-red-900/30 bg-[#0b0b0b]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-red-500">
              STRIKEHUB
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-wide">
              ADMIN PANEL
            </h1>
          </div>

          {/* Header Navigation */}
          <div className="flex gap-3">

            <Link
              href="/dashboard"
              className="rounded-lg border border-red-900/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
            >
              Player Dashboard
            </Link>

            <Link
              href="/"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Back to Site
            </Link>

          </div>
        </div>
      </header>

      {/* Dashboard */}
      <section className="mx-auto max-w-7xl px-6 py-8">

        <div className="mb-8">
          <p className="text-sm text-gray-400">
            Welcome to the STRIKEHUB control center.
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Admin Dashboard
          </h2>
        </div>

        {/* Wallet */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

          {/* Admin Wallet */}
          <div className="rounded-2xl border border-red-900/30 bg-gradient-to-br from-[#160606] to-[#0d0d0d] p-6 shadow-xl">
            <p className="text-sm font-medium text-gray-400">
              Admin Wallet
            </p>

            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-black text-yellow-400">
                {goldBalance.toLocaleString()}
              </span>

              <span className="mb-1 text-sm font-bold text-gray-400">
                GOLD
              </span>
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Platform treasury balance
            </p>
          </div>

          {/* Gold Value */}
          <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">
            <p className="text-sm font-medium text-gray-400">
              Gold Value
            </p>

            <p className="mt-4 text-3xl font-black">
              ₦
              {goldValueNaira.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>

            <p className="mt-2 text-xs text-gray-500">
              Based on current Gold conversion
            </p>
          </div>

          {/* USD Value */}
          <div className="rounded-2xl border border-white/10 bg-[#101010] p-6">
            <p className="text-sm font-medium text-gray-400">
              USD Value
            </p>

            <p className="mt-4 text-3xl font-black">
              ${goldValueUsd.toFixed(2)}
            </p>

            <p className="mt-2 text-xs text-gray-500">
              Based on current Gold conversion
            </p>
          </div>

          {/* Status */}
          <div className="rounded-2xl border border-green-900/30 bg-[#0c120d] p-6">
            <p className="text-sm font-medium text-gray-400">
              Admin Status
            </p>

            <p className="mt-4 text-2xl font-black text-green-400">
              ACTIVE
            </p>

            <p className="mt-2 text-xs text-gray-500">
              Full administrator access
            </p>
          </div>

        </div>

        {/* Quick Actions */}
        <div className="mt-10">

          <h3 className="mb-4 text-xl font-black">
            Quick Actions
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">

            {/* Add Gold */}
            <Link
              href="/admin/add-gold"
              className="block rounded-xl border border-yellow-900/30 bg-yellow-500/5 p-5 text-left transition hover:border-yellow-500/40 hover:bg-yellow-500/10"
            >
              <div className="text-2xl">🪙</div>

              <p className="mt-3 font-bold">
                Add Gold
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Fund the Admin Wallet
              </p>
            </Link>

            {/* Reward User */}
            <Link
              href="/admin/reward-user"
              className="block rounded-xl border border-red-900/30 bg-red-500/5 p-5 text-left transition hover:border-red-500/40 hover:bg-red-500/10"
            >
              <div className="text-2xl">🎁</div>

              <p className="mt-3 font-bold">
                Reward User
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Send Gold from Admin Wallet
              </p>
            </Link>

            {/* Tournaments */}
            <Link
              href="/admin/tournaments"
              className="block rounded-xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-red-500/40 hover:bg-white/10"
            >
              <div className="text-2xl">🏆</div>

              <p className="mt-3 font-bold">
                Tournaments
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Manage competitions
              </p>
            </Link>

            {/* Users */}
            <Link
              href="/admin/users"
              className="block rounded-xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-red-500/40 hover:bg-white/10"
            >
              <div className="text-2xl">👥</div>

              <p className="mt-3 font-bold">
                Users
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Manage STRIKEHUB users
              </p>
            </Link>

            {/* Gold Value */}
            <Link
              href="/admin/gold-value"
              className="block rounded-xl border border-yellow-900/30 bg-yellow-500/5 p-5 text-left transition hover:border-yellow-500/40 hover:bg-yellow-500/10"
            >
              <div className="text-2xl">⚙️</div>

              <p className="mt-3 font-bold">
                Gold Value
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Update Gold conversion rates
              </p>
            </Link>

            {/* Transactions */}
            <Link
              href="/admin/transactions"
              className="block rounded-xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-red-500/40 hover:bg-white/10"
            >
              <div className="text-2xl">💳</div>

              <p className="mt-3 font-bold">
                Transactions
              </p>

              <p className="mt-1 text-xs text-gray-500">
                View Gold and wallet activity
              </p>
            </Link>

          </div>
        </div>

        {/* Management */}
        <div className="mt-10">

          <h3 className="mb-4 text-xl font-black">
            Management
          </h3>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {[
              [
                '🏆',
                'Tournaments',
                'Create and manage tournaments',
                '/admin/tournaments',
              ],
[
  '📊',
  'Tournament Results',
  'Enter results and pay tournament rewards',
  '/admin/tournament-results',
],
              [
                '👤',
                'Users',
                'Accounts, bans and blacklist',
                '/admin/users',
              ],
              [
                '📊',
                'Leaderboard',
                'Points, wins and kills',
                '/admin/leaderboard',
              ],
              [
                '🎯',
                'Tasks',
                'Create tasks and review submissions',
                '/admin/tasks',
              ],
[
  '🏅',
  'Badges',
  'Create and manage player badges',
  '/admin/badges',
],
[
  '🏆',
  'Titles',
  'Create and manage player titles',
  '/admin/titles',
],
[
  '🖼️',
  'Frames',
  'Create and manage profile frames',
  '/admin/frames',
],
[
  '🌌',
  'Backgrounds',
  'Create and manage profile backgrounds',
  '/admin/backgrounds',
],
[
  '🎯',
  'Stakes',
  'Create and manage betting fixtures, odds and results',
  '/admin/stakes',
],
              [
                '🛒',
                'Shop',
                'Items, prices and inventory',
                '/admin/shop',
              ],
              [
                '💸',
                'Withdrawals',
                'Review withdrawal requests',
                '/admin/withdrawals',
              ],
              [
                '📢',
                'Announcements',
                'Platform announcements',
                '/admin/announcements',
              ],
              [
                '📣',
                'Promotions',
                'Manage Promote With Us',
                '/admin/promotions',
              ],
[
  '🔗',
  'Referrals',
  'Manage referral rewards and settings',
  '/admin/referrals',
],
              [
                '💬',
                'Community',
                'Moderate community chat',
                '/admin/community',
              ],
              [
                '💳',
                'Transactions',
                'View complete wallet activity',
                '/admin/transactions',
              ],
            ].map(([icon, title, description, href]) => (
              <Link
                key={title}
                href={href}
                className="block rounded-xl border border-white/10 bg-[#101010] p-5 transition hover:border-red-900/40 hover:bg-[#141414]"
              >
                <div className="text-2xl">
                  {icon}
                </div>

                <h4 className="mt-3 font-bold">
                  {title}
                </h4>

                <p className="mt-1 text-xs text-gray-500">
                  {description}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-10 rounded-xl border border-red-900/30 bg-red-950/10 p-5">

          <p className="font-bold text-red-400">
            🔐 Administrator Security
          </p>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            This area is restricted to STRIKEHUB administrator accounts.
            Wallet operations are protected by server-side database
            authorization and are not controlled merely by hiding buttons
            from regular users.
          </p>

        </div>

      </section>
    </main>
  )
}