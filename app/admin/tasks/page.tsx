'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Task = {
  id: string
  title: string
  description: string
  reward_type: string
  reward_amount: number
  instructions: string | null
  proof_required: boolean
  proof_type: string
  task_url: string | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export default function AdminTasksPage() {
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [taskUrl, setTaskUrl] = useState('')
  const [rewardType, setRewardType] = useState('gold')
  const [rewardAmount, setRewardAmount] = useState('10')
  const [proofType, setProofType] = useState('image')
  const [startsAt, setStartsAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function loadTasks() {
    setLoadingTasks(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const {
      data: adminCheck,
      error: adminError,
    } = await supabase.rpc('is_admin')

    if (adminError || !adminCheck) {
      window.location.href = '/dashboard'
      return
    }

    const {
      data,
      error: taskError,
    } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (taskError) {
      setError(taskError.message)
    } else {
      setTasks((data as Task[]) ?? [])
    }

    setLoadingTasks(false)
  }

  useEffect(() => {
    loadTasks()
  }, [])

  async function createTask(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!title.trim()) {
      setError('Task title is required.')
      return
    }

    if (!description.trim()) {
      setError('Task description is required.')
      return
    }

    const amount = Number(rewardAmount)

    if (
      rewardType === 'gold' ||
      rewardType === 'points'
    ) {
      if (
        !Number.isInteger(amount) ||
        amount <= 0
      ) {
        setError(
          'Reward amount must be a whole number greater than 0.'
        )
        return
      }
    }

    if (taskUrl.trim()) {
      try {
        const url = new URL(taskUrl.trim())

        if (
          url.protocol !== 'http:' &&
          url.protocol !== 'https:'
        ) {
          throw new Error()
        }
      } catch {
        setError(
          'Task link must be a valid HTTP or HTTPS URL.'
        )
        return
      }
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(
          'Your session has expired. Please log in again.'
        )
      }

      const {
        data: adminCheck,
        error: adminError,
      } = await supabase.rpc('is_admin')

      if (adminError || !adminCheck) {
        throw new Error(
          'Administrator access is required.'
        )
      }

      const {
        error: insertError,
      } = await supabase
        .from('tasks')
        .insert({
          title: title.trim(),
          description: description.trim(),
          instructions:
            instructions.trim() || null,
          task_url:
            taskUrl.trim() || null,
          reward_type: rewardType,
          reward_amount:
            rewardType === 'badge' ||
            rewardType === 'cosmetic'
              ? 0
              : amount,
          proof_required:
            proofType !== 'none',
          proof_type: proofType,
          starts_at:
            startsAt
              ? new Date(startsAt).toISOString()
              : null,
          expires_at:
            expiresAt
              ? new Date(expiresAt).toISOString()
              : null,
          is_active: isActive,
          created_by: user.id,
        })

      if (insertError) {
        throw new Error(
          insertError.message
        )
      }

      setMessage(
        'Task created successfully.'
      )

      setTitle('')
      setDescription('')
      setInstructions('')
      setTaskUrl('')
      setRewardType('gold')
      setRewardAmount('10')
      setProofType('image')
      setStartsAt('')
      setExpiresAt('')
      setIsActive(true)

      await loadTasks()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create task.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(
    task: Task
  ) {
    setError('')
    setMessage('')

    const {
      error: updateError,
    } = await supabase
      .from('tasks')
      .update({
        is_active: !task.is_active,
      })
      .eq('id', task.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(
      task.is_active
        ? 'Task deactivated.'
        : 'Task activated.'
    )

    await loadTasks()
  }

  async function deleteTask(
    task: Task
  ) {
    const confirmed =
      window.confirm(
        `Delete "${task.title}"?\n\nThis cannot be undone.`
      )

    if (!confirmed) {
      return
    }

    setError('')
    setMessage('')

    const {
      error: deleteError,
    } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setMessage(
      'Task deleted successfully.'
    )

    await loadTasks()
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070507] px-5 py-8 text-white sm:px-8">

      {/* ================================================= */}
      {/* ATMOSPHERIC BACKGROUND                            */}
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
              Task Manager
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Create earning tasks for STRIKEHUB players,
              control rewards and decide what proof they must submit.
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/admin"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold transition hover:border-red-500/30 hover:bg-red-500/5"
            >
              ← Admin Panel
            </Link>

            <Link
              href="/admin/tasks/submissions"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
            >
              📋 View Submissions
            </Link>

            <Link
              href="/dashboard/tasks"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold transition hover:border-red-500/30 hover:bg-red-500/5"
            >
              View User Tasks
            </Link>

          </div>

        </div>

        {/* ================================================= */}
        {/* NOTIFICATIONS                                     */}
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
        {/* CREATE TASK                                       */}
        {/* ================================================= */}

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#0e0c10]/90 p-6 shadow-2xl sm:p-8">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-red-500">
                Create
              </p>

              <h2 className="mt-1 text-2xl font-black">
                New Task
              </h2>

            </div>

            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-2">

              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">
                Player Reward
              </p>

              <p className="mt-1 text-sm font-black text-yellow-400">
                Gold / Points
              </p>

            </div>

          </div>

          <form
            onSubmit={createTask}
            className="mt-8 space-y-6"
          >

            {/* TITLE */}

            <div>

              <label className="text-xs font-bold text-gray-400">
                Task Title
              </label>

              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Example: Follow STRIKEHUB on TikTok"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
              />

            </div>

            {/* DESCRIPTION */}

            <div>

              <label className="text-xs font-bold text-gray-400">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Explain what the player needs to do."
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
              />

            </div>

            {/* INSTRUCTIONS */}

            <div>

              <label className="text-xs font-bold text-gray-400">
                Instructions
              </label>

              <textarea
                value={instructions}
                onChange={(event) =>
                  setInstructions(event.target.value)
                }
                placeholder="Give detailed instructions for completing the task."
                rows={5}
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
              />

            </div>

            {/* TASK LINK */}

            <div>

              <label className="text-xs font-bold text-gray-400">
                Task Link
                <span className="ml-2 text-[10px] font-normal text-gray-600">
                  Optional
                </span>
              </label>

              <div className="relative mt-2">

                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600">
                  🔗
                </span>

                <input
                  type="url"
                  value={taskUrl}
                  onChange={(event) =>
                    setTaskUrl(event.target.value)
                  }
                  placeholder="https://example.com/download"
                  className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
                />

              </div>

              <p className="mt-2 text-[11px] text-gray-600">
                Add a website, app download page, social media page,
                Discord invite, or any other destination players need.
              </p>

            </div>

            {/* REWARD + PROOF */}

            <div className="grid gap-5 md:grid-cols-2">

              <div>

                <label className="text-xs font-bold text-gray-400">
                  Reward Type
                </label>

                <select
                  value={rewardType}
                  onChange={(event) =>
                    setRewardType(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#111015] px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500/40"
                >

                  <option value="gold">
                    🪙 Gold
                  </option>

                  <option value="points">
                    ⭐ Points
                  </option>

                  <option value="badge">
                    🏅 Badge
                  </option>

                  <option value="cosmetic">
                    ✨ Cosmetic
                  </option>

                </select>

              </div>

              <div>

                <label className="text-xs font-bold text-gray-400">
                  Reward Amount
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={rewardAmount}
                  disabled={
                    rewardType === 'badge' ||
                    rewardType === 'cosmetic'
                  }
                  onChange={(event) =>
                    setRewardAmount(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-30 focus:border-red-500/40"
                />

                {(rewardType === 'badge' ||
                  rewardType === 'cosmetic') && (
                  <p className="mt-2 text-[11px] text-gray-600">
                    This reward type does not use a numeric amount.
                  </p>
                )}

              </div>

            </div>

            {/* PROOF TYPE */}

            <div>

              <label className="text-xs font-bold text-gray-400">
                Proof Required
              </label>

              <select
                value={proofType}
                onChange={(event) =>
                  setProofType(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#111015] px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500/40"
              >

                <option value="none">
                  No Proof
                </option>

                <option value="text">
                  📝 Text Proof
                </option>

                <option value="image">
                  📸 Screenshot / Image
                </option>

                <option value="text_and_image">
                  📸📝 Text + Screenshot
                </option>

              </select>

              <p className="mt-2 text-[11px] text-gray-600">
                Choose what players must submit before the task can be reviewed.
              </p>

            </div>

            {/* DATES */}

            <div className="grid gap-5 md:grid-cols-2">

              <div>

                <label className="text-xs font-bold text-gray-400">
                  Start Date & Time
                </label>

                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) =>
                    setStartsAt(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-red-500/40"
                />

                <p className="mt-2 text-[11px] text-gray-600">
                  Leave empty to start immediately.
                </p>

              </div>

              <div>

                <label className="text-xs font-bold text-gray-400">
                  Expiry Date & Time
                </label>

                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) =>
                    setExpiresAt(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-red-500/40"
                />

                <p className="mt-2 text-[11px] text-gray-600">
                  Leave empty for no expiry.
                </p>

              </div>

            </div>

            {/* ACTIVE */}

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">

              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) =>
                  setIsActive(event.target.checked)
                }
                className="h-4 w-4 accent-red-600"
              />

              <div>

                <p className="text-sm font-bold">
                  Make task active immediately
                </p>

                <p className="mt-1 text-[11px] text-gray-600">
                  Players can see the task when its start time is reached.
                </p>

              </div>

            </label>

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-red-600 px-6 py-4 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? 'Creating Task...'
                : 'Create Task'}
            </button>

          </form>

        </section>

        {/* ================================================= */}
        {/* EXISTING TASKS                                    */}
        {/* ================================================= */}

        <section className="mt-8">

          <div className="flex items-end justify-between">

            <div>

              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-600">
                Manage
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Existing Tasks
              </h2>

            </div>

            <p className="text-xs text-gray-600">
              {tasks.length} task
              {tasks.length === 1 ? '' : 's'}
            </p>

          </div>

          <div className="mt-5 space-y-4">

            {loadingTasks ? (

              <div className="rounded-2xl border border-white/10 bg-[#0e0c10]/90 p-8 text-center">

                <p className="text-sm text-gray-500">
                  Loading tasks...
                </p>

              </div>

            ) : tasks.length === 0 ? (

              <div className="rounded-2xl border border-white/10 bg-[#0e0c10]/90 p-10 text-center">

                <div className="text-4xl">
                  🎯
                </div>

                <h3 className="mt-4 font-black">
                  No tasks yet
                </h3>

                <p className="mt-2 text-sm text-gray-600">
                  Create your first task above.
                </p>

              </div>

            ) : (

              tasks.map((task) => (

                <div
                  key={task.id}
                  className="rounded-2xl border border-white/10 bg-[#0e0c10]/90 p-5"
                >

                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <h3 className="font-black">
                          {task.title}
                        </h3>

                        <StatusBadge
                          active={task.is_active}
                        />

                        <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 text-[9px] font-bold text-yellow-400">
                          {formatReward(
                            task.reward_type,
                            task.reward_amount
                          )}
                        </span>

                        <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-bold text-gray-500">
                          {formatProof(
                            task.proof_type
                          )}
                        </span>

                        {task.task_url && (
                          <span className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[9px] font-bold text-blue-400">
                            🔗 LINK
                          </span>
                        )}

                      </div>

                      <p className="mt-2 text-sm leading-5 text-gray-500">
                        {task.description}
                      </p>

                      {task.task_url && (
                        <a
                          href={task.task_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[10px] font-bold text-blue-400 transition hover:bg-blue-500/10"
                        >
                          🔗 Open Task Link
                        </a>
                      )}

                      <p className="mt-3 text-[10px] text-gray-700">
                        Created {formatDate(task.created_at)}
                      </p>

                    </div>

                    <div className="flex shrink-0 gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          toggleTask(task)
                        }
                        className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-gray-300 transition hover:border-red-500/30 hover:bg-red-500/5"
                      >
                        {task.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteTask(task)
                        }
                        className="rounded-xl border border-red-500/20 px-4 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500/10"
                      >
                        Delete
                      </button>

                    </div>

                  </div>

                </div>

              ))

            )}

          </div>

        </section>

      </div>

    </main>
  )
}

/* ========================================================= */
/* STATUS                                                     */
/* ========================================================= */

function StatusBadge({
  active,
}: {
  active: boolean
}) {
  return (
    <span
      className={
        active
          ? 'rounded-lg border border-green-500/20 bg-green-500/5 px-2 py-1 text-[9px] font-bold text-green-400'
          : 'rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-bold text-gray-600'
      }
    >
      {active ? 'ACTIVE' : 'INACTIVE'}
    </span>
  )
}

/* ========================================================= */
/* PROOF                                                       */
/* ========================================================= */

function formatProof(
  type: string
) {
  if (type === 'none') {
    return 'No Proof'
  }

  if (type === 'text') {
    return 'Text Proof'
  }

  if (type === 'image') {
    return 'Screenshot'
  }

  if (type === 'text_and_image') {
    return 'Text + Screenshot'
  }

  return type
}

/* ========================================================= */
/* REWARD                                                      */
/* ========================================================= */

function formatReward(
  type: string,
  amount: number
) {
  if (type === 'gold') {
    return `${Number(amount || 0).toLocaleString()} Gold`
  }

  if (type === 'points') {
    return `${Number(amount || 0).toLocaleString()} Points`
  }

  if (type === 'badge') {
    return 'Badge'
  }

  if (type === 'cosmetic') {
    return 'Cosmetic'
  }

  return `${Number(amount || 0).toLocaleString()}`
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