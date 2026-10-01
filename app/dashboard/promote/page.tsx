"use client";

import {
  ChangeEvent,
  FormEvent,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function PromotePage() {
  const [advertiserName, setAdvertiserName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [requestedStartAt, setRequestedStartAt] = useState("");
  const [requestedEndAt, setRequestedEndAt] = useState("");
  const [notes, setNotes] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setError("");

    if (!file) {
      setImageFile(null);
      setImagePreview("");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG or WEBP image.");
      event.target.value = "";
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setError("Promotion image must be 5MB or smaller.");
      event.target.value = "";
      return;
    }

    setImageFile(file);

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!advertiserName.trim()) {
      setError("Please enter your name or business name.");
      return;
    }

    if (!contactEmail.trim()) {
      setError("Please enter your contact email.");
      return;
    }

    if (!contactNumber.trim()) {
      setError("Please enter your contact number.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a promotion title.");
      return;
    }

    if (!description.trim()) {
      setError("Please describe what you want to promote.");
      return;
    }

    if (!destinationUrl.trim()) {
      setError("Please enter the destination URL.");
      return;
    }

    try {
      new URL(destinationUrl.trim());
    } catch {
      setError(
        "Please enter a valid URL, for example https://example.com"
      );
      return;
    }

    if (!imageFile) {
      setError("Please upload an image for your promotion.");
      return;
    }

    if (
      requestedStartAt &&
      requestedEndAt &&
      new Date(requestedEndAt) <= new Date(requestedStartAt)
    ) {
      setError("The end date must be after the start date.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "You need to be logged in before submitting a promotion."
        );
        setLoading(false);
        return;
      }

      /*
       * Upload promotion image
       */
      const fileExtension =
        imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("promotion-images")
        .upload(fileName, imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) {
        console.error(uploadError);
        throw new Error(
          `Image upload failed: ${uploadError.message}`
        );
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("promotion-images")
        .getPublicUrl(fileName);

      /*
       * Create promotion request
       */
      const { error: insertError } = await supabase
        .from("promotion_requests")
        .insert({
          advertiser_name: advertiserName.trim(),
          contact_email: contactEmail.trim(),
          contact_number: contactNumber.trim(),
          title: title.trim(),
          description: description.trim(),
          destination_url: destinationUrl.trim(),
          image_url: publicUrl,
          requested_start_at: requestedStartAt
            ? new Date(requestedStartAt).toISOString()
            : null,
          requested_end_at: requestedEndAt
            ? new Date(requestedEndAt).toISOString()
            : null,
          notes: notes.trim() || null,
          status: "pending_review",
        });

      if (insertError) {
        console.error(insertError);
        throw new Error(insertError.message);
      }

      setSuccess(
        "Your promotion request has been submitted successfully. Our admin team will review it before anything is published."
      );

      setAdvertiserName("");
      setContactEmail("");
      setContactNumber("");
      setTitle("");
      setDescription("");
      setDestinationUrl("");
      setRequestedStartAt("");
      setRequestedEndAt("");
      setNotes("");
      setImageFile(null);
      setImagePreview("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while submitting your promotion."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center text-sm font-bold text-zinc-500 transition hover:text-white"
          >
            ← Back to Dashboard
          </Link>

          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB PROMOTIONS
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Promote With Us
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
            Want to promote your gaming community, tournament, business,
            service, event or product on STRIKEHUB? Submit your promotion for
            review.
          </p>
        </div>

        {/* Notice */}
        <div className="mb-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] p-5">
          <div className="flex gap-3">
            <div className="mt-0.5 text-yellow-400">⚠</div>

            <div>
              <p className="text-sm font-black text-yellow-400">
                Important
              </p>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Submitting this form does not automatically publish your
                promotion. Every promotion is reviewed by the STRIKEHUB admin
                team before it can appear publicly.
              </p>
            </div>
          </div>
        </div>

        {/* Success */}
        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-5">
            <p className="text-sm font-bold text-emerald-400">
              ✓ Request submitted
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {success}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-5">
            <p className="text-sm font-bold text-red-400">
              Something went wrong
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-400">
              {error}
            </p>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025]"
        >
          <div className="border-b border-white/[0.06] px-6 py-6 sm:px-8">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              Promotion Request
            </p>

            <h2 className="mt-2 text-xl font-black">
              Tell us what you want to promote
            </h2>

            <p className="mt-1 text-xs text-zinc-600">
              All fields marked with * are required.
            </p>
          </div>

          <div className="space-y-7 px-6 py-7 sm:px-8">
            {/* Advertiser + Email */}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Name / Business Name *
                </label>

                <input
                  type="text"
                  value={advertiserName}
                  onChange={(e) => setAdvertiserName(e.target.value)}
                  placeholder="Your name or business name"
                  maxLength={120}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/50"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Contact Email *
                </label>

                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={160}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/50"
                  required
                />
              </div>
            </div>

            {/* Contact Number */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Contact Number *
              </label>

              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. 08012345678"
                maxLength={30}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/50"
                required
              />

              <p className="mt-2 text-[10px] text-zinc-700">
                We may contact you regarding your promotion request.
              </p>
            </div>

            {/* Promotion Image */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Promotion Image *
              </label>

              <div className="rounded-2xl border border-dashed border-white/10 bg-black p-5">
                {imagePreview ? (
                  <div>
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
                      <img
                        src={imagePreview}
                        alt="Promotion preview"
                        className="max-h-[400px] w-full object-contain"
                      />
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:border-red-500/40 hover:text-white"
                      >
                        Change Image
                      </button>

                      <button
                        type="button"
                        onClick={removeImage}
                        className="rounded-xl border border-red-500/20 px-4 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded-xl px-5 py-10 text-center transition hover:bg-white/[0.025]"
                  >
                    <div className="mb-3 text-3xl">🖼️</div>

                    <p className="text-sm font-bold text-zinc-300">
                      Click to upload your promotion image
                    </p>

                    <p className="mt-2 text-xs text-zinc-600">
                      JPG, PNG or WEBP • Maximum 5MB
                    </p>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Promotion Title *
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Join Our BloodStrike Tournament"
                maxLength={150}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/50"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Description *
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us what you want players and visitors to know about your promotion..."
                maxLength={2000}
                rows={6}
                className="w-full resize-none rounded-xl border border-white/10 bg-black px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/50"
                required
              />

              <p className="mt-2 text-right text-[10px] text-zinc-700">
                {description.length}/2000
              </p>
            </div>

            {/* Destination URL */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Destination URL *
              </label>

              <input
                type="url"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="https://example.com"
                maxLength={500}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/50"
                required
              />

              <p className="mt-2 text-[10px] text-zinc-700">
                Visitors will be directed to this link when they click your
                promotion.
              </p>
            </div>

            {/* Dates */}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Requested Start
                </label>

                <input
                  type="datetime-local"
                  value={requestedStartAt}
                  onChange={(e) => setRequestedStartAt(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Requested End
                </label>

                <input
                  type="datetime-local"
                  value={requestedEndAt}
                  onChange={(e) => setRequestedEndAt(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-red-500/50"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Additional Notes
              </label>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else the STRIKEHUB admin team should know?"
                maxLength={1000}
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-black px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-red-500/50"
              />

              <p className="mt-2 text-right text-[10px] text-zinc-700">
                {notes.length}/1000
              </p>
            </div>

            {/* Submit */}
            <div className="border-t border-white/[0.06] pt-7">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-red-600 px-6 py-4 text-sm font-black uppercase tracking-wider text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Submitting Request..."
                  : "Submit Promotion Request"}
              </button>

              <p className="mt-4 text-center text-[10px] leading-5 text-zinc-700">
                By submitting this request, you understand that STRIKEHUB may
                review, approve, reject or request changes to your promotional
                content.
              </p>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}