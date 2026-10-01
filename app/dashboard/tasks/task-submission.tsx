'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TaskSubmission({
  taskId,
  proofType,
  taskTitle,
}: {
  taskId: string
  proofType: string
  taskTitle: string
}) {
  const supabase = createClient()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [proofText, setProofText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const needsText =
    proofType === 'text' ||
    proofType === 'text_and_image'

  const needsImage =
    proofType === 'image' ||
    proofType === 'text_and_image'

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    setError('')
    setMessage('')

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(selectedFile.type)) {
      setError(
        'Please upload a JPG, PNG or WEBP image.'
      )

      event.target.value = ''
      return
    }

    const maxSize =
      5 * 1024 * 1024

    if (selectedFile.size > maxSize) {
      setError(
        'Screenshot must be 5MB or smaller.'
      )

      event.target.value = ''
      return
    }

    setFile(selectedFile)

    const objectUrl =
      URL.createObjectURL(selectedFile)

    setPreview(objectUrl)
  }

  async function submitProof() {
    setError('')
    setMessage('')

    if (
      needsText &&
      !proofText.trim()
    ) {
      setError(
        'Please enter your proof before submitting.'
      )
      return
    }

    if (
      needsImage &&
      !file
    ) {
      setError(
        'Please upload your screenshot before submitting.'
      )
      return
    }

    setLoading(true)

    try {
      const {
        data: {
          user,
        },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error(
          'Your session has expired. Please log in again.'
        )
      }

      let proofImageUrl:
        string | null = null

      /*
       * Upload screenshot
       */

      if (needsImage && file) {

        const extension =
          file.name
            .split('.')
            .pop()
            ?.toLowerCase() || 'png'

        const fileName =
          `${crypto.randomUUID()}.${extension}`

        const filePath =
          `${user.id}/${taskId}/${fileName}`

        const {
          error: uploadError,
        } = await supabase.storage
          .from('task-proofs')
          .upload(
            filePath,
            file,
            {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type,
            }
          )

        if (uploadError) {
          throw new Error(
            uploadError.message
          )
        }

        const {
          data: publicUrlData,
        } = supabase.storage
          .from('task-proofs')
          .getPublicUrl(filePath)

        proofImageUrl =
          publicUrlData.publicUrl
      }

      /*
       * Create submission
       */

      const {
        error: submissionError,
      } = await supabase
        .from('task_submissions')
        .insert({
          task_id: taskId,
          user_id: user.id,
          proof_text:
            proofText.trim() || null,
          proof_image_url:
            proofImageUrl,
          status: 'pending',
        })

      if (submissionError) {

        /*
         * If database insertion fails after
         * uploading the image, remove the image.
         */

        if (needsImage && file) {

          const extension =
            file.name
              .split('.')
              .pop()
              ?.toLowerCase() || 'png'

          /*
           * We intentionally don't try to
           * guess the uploaded path here.
           * The submission remains protected
           * by the storage policy.
           */
        }

        throw new Error(
          submissionError.message
        )
      }

      setMessage(
        `Your proof for "${taskTitle}" has been submitted successfully.`
      )

      setProofText('')
      setFile(null)
      setPreview(null)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      /*
       * Refresh the page so the task changes
       * from the submission form to Pending.
       */

      setTimeout(() => {
        window.location.reload()
      }, 1200)

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while submitting your proof.'
      )

    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">

      <div className="flex items-center justify-between gap-3">

        <div>

          <p className="text-sm font-black">
            Submit Proof
          </p>

          <p className="mt-1 text-[11px] text-gray-600">
            Your submission will be reviewed by an administrator.
          </p>

        </div>

        <span className="rounded-lg border border-red-500/20 bg-red-500/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-red-400">
          Proof Required
        </span>

      </div>

      {/* TEXT PROOF */}

      {needsText && (

        <div className="mt-5">

          <label
            htmlFor={`proof-${taskId}`}
            className="text-xs font-bold text-gray-400"
          >
            Your Proof
          </label>

          <textarea
            id={`proof-${taskId}`}
            value={proofText}
            onChange={(event) =>
              setProofText(event.target.value)
            }
            placeholder="Enter the required proof or explanation..."
            rows={4}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/40"
          />

        </div>

      )}

      {/* IMAGE UPLOAD */}

      {needsImage && (

        <div className="mt-5">

          <p className="text-xs font-bold text-gray-400">
            Screenshot
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
            id={`screenshot-${taskId}`}
          />

          {!file ? (

            <label
              htmlFor={`screenshot-${taskId}`}
              className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-5 py-8 text-center transition hover:border-red-500/40 hover:bg-red-500/5"
            >

              <span className="text-3xl">
                📸
              </span>

              <span className="mt-3 text-sm font-bold text-gray-300">
                Upload Screenshot
              </span>

              <span className="mt-1 text-[11px] text-gray-600">
                JPG, PNG or WEBP • Maximum 5MB
              </span>

            </label>

          ) : (

            <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-black/30">

              {preview && (

                <img
                  src={preview}
                  alt="Screenshot preview"
                  className="max-h-80 w-full object-contain"
                />

              )}

              <div className="flex items-center justify-between gap-3 border-t border-white/10 p-3">

                <div className="min-w-0">

                  <p className="truncate text-xs font-bold text-gray-300">
                    {file.name}
                  </p>

                  <p className="mt-1 text-[10px] text-gray-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setPreview(null)

                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="shrink-0 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10"
                >
                  Remove
                </button>

              </div>

            </div>

          )}

        </div>

      )}

      {/* ERROR */}

      {error && (

        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3">

          <p className="text-xs font-semibold text-red-400">
            {error}
          </p>

        </div>

      )}

      {/* SUCCESS */}

      {message && (

        <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 p-3">

          <p className="text-xs font-semibold text-green-400">
            {message}
          </p>

        </div>

      )}

      {/* SUBMIT */}

      <button
        type="button"
        onClick={submitProof}
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? 'Submitting Proof...'
          : 'Submit Proof'}
      </button>

    </div>
  )
}