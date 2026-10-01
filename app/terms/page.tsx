export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl">

        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black">
            STRIKE<span className="text-red-500">HUB</span>
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            COMPETE. EARN. RISE.
          </p>

          <h2 className="mt-8 text-3xl font-bold">
            Terms & Conditions
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            Last updated: September 2026
          </p>
        </div>

        <div className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 md:p-10">

          <section>
            <h3 className="mb-3 text-xl font-bold">
              1. Platform Use
            </h3>

            <p className="leading-7 text-zinc-400">
              STRIKEHUB is a gaming and esports platform designed
              for tournaments, competitions, community activities,
              rewards and related gaming services.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              2. Account Information
            </h3>

            <p className="leading-7 text-zinc-400">
              Users must provide accurate information when creating
              an account. Your BloodStrike UID must belong to you
              and must be exactly 12 digits.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              3. Tournament Rules
            </h3>

            <p className="leading-7 text-zinc-400">
              Users must follow the rules specified for each
              tournament. STRIKEHUB may remove, disqualify or
              restrict participants who violate tournament rules.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              4. Rewards & Gold
            </h3>

            <p className="leading-7 text-zinc-400">
              Gold is an internal STRIKEHUB platform currency.
              Rewards are issued according to platform rules and
              approved results. STRIKEHUB may investigate suspicious
              or fraudulent activity before issuing rewards.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              5. Fair Play
            </h3>

            <p className="leading-7 text-zinc-400">
              Cheating, exploiting bugs, account sharing, fraudulent
              activity, manipulation of tournament results and other
              forms of unfair play are prohibited.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              6. Community
            </h3>

            <p className="leading-7 text-zinc-400">
              Users must communicate respectfully. Spam, harassment,
              abusive content and prohibited language may result in
              moderation actions.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              7. Account Restrictions
            </h3>

            <p className="leading-7 text-zinc-400">
              STRIKEHUB may suspend, restrict or terminate accounts
              involved in serious violations of platform rules.
              Tournament blacklisting may also prevent participation
              in tournaments.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              8. Platform Changes
            </h3>

            <p className="leading-7 text-zinc-400">
              Tournament rules, rewards, platform features and
              conversion rates may be changed by STRIKEHUB
              administrators when necessary.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              9. Responsible Use
            </h3>

            <p className="leading-7 text-zinc-400">
              Some STRIKEHUB features may involve staking or other
              activities that can be subject to age restrictions
              and applicable laws. Such features will only be made
              available where legally permitted and after appropriate
              compliance measures are in place.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xl font-bold">
              10. Acceptance
            </h3>

            <p className="leading-7 text-zinc-400">
              By creating a STRIKEHUB account, you confirm that you
              have read and agree to these Terms & Conditions and
              the applicable STRIKEHUB rules.
            </p>
          </section>

          <div className="border-t border-zinc-800 pt-6">
            <a
              href="/register"
              className="inline-block rounded-lg bg-red-600 px-6 py-3 font-bold hover:bg-red-500"
            >
              Back to registration
            </a>
          </div>

        </div>
      </div>
    </main>
  )
}