import Link from 'next/link'
import LogoutButton from './logout-button'

const mainLinks = [
  { name: 'Dashboard', href: '/dashboard', icon: '⌂' },
  { name: 'Tournaments', href: '/tournaments', icon: '🏆' },
  { name: 'My Tournaments', href: '/dashboard/tournaments', icon: '🎮' },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: '📊' },
]

const earnLinks = [
  { name: 'Tasks', href: '/dashboard/tasks', icon: '✓' },
  { name: 'Daily Login', href: '/dashboard/daily-login', icon: '🔥' },
  { name: 'Shop', href: '/dashboard/shop', icon: '🛒' },
  { name: 'Stake', href: '/dashboard/stake', icon: '🎯' },
  { name: 'Referrals', href: '/dashboard/referrals', icon: '👥' },
]

const walletLinks = [
  { name: 'Wallet', href: '/dashboard/wallet', icon: '🪙' },
{ name: 'Inventory', href: '/dashboard/inventory', icon: '🎒' },
  { name: 'Withdraw', href: '/dashboard/withdraw', icon: '💰' },
]

const communityLinks = [
  { name: 'Community', href: '/dashboard/community', icon: '💬' },
  { name: 'Announcements', href: '/dashboard/announcements', icon: '📢' },
  { name: 'Promote With Us', href: '/dashboard/promote', icon: '📣' },
]

const accountLinks = [
  { name: 'Profile', href: '/dashboard/profile', icon: '👤' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙' },
]

function NavSection({
  title,
  links,
}: {
  title: string
  links: { name: string; href: string; icon: string }[]
}) {
  return (
    <div className="mb-6">

      <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.25em] text-gray-600">
        {title}
      </p>

      <div className="space-y-1">

        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-400 transition hover:bg-red-500/10 hover:text-white"
          >

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-base transition group-hover:bg-red-500/10">
              {link.icon}
            </span>

            <span>
              {link.name}
            </span>

          </Link>
        ))}

      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070507] text-white">

      {/* ================================================= */}
      {/* GLOBAL ATMOSPHERIC BACKGROUND                    */}
      {/* ================================================= */}

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">

        <div className="absolute -left-52 -top-52 h-[700px] w-[700px] rounded-full bg-red-700/20 blur-[160px]" />

        <div className="absolute right-[-250px] top-[10%] h-[750px] w-[750px] rounded-full bg-red-600/15 blur-[180px]" />

        <div className="absolute bottom-[-300px] left-[30%] h-[700px] w-[700px] rounded-full bg-orange-600/10 blur-[180px]" />

        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,70,70,.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,70,70,.5) 1px, transparent 1px)
            `,
            backgroundSize: '44px 44px',
          }}
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,transparent_0%,#070507_72%)]" />

      </div>

      {/* ================================================= */}
      {/* DESKTOP SIDEBAR                                  */}
      {/* ================================================= */}

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-white/10 bg-[#0a080b]/90 backdrop-blur-2xl lg:block">

        <div className="flex h-full flex-col">

          {/* LOGO */}

          <div className="border-b border-white/10 px-6 py-6">

            <Link href="/dashboard" className="block">

              <div className="text-2xl font-black tracking-tight">
                <span className="text-white">
                  STRIKE
                </span>

                <span className="text-red-500">
                  HUB
                </span>
              </div>

              <p className="mt-1 text-[9px] font-bold tracking-[0.3em] text-gray-600">
                COMPETE. EARN. RISE.
              </p>

            </Link>

          </div>

          {/* NAVIGATION */}

          <div className="flex-1 overflow-y-auto px-3 py-6">

            <NavSection
              title="Main"
              links={mainLinks}
            />

            <NavSection
              title="Earn & Play"
              links={earnLinks}
            />

            <NavSection
              title="Wallet"
              links={walletLinks}
            />

            <NavSection
              title="Community"
              links={communityLinks}
            />

            <NavSection
              title="Account"
              links={accountLinks}
            />

          </div>

          {/* REAL LOGOUT */}

          <div className="border-t border-white/10 p-3">
            <LogoutButton />
          </div>

        </div>

      </aside>

      {/* ================================================= */}
      {/* MOBILE HEADER                                    */}
      {/* ================================================= */}

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09080b]/90 backdrop-blur-xl lg:hidden">

        <div className="flex h-16 items-center justify-between px-4">

          <Link href="/dashboard">

            <div className="text-xl font-black">
              <span className="text-white">
                STRIKE
              </span>

              <span className="text-red-500">
                HUB
              </span>
            </div>

          </Link>

          <details className="relative">

            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xl">
              ☰
            </summary>

            <div className="absolute right-0 top-12 max-h-[75vh] w-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#100d11]/95 p-4 shadow-2xl backdrop-blur-xl">

              <NavSection
                title="Main"
                links={mainLinks}
              />

              <NavSection
                title="Earn & Play"
                links={earnLinks}
              />

              <NavSection
                title="Wallet"
                links={walletLinks}
              />

              <NavSection
                title="Community"
                links={communityLinks}
              />

              <NavSection
                title="Account"
                links={accountLinks}
              />

              <LogoutButton />

            </div>

          </details>

        </div>

      </header>

      {/* ================================================= */}
      {/* PAGE CONTENT                                     */}
      {/* ================================================= */}

      <main className="min-h-screen lg:ml-64">

        <div className="pb-24 lg:pb-0">
          {children}
        </div>

      </main>

      {/* ================================================= */}
      {/* MOBILE BOTTOM NAV                                */}
      {/* ================================================= */}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#09080b]/95 backdrop-blur-xl lg:hidden">

        <div className="grid grid-cols-5">

          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-semibold text-gray-400 hover:text-white"
          >
            <span className="text-lg">
              ⌂
            </span>
            Home
          </Link>

          <Link
            href="/tournaments"
            className="flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-semibold text-gray-400 hover:text-white"
          >
            <span className="text-lg">
              🏆
            </span>
            Tournaments
          </Link>

          <Link
            href="/dashboard/tournaments"
            className="flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-semibold text-gray-400 hover:text-white"
          >
            <span className="text-lg">
              🎮
            </span>
            My Games
          </Link>

          <Link
            href="/dashboard/shop"
            className="flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-semibold text-gray-400 hover:text-white"
          >
            <span className="text-lg">
              🛒
            </span>
            Shop
          </Link>

          <Link
            href="/dashboard/profile"
            className="flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-semibold text-gray-400 hover:text-white"
          >
            <span className="text-lg">
              👤
            </span>
            Profile
          </Link>

        </div>

      </nav>

    </div>
  )
}