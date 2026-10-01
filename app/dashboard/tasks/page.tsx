'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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

type TaskState = {
  task: Task
  submission: Submission | null
}

function formatReward(type: string, amount: number) {
  if (type === 'gold') return `${amount} Gold`
  if (type === 'points') return `${amount} Points`
  if (type === 'badge') return 'Badge'
  if (type === 'cosmetic') return 'Cosmetic'
  return `${amount} Reward`
}

function formatProof(type: string) {
  switch (type) {
    case 'image':
      return '📸 Screenshot'
    case 'text':
      return '📝 Text Proof'
    case 'text_and_image':
      return '📸📝 Text + Screenshot'
    default:
      return 'No Proof'
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function isTaskAvailable(task: Task) {
  const now = Date.now()

  if (!task.is_active) return false

  if (
    task.starts_at &&
    new Date(task.starts_at).getTime() > now
  ) {
    return false
  }

  if (
    task.expires_at &&
    new Date(task.expires_at).getTime() < now
  ) {
    return false
  }

  return true
}

function getTaskStatus(task: Task) {
  const now = Date.now()

  if (!task.is_active) {
    return 'inactive'
  }

  if (
    task.starts_at &&
    new Date(task.starts_at).getTime() > now
  ) {
    return 'upcoming'
  }

  if (
    task.expires_at &&
    new Date(task.expires_at).getTime() < now
  ) {
    return 'expired'
  }

  return 'available'
}

export default function DashboardTasksPage() {
  const supabase = useMemo(() => createClient(), [])
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const [tasks, setTasks] = useState<TaskState[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedSubmission, setSelectedSubmission] =
    useState<Submission | null>(null)

  const [proofText, setProofText] = useState('')
  const [proofImage, setProofImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')

  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadTasks() {
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

      const { data: taskData, error: taskError } =
        await supabase
          .from('tasks')
          .select(
            'id,title,description,reward_type,reward_amount,instructions,proof_required,proof_type,task_url,starts_at,expires_at,is_active,created_at'
          )
          .order('created_at', {
            ascending: false,
          })

      if (taskError) {
        throw new Error(taskError.message)
      }

      const { data: submissionData, error: submissionError } =
        await supabase
          .from('task_submissions')
          .select(
            'id,task_id,user_id,proof_text,proof_image_url,status,admin_note,submitted_at,reviewed_at,reviewed_by'
          )
          .eq('user_id', user.id)
          .order('submitted_at', {
            ascending: false,
          })

      if (submissionError) {
        throw new Error(submissionError.message)
      }

      const submissionMap = new Map<string, Submission>()

      for (const submission of (submissionData || []) as Submission[]) {
        if (!submissionMap.has(submission.task_id)) {
          submissionMap.set(
            submission.task_id,
            submission
          )
        }
      }

      const combined = ((taskData || []) as Task[]).map(
        (task) => ({
          task,
          submission:
            submissionMap.get(task.id) || null,
        })
      )

      setTasks(combined)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load tasks.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [])

  function resetSubmissionForm() {
    setProofText('')
    setProofImage(null)

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImagePreview('')

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  function openTask(task: Task, submission: Submission | null) {
    setError('')
    setMessage('')

    setSelectedTask(task)
    setSelectedSubmission(submission)

    setProofText(submission?.proof_text || '')
    setProofImage(null)

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImagePreview(submission?.proof_image_url || '')

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  function closeTask() {
    if (submitting) return

    setSelectedTask(null)
    setSelectedSubmission(null)
    resetSubmissionForm()
  }

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError(
        'Screenshot must be PNG, JPG/JPEG, or WEBP.'
      )

      event.target.value = ''
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setError(
        'Screenshot must be 8 MB or smaller.'
      )

      event.target.value = ''
      return
    }

    setError('')

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    const preview = URL.createObjectURL(file)

    setProofImage(file)
    setImagePreview(preview)
  }

  function proofNeedsText(task: Task) {
    return (
      task.proof_type === 'text' ||
      task.proof_type === 'text_and_image'
    )
  }

  function proofNeedsImage(task: Task) {
    return (
      task.proof_type === 'image' ||
      task.proof_type === 'text_and_image'
    )
  }

  async function uploadProofImage(
    userId: string,
    taskId: string
  ) {
    if (!proofImage) {
      return null
    }

    const extension =
      proofImage.type === 'image/png'
        ? 'png'
        : proofImage.type === 'image/webp'
          ? 'webp'
          : 'jpg'

    const filePath =
      `${userId}/task-proofs/${taskId}/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } =
      await supabase.storage
        .from('community-media')
        .upload(filePath, proofImage, {
          cacheControl: '3600',
          upsert: false,
          contentType: proofImage.type,
        })

    if (uploadError) {
      throw new Error(
        `Screenshot upload failed: ${uploadError.message}`
      )
    }

    const { data } =
      supabase.storage
        .from('community-media')
        .getPublicUrl(filePath)

    return data.publicUrl
  }

  async function submitTask(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (!selectedTask) {
      return
    }

    setError('')
    setMessage('')

    const taskStatus = getTaskStatus(selectedTask)

    if (taskStatus !== 'available') {
      setError(
        taskStatus === 'upcoming'
          ? 'This task has not started yet.'
          : taskStatus === 'expired'
            ? 'This task has expired.'
            : 'This task is currently unavailable.'
      )
      return
    }

    if (
      selectedSubmission &&
      selectedSubmission.status !== 'resubmit'
    ) {
      setError(
        selectedSubmission.status === 'pending'
          ? 'You already have a pending submission for this task.'
          : selectedSubmission.status === 'approved'
            ? 'This task has already been approved.'
            : 'You cannot submit this task again.'
      )
      return
    }

    if (
      proofNeedsText(selectedTask) &&
      !proofText.trim()
    ) {
      setError(
        'Please provide the required text proof.'
      )
      return
    }

    if (
      proofNeedsImage(selectedTask) &&
      !proofImage &&
      !selectedSubmission?.proof_image_url
    ) {
      setError(
        'Please upload the required screenshot.'
      )
      return
    }

    setSubmitting(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(
          'Your session has expired. Please log in again.'
        )
      }

      let proofImageUrl =
        selectedSubmission?.proof_image_url || null

      if (proofImage) {
        proofImageUrl = await uploadProofImage(
          user.id,
          selectedTask.id
        )
      }

      const payload = {
        task_id: selectedTask.id,
        user_id: user.id,
        proof_text:
          proofNeedsText(selectedTask)
            ? proofText.trim()
            : null,
        proof_image_url:
          proofNeedsImage(selectedTask)
            ? proofImageUrl
            : null,
        status: 'pending',
        admin_note: null,
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      }

      let submissionError: string | null = null

      if (selectedSubmission) {
        const { error: updateError } =
          await supabase
            .from('task_submissions')
            .update(payload)
            .eq('id', selectedSubmission.id)
            .eq('user_id', user.id)

        submissionError =
          updateError?.message || null
      } else {
        const { error: insertError } =
          await supabase
            .from('task_submissions')
            .insert(payload)

        submissionError =
          insertError?.message || null
      }

      if (submissionError) {
        throw new Error(submissionError)
      }

      setMessage(
        selectedSubmission
          ? 'Your task proof was resubmitted successfully.'
          : 'Your task was submitted successfully.'
      )

      closeTask()

      await loadTasks()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit this task.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const availableCount = tasks.filter(
    ({ task }) => isTaskAvailable(task)
  ).length

  const pendingCount = tasks.filter(
    ({ submission }) =>
      submission?.status === 'pending'
  ).length

  const completedCount = tasks.filter(
    ({ submission }) =>
      submission?.status === 'approved'
  ).length

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070507] px-5 py-8 text-white sm:px-8">
      {/* BACKGROUND */}
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
        {/* HEADER */}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Link
              href="/dashboard"
              className="text-xs font-bold text-gray-500 transition hover:text-white"
            >
              ← Back to Dashboard
            </Link>

            <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
              Earn More
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Tasks
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Complete tasks, submit your proof and earn rewards.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
            <StatCard
              label="Available"
              value={availableCount}
            />

            <StatCard
              label="Pending"
              value={pendingCount}
            />

            <StatCard
              label="Completed"
              value={completedCount}
            />
          </div>
        </div>

        {/* MESSAGES */}
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

        {/* TASK LIST */}
        <section className="mt-8">
          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-[#0e0c10]/90 p-12 text-center">
              <p className="text-sm text-gray-500">
                Loading tasks...
              </p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#0e0c10]/90 p-12 text-center">
              <div className="text-5xl">🎯</div>

              <h2 className="mt-5 text-xl font-black">
                No tasks available
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                Check back later for new ways to earn.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {tasks.map(
                ({ task, submission }) => {
                  const status =
                    getTaskStatus(task)

                  return (
                    <div
                      key={task.id}
                      className="rounded-3xl border border-white/10 bg-[#0e0c10]/90 p-5 transition hover:border-red-500/20"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={
                            submission?.status ||
                            status
                          }
                        />

                        <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 text-[9px] font-black text-yellow-400">
                          {formatReward(
                            task.reward_type,
                            task.reward_amount
                          )}
                        </span>

                        <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-black text-gray-500">
                          {formatProof(
                            task.proof_type
                          )}
                        </span>
                      </div>

                      <h2 className="mt-4 text-xl font-black">
                        {task.title}
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        {task.description}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-gray-600">
                        {task.starts_at && (
                          <span>
                            Starts: {formatDate(task.starts_at)}
                          </span>
                        )}

                        {task.expires_at && (
                          <span>
                            Expires: {formatDate(task.expires_at)}
                          </span>
                        )}
                      </div>

                      {task.task_url && (
                        <a
                          href={task.task_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-5 inline-flex rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-2.5 text-xs font-black text-blue-400 transition hover:bg-blue-500/10"
                        >
                          🔗 Open Task Link
                        </a>
                      )}

                      {submission?.admin_note && (
                        <div className="mt-5 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                          <p className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                            Admin Note
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-gray-400">
                            {submission.admin_note}
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={
                          status === 'inactive' ||
                          status === 'upcoming' ||
                          status === 'expired' ||
                          submission?.status === 'pending' ||
                          submission?.status === 'approved'
                        }
                        onClick={() =>
                          openTask(
                            task,
                            submission
                          )
                        }
                        className="mt-5 w-full rounded-xl bg-red-600 px-5 py-3 text-xs font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-gray-600"
                      >
                        {submission?.status === 'pending'
                          ? 'Submission Pending'
                          : submission?.status === 'approved'
                            ? '✓ Completed'
                            : submission?.status === 'resubmit'
                              ? '↻ Resubmit Proof'
                              : status === 'upcoming'
                                ? 'Not Started'
                                : status === 'expired'
                                  ? 'Expired'
                                  : status === 'inactive'
                                    ? 'Unavailable'
                                    : 'Complete Task'}
                      </button>
                    </div>
                  )
                }
              )}
            </div>
          )}
        </section>
      </div>

      {/* TASK MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-3xl border border-white/10 bg-[#0d0b0f] p-5 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-500">
                    Task
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    {selectedTask.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={closeTask}
                  disabled={submitting}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm font-black text-gray-400 hover:text-white disabled:opacity-40"
                >
                  ✕
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs font-black text-yellow-400">
                  {formatReward(
                    selectedTask.reward_type,
                    selectedTask.reward_amount
                  )}
                </span>

                <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-black text-gray-400">
                  {formatProof(
                    selectedTask.proof_type
                  )}
                </span>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                  Description
                </p>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-400">
                  {selectedTask.description}
                </p>
              </div>

              {selectedTask.instructions && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
                    Instructions
                  </p>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-400">
                    {selectedTask.instructions}
                  </p>
                </div>
              )}

              {selectedTask.task_url && (
                <a
                  href={selectedTask.task_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/5 px-5 py-3 text-xs font-black text-blue-400 transition hover:bg-blue-500/10"
                >
                  🔗 Open Task Link
                </a>
              )}

              <form
                onSubmit={submitTask}
                className="mt-6 space-y-5"
              >
                {proofNeedsText(selectedTask) && (
                  <div>
                    <label className="text-xs font-bold text-gray-400">
                      Your Proof
                    </label>

                    <textarea
                      value={proofText}
                      onChange={(event) =>
                        setProofText(
                          event.target.value
                        )
                      }
                      rows={6}
                      placeholder="Explain or provide proof that you completed the task..."
                      className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-gray-700 focus:border-red-500/40"
                    />
                  </div>
                )}

                {proofNeedsImage(selectedTask) && (
                  <div>
                    <label className="text-xs font-bold text-gray-400">
                      Screenshot Proof
                    </label>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageChange}
                      className="mt-2 block w-full cursor-pointer rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-xs text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:text-xs file:font-black file:text-white"
                    />

                    {imagePreview && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <img
                          src={imagePreview}
                          alt="Proof preview"
                          className="max-h-[400px] w-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedSubmission?.status === 'resubmit' && (
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
                    <p className="text-xs font-black text-orange-400">
                      The admin requested new proof.
                    </p>

                    {selectedSubmission.admin_note && (
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-gray-400">
                        {selectedSubmission.admin_note}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-red-600 px-5 py-4 text-sm font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'Submitting...'
                    : selectedSubmission?.status === 'resubmit'
                      ? '↻ Resubmit Proof'
                      : '✓ Submit Task'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0e0c10]/90 p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: string
}) {
  const config: Record<
    string,
    { label: string; className: string }
  > = {
    pending: {
      label: 'PENDING',
      className:
        'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    },

    approved: {
      label: 'APPROVED',
      className:
        'border-green-500/20 bg-green-500/5 text-green-400',
    },

    rejected: {
      label: 'REJECTED',
      className:
        'border-red-500/20 bg-red-500/5 text-red-400',
    },

    resubmit: {
      label: 'RESUBMIT',
      className:
        'border-orange-500/20 bg-orange-500/5 text-orange-400',
    },

    available: {
      label: 'AVAILABLE',
      className:
        'border-green-500/20 bg-green-500/5 text-green-400',
    },

    upcoming: {
      label: 'UPCOMING',
      className:
        'border-blue-500/20 bg-blue-500/5 text-blue-400',
    },

    expired: {
      label: 'EXPIRED',
      className:
        'border-red-500/20 bg-red-500/5 text-red-400',
    },

    inactive: {
      label: 'INACTIVE',
      className:
        'border-white/10 bg-white/[0.03] text-gray-600',
    },
  }

  const item =
    config[status] || config.available

  return (
    <span
      className={`rounded-lg border px-2 py-1 text-[9px] font-black ${item.className}`}
    >
      {item.label}
    </span>
  )
}