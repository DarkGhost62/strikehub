'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Submission = {
  id: string
  task_id: string
  user_id: string
  proof_text: string | null
  proof_image_url: string | null
  status: string
  admin_note: string | null
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

type Task = {
  id: string
  title: string
  reward_type: string
  reward_amount: number
}

type Profile = {
  id: string
  bloodstrike_uid: string
  in_game_name: string | null
  display_name: string
  email: string
}

type ReviewAction = 'approve' | 'reject' | 'resubmit'

type SubmissionView = Submission & {
  task?: Task
  profile?: Profile
}

export default function AdminTaskSubmissionsPage() {
  const supabase = createClient()

  const [submissions, setSubmissions] = useState<SubmissionView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionView | null>(null)

  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const [filter, setFilter] = useState('pending')

  async function loadSubmissions() {
    setLoading(true)
    setError('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: adminCheck, error: adminError } =
        await supabase.rpc('is_admin')

      if (adminError || !adminCheck) {
        window.location.href = '/dashboard'
        return
      }

      const { data: submissionData, error: submissionError } =
        await supabase
          .from('task_submissions')
          .select(
            'id, task_id, user_id, proof_text, proof_image_url, status, admin_note, submitted_at, reviewed_at, reviewed_by'
          )
          .order('submitted_at', {
            ascending: false,
          })

      if (submissionError) {
        throw new Error(submissionError.message)
      }

      const rawSubmissions =
        (submissionData as Submission[]) ?? []

      if (rawSubmissions.length === 0) {
        setSubmissions([])
        setLoading(false)
        return
      }

      const taskIds = [
        ...new Set(
          rawSubmissions.map(
            (submission) => submission.task_id
          )
        ),
      ]

      const userIds = [
        ...new Set(
          rawSubmissions.map(
            (submission) => submission.user_id
          )
        ),
      ]

      const [
        { data: taskData, error: taskError },
        { data: profileData, error: profileError },
      ] = await Promise.all([
        supabase
          .from('tasks')
          .select(
            'id, title, reward_type, reward_amount'
          )
          .in('id', taskIds),

        supabase
          .from('profiles')
          .select(
            'id, bloodstrike_uid, in_game_name, display_name, email'
          )
          .in('id', userIds),
      ])

      if (taskError) {
        throw new Error(taskError.message)
      }

      if (profileError) {
        throw new Error(profileError.message)
      }

      const taskMap = new Map(
        ((taskData as Task[]) ?? []).map(
          (task) => [task.id, task]
        )
      )

      const profileMap = new Map(
        ((profileData as Profile[]) ?? []).map(
          (profile) => [profile.id, profile]
        )
      )

      const combined: SubmissionView[] =
        rawSubmissions.map((submission) => ({
          ...submission,
          task: taskMap.get(
            submission.task_id
          ),
          profile: profileMap.get(
            submission.user_id
          ),
        }))

      setSubmissions(combined)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load submissions.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubmissions()
  }, [])

  async function reviewSubmission(
    action: ReviewAction
  ) {
    if (!selectedSubmission) {
      return
    }

    if (
      (action === 'reject' ||
        action === 'resubmit') &&
      !reviewNote.trim()
    ) {
      setError(
        action === 'reject'
          ? 'Please provide a reason for rejecting this submission.'
          : 'Please provide instructions for the player.'
      )
      return
    }

    if (action === 'approve') {
      const confirmed = window.confirm(
        `Approve this submission?\n\n${
          selectedSubmission.profile?.display_name ??
          'Player'
        } will receive ${
          selectedSubmission.task?.reward_amount ?? 0
        } ${
          selectedSubmission.task?.reward_type === 'gold'
            ? 'Gold'
            : 'reward'
        }.`
      )

      if (!confirmed) {
        return
      }
    }

    setReviewing(true)
    setError('')
    setMessage('')

    try {
      const { data, error: rpcError } =
        await supabase.rpc(
          'review_task_submission',
          {
            p_submission_id:
              selectedSubmission.id,
            p_action: action,
            p_admin_note:
              reviewNote.trim() || null,
          }
        )

      if (rpcError) {
        throw new Error(rpcError.message)
      }

      const result = data as {
        success?: boolean
        action?: string
        reward_amount?: number
        reward_type?: string
      }

      if (!result?.success) {
        throw new Error(
          'The submission could not be processed.'
        )
      }

      if (action === 'approve') {
        setMessage(
          `Submission approved successfully. ${
            result.reward_amount ?? 0
          } ${
            result.reward_type === 'gold'
              ? 'Gold'
              : 'reward'
          } awarded.`
        )
      } else if (action === 'reject') {
        setMessage(
          'Submission rejected successfully.'
        )
      } else {
        setMessage(
          'Resubmission requested successfully.'
        )
      }

      setSelectedSubmission(null)
      setReviewNote('')

      await loadSubmissions()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to review submission.'
      )
    } finally {
      setReviewing(false)
    }
  }

  const filteredSubmissions =
    filter === 'all'
      ? submissions
      : submissions.filter(
          (submission) =>
            submission.status === filter
        )

  const pendingCount = submissions.filter(
    (submission) =>
      submission.status === 'pending'
  ).length

  const approvedCount = submissions.filter(
    (submission) =>
      submission.status === 'approved'
  ).length

  const rejectedCount = submissions.filter(
    (submission) =>
      submission.status === 'rejected'
  ).length

  const resubmitCount = submissions.filter(
    (submission) =>
      submission.status === 'resubmit'
  ).length

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070507] px-5 py-8 text-white sm:px-8">

      {/* ================================================= */}
      {/* BACKGROUND                                        */}
      {/* ================================================= */}

      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">

        <div className="absolute -left-40 -top-40 h-[550px] w-[550px] rounded-full bg-red-700/20 blur-[150px]" />

        <div className="absolute right-[-180px] top-[10%] h-[600px] w-[600px] rounded-full bg-red-600/15 blur-[170px]" />

        <div className="absolute bottom-[-250px] left-[25%] h-[600px] w-[600px] rounded-full bg-orange-600/10 blur-[170px]" />

        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,70,70,.7) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,70,70,.7) 1px, transparent 1px)
            `,
            backgroundSize: '44px 44px',
          }}
        />

      </div>

      <div className="relative z-10 mx-auto max-w-7xl">

        {/* ================================================= */}
        {/* HEADER                                            */}
        {/* ================================================= */}

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

          <div>

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
              Administrator
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Task Submissions
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Review player proof, approve rewards,
              reject submissions or request new proof.
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/admin/tasks"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold transition hover:border-red-500/30 hover:bg-red-500/5"
            >
              ← Task Manager
            </Link>

            <Link
              href="/admin"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold transition hover:border-red-500/30 hover:bg-red-500/5"
            >
              Admin Panel
            </Link>

          </div>

        </div>

        {/* ================================================= */}
        {/* MESSAGES                                         */}
        {/* ================================================= */}

        {error && (

          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">

            <p className="text-sm font-bold text-red-400">
              {error}
            </p>

          </div>

        )}

        {message && (

          <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-4">

            <p className="text-sm font-bold text-green-400">
              {message}
            </p>

          </div>

        )}

        {/* ================================================= */}
        {/* STATS                                             */}
        {/* ================================================= */}

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">

          <StatCard
            label="Total"
            value={submissions.length}
            icon="📋"
          />

          <StatCard
            label="Pending"
            value={pendingCount}
            icon="⏳"
          />

          <StatCard
            label="Approved"
            value={approvedCount}
            icon="✓"
          />

          <StatCard
            label="Rejected"
            value={rejectedCount}
            icon="✕"
          />

          <StatCard
            label="Resubmit"
            value={resubmitCount}
            icon="↻"
          />

        </div>

        {/* ================================================= */}
        {/* FILTERS                                           */}
        {/* ================================================= */}

        <div className="mt-8 flex flex-wrap gap-2">

          {[
            ['pending', `Pending (${pendingCount})`],
            ['resubmit', `Resubmit (${resubmitCount})`],
            ['approved', `Approved (${approvedCount})`],
            ['rejected', `Rejected (${rejectedCount})`],
            ['all', `All (${submissions.length})`],
          ].map(([value, label]) => (

            <button
              key={value}
              type="button"
              onClick={() =>
                setFilter(value)
              }
              className={
                filter === value
                  ? 'rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white'
                  : 'rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-gray-500 transition hover:border-red-500/30 hover:text-white'
              }
            >
              {label}
            </button>

          ))}

        </div>

        {/* ================================================= */}
        {/* SUBMISSIONS                                       */}
        {/* ================================================= */}

        <section className="mt-6">

          {loading ? (

            <div className="rounded-3xl border border-white/10 bg-[#0e0c10]/90 p-12 text-center">

              <p className="text-sm text-gray-500">
                Loading submissions...
              </p>

            </div>

          ) : filteredSubmissions.length === 0 ? (

            <div className="rounded-3xl border border-white/10 bg-[#0e0c10]/90 p-12 text-center">

              <div className="text-5xl">
                {filter === 'pending'
                  ? '🎉'
                  : '📋'}
              </div>

              <h2 className="mt-5 text-xl font-black">
                {filter === 'pending'
                  ? 'No pending submissions'
                  : 'No submissions found'}
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                {filter === 'pending'
                  ? 'You are all caught up.'
                  : 'There are no submissions in this category.'}
              </p>

            </div>

          ) : (

            <div className="space-y-5">

              {filteredSubmissions.map(
                (submission) => (

                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    onReview={() => {
                      setSelectedSubmission(
                        submission
                      )
                      setReviewNote('')
                      setError('')
                    }}
                  />

                )
              )}

            </div>

          )}

        </section>

      </div>

      {/* ================================================= */}
      {/* REVIEW MODAL                                      */}
      {/* ================================================= */}

      {selectedSubmission && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">

          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0e0c10] shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0e0c10] px-6 py-5">

              <div>

                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-red-500">
                  Review
                </p>

                <h2 className="mt-1 text-xl font-black">
                  Task Submission
                </h2>

              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedSubmission(null)
                  setReviewNote('')
                  setError('')
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-gray-500 transition hover:border-red-500/30 hover:text-white"
              >
                ✕
              </button>

            </div>

            <div className="space-y-6 p-6">

              {/* PLAYER */}

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">

                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                  Player
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">

                  <InfoItem
                    label="Display Name"
                    value={
                      selectedSubmission.profile
                        ?.display_name ??
                      'Unknown'
                    }
                  />

                  <InfoItem
                    label="In-Game Name"
                    value={
                      selectedSubmission.profile
                        ?.in_game_name ??
                      'Not provided'
                    }
                  />

                  <InfoItem
                    label="BloodStrike UID"
                    value={
                      selectedSubmission.profile
                        ?.bloodstrike_uid ??
                      'Unknown'
                    }
                  />

                  <InfoItem
                    label="Email"
                    value={
                      selectedSubmission.profile
                        ?.email ??
                      'Unknown'
                    }
                  />

                </div>

              </div>

              {/* TASK */}

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">

                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                  Task
                </p>

                <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                  <h3 className="text-lg font-black">
                    {selectedSubmission.task
                      ?.title ??
                      'Unknown Task'}
                  </h3>

                  <span className="w-fit rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs font-black text-yellow-400">
                    {formatReward(
                      selectedSubmission.task
                        ?.reward_type,
                      selectedSubmission.task
                        ?.reward_amount
                    )}
                  </span>

                </div>

              </div>

              {/* PROOF TEXT */}

              {selectedSubmission.proof_text && (

                <div>

                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                    Player Proof
                  </p>

                  <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-6 text-gray-300">
                    {selectedSubmission.proof_text}
                  </div>

                </div>

              )}

              {/* SCREENSHOT */}

              {selectedSubmission.proof_image_url && (

                <div>

                  <div className="flex items-center justify-between">

                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                      Screenshot / Image Proof
                    </p>

                    <a
                      href={
                        selectedSubmission.proof_image_url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-red-400 hover:text-red-300"
                    >
                      Open Full Size ↗
                    </a>

                  </div>

                  <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">

                    <img
                      src={
                        selectedSubmission.proof_image_url
                      }
                      alt="Player task proof"
                      className="max-h-[500px] w-full object-contain"
                    />

                  </div>

                </div>

              )}

              {/* SUBMISSION DATE */}

              <div className="flex items-center gap-2 text-xs text-gray-600">
                📅 Submitted{' '}
                {formatDate(
                  selectedSubmission.submitted_at
                )}
              </div>

              {/* ADMIN NOTE */}

              <div>

                <label className="text-xs font-bold text-gray-400">
                  Admin Note / Reason
                </label>

                <textarea
                  value={reviewNote}
                  onChange={(event) =>
                    setReviewNote(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="Add a reason for rejection/resubmission, or an optional note for approval..."
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
                />

              </div>

              {/* ACTIONS */}

              <div className="grid gap-3 sm:grid-cols-3">

                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() =>
                    reviewSubmission('reject')
                  }
                  className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-black text-red-400 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewing
                    ? 'Processing...'
                    : '✕ Reject'}
                </button>

                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() =>
                    reviewSubmission('resubmit')
                  }
                  className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-xs font-black text-orange-400 transition hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewing
                    ? 'Processing...'
                    : '↻ Request Resubmit'}
                </button>

                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() =>
                    reviewSubmission('approve')
                  }
                  className="rounded-xl bg-green-600 px-4 py-3 text-xs font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewing
                    ? 'Processing...'
                    : '✓ Approve & Reward'}
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </main>
  )
}

/* ========================================================= */
/* SUBMISSION CARD                                            */
/* ========================================================= */

function SubmissionCard({
  submission,
  onReview,
}: {
  submission: SubmissionView
  onReview: () => void
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0e0c10]/90 p-5 transition hover:border-red-500/20">

      <div className="flex flex-col justify-between gap-5 lg:flex-row">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            <StatusBadge
              status={submission.status}
            />

            <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 text-[9px] font-black text-yellow-400">
              {formatReward(
                submission.task?.reward_type,
                submission.task?.reward_amount
              )}
            </span>

            {submission.proof_image_url && (
              <span className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[9px] font-black text-blue-400">
                📸 SCREENSHOT
              </span>
            )}

            {submission.proof_text && (
              <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-black text-gray-500">
                📝 TEXT
              </span>
            )}

          </div>

          <h2 className="mt-3 text-lg font-black">
            {submission.task?.title ??
              'Unknown Task'}
          </h2>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">

            <span>
              👤{' '}
              {submission.profile
                ?.display_name ??
                'Unknown Player'}
            </span>

            <span>
              🎮 UID:{' '}
              {submission.profile
                ?.bloodstrike_uid ??
                'Unknown'}
            </span>

            <span>
              📅{' '}
              {formatDate(
                submission.submitted_at
              )}
            </span>

          </div>

          {submission.proof_text && (

            <p className="mt-4 line-clamp-2 text-sm leading-6 text-gray-500">
              {submission.proof_text}
            </p>

          )}

        </div>

        <div className="flex shrink-0 items-center">

          <button
            type="button"
            onClick={onReview}
            className="w-full rounded-xl bg-red-600 px-6 py-3 text-xs font-black transition hover:bg-red-500 lg:w-auto"
          >
            Review Submission
          </button>

        </div>

      </div>

    </div>
  )
}

/* ========================================================= */
/* STAT CARD                                                   */
/* ========================================================= */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0e0c10]/90 p-5">

      <div className="flex items-center justify-between">

        <span className="text-xl">
          {icon}
        </span>

        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-700">
          STRIKEHUB
        </span>

      </div>

      <p className="mt-5 text-xs text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-black">
        {value.toLocaleString()}
      </p>

    </div>
  )
}

/* ========================================================= */
/* INFO ITEM                                                    */
/* ========================================================= */

function InfoItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>

      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-700">
        {label}
      </p>

      <p className="mt-1 break-all text-sm font-bold text-gray-300">
        {value}
      </p>

    </div>
  )
}

/* ========================================================= */
/* STATUS                                                       */
/* ========================================================= */

function StatusBadge({
  status,
}: {
  status: string
}) {
  const styles: Record<
    string,
    string
  > = {
    pending:
      'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    approved:
      'border-green-500/20 bg-green-500/5 text-green-400',
    rejected:
      'border-red-500/20 bg-red-500/5 text-red-400',
    resubmit:
      'border-orange-500/20 bg-orange-500/5 text-orange-400',
  }

  const labels: Record<
    string,
    string
  > = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    resubmit: 'RESUBMIT',
  }

  return (
    <span
      className={`rounded-lg border px-2 py-1 text-[9px] font-black ${
        styles[status] ??
        'border-white/10 bg-white/[0.03] text-gray-500'
      }`}
    >
      {labels[status] ??
        status.toUpperCase()}
    </span>
  )
}

/* ========================================================= */
/* REWARD                                                       */
/* ========================================================= */

function formatReward(
  type?: string,
  amount?: number
) {
  if (type === 'gold') {
    return `${Number(
      amount ?? 0
    ).toLocaleString()} Gold`
  }

  if (type === 'points') {
    return `${Number(
      amount ?? 0
    ).toLocaleString()} Points`
  }

  if (type === 'badge') {
    return 'Badge'
  }

  if (type === 'cosmetic') {
    return 'Cosmetic'
  }

  return 'Reward'
}

/* ========================================================= */
/* DATE                                                         */
/* ========================================================= */

function formatDate(
  value: string
) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return date.toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}