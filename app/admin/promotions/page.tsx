"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const supabase = createClient();

type PromotionRequest = {
  id: string;
  user_id: string | null;
  advertiser_name: string;
  contact_email: string;
  contact_number: string | null;
  title: string;
  description: string;
  image_url: string | null;
  destination_url: string;
  requested_start_at: string | null;
  requested_end_at: string | null;
  notes: string | null;
  status: string;
  payment_amount: number | null;
  payment_recorded_at: string | null;
  payment_recorded_by: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type Promotion = {
  id: string;
  advertiser_name: string;
  contact_email: string | null;
  contact_number: string | null;
  title: string;
  description: string;
  image_url: string | null;
  destination_url: string;
  starts_at: string | null;
  expires_at: string | null;
  status: string;
  is_featured: boolean;
  created_at: string;
};

type SupabaseErrorShape = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  status?: unknown;
};

export default function AdminPromotionsPage() {
  const [requests, setRequests] = useState<PromotionRequest[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [paymentRequest, setPaymentRequest] =
    useState<PromotionRequest | null>(null);

  const [paymentAmount, setPaymentAmount] = useState("");

  const [rejectRequest, setRejectRequest] =
    useState<PromotionRequest | null>(null);

  const [rejectionReason, setRejectionReason] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  function getErrorMessage(
    err: unknown,
    fallback: string
  ): string {
    if (err instanceof Error && err.message) {
      return err.message;
    }

    if (typeof err === "string" && err.trim()) {
      return err;
    }

    if (
      typeof err === "object" &&
      err !== null
    ) {
      const value = err as SupabaseErrorShape;

      if (
        typeof value.message === "string" &&
        value.message.trim()
      ) {
        let result = value.message;

        if (
          typeof value.code === "string" &&
          value.code.trim()
        ) {
          result += ` [${value.code}]`;
        }

        if (
          typeof value.details === "string" &&
          value.details.trim()
        ) {
          result += ` ${value.details}`;
        }

        if (
          typeof value.hint === "string" &&
          value.hint.trim()
        ) {
          result += ` Hint: ${value.hint}`;
        }

        return result;
      }

      try {
        const serialized = JSON.stringify(err);

        if (
          serialized &&
          serialized !== "{}" &&
          serialized !== "null"
        ) {
          return serialized;
        }
      } catch {
        // Ignore serialization errors.
      }
    }

    return fallback;
  }

  function getErrorDetails(err: unknown): string {
    if (err instanceof Error) {
      return err.message || "Unknown error";
    }

    if (
      typeof err === "object" &&
      err !== null
    ) {
      const value = err as SupabaseErrorShape;

      const parts: string[] = [];

      if (typeof value.message === "string") {
        parts.push(value.message);
      }

      if (typeof value.code === "string") {
        parts.push(`code=${value.code}`);
      }

      if (typeof value.details === "string") {
        parts.push(`details=${value.details}`);
      }

      if (typeof value.hint === "string") {
        parts.push(`hint=${value.hint}`);
      }

      if (parts.length > 0) {
        return parts.join(" | ");
      }

      try {
        const serialized = JSON.stringify(err);

        if (serialized && serialized !== "{}") {
          return serialized;
        }
      } catch {
        // Ignore.
      }
    }

    if (typeof err === "string") {
      return err;
    }

    return "Unknown error";
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: requestData,
        error: requestError,
      } = await supabase
        .from("promotion_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestError) {
        throw requestError;
      }

      const {
        data: promotionData,
        error: promotionError,
      } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });

      if (promotionError) {
        throw promotionError;
      }

      setRequests(
        (requestData || []) as PromotionRequest[]
      );

      setPromotions(
        (promotionData || []) as Promotion[]
      );
    } catch (err) {
      console.error(
        "Failed to load promotions:",
        getErrorDetails(err)
      );

      setError(
        getErrorMessage(
          err,
          "Failed to load promotions."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * CREATE NOTIFICATION
   *
   * First attempt:
   *   admin_create_notification()
   *
   * If the protected RPC fails, we try a direct insert.
   *
   * This is useful because the approval itself is already
   * handled safely by admin_approve_promotion().
   */
  async function createNotification(
    userId: string | null,
    title: string,
    notificationMessage: string
  ) {
    if (!userId) {
      throw new Error(
        "Cannot create notification because this promotion request has no user_id."
      );
    }

    const notificationPayload = {
      user_id: userId,
      type: "promotion",
      title,
      message: notificationMessage,
      is_read: false,
    };

    /*
     * First try the protected admin notification RPC.
     */
    const {
      error: rpcError,
    } = await supabase.rpc(
      "admin_create_notification",
      {
        p_user_id: userId,
        p_type: "promotion",
        p_title: title,
        p_message: notificationMessage,
      }
    );

    if (!rpcError) {
      return;
    }

    console.error(
      "admin_create_notification failed:",
      {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
      }
    );

    /*
     * FALLBACK
     *
     * If the RPC failed, try inserting directly.
     *
     * If RLS blocks this, the final error will contain
     * the real Supabase error instead of "{}".
     */
    const {
      error: directInsertError,
    } = await supabase
      .from("notifications")
      .insert(notificationPayload);

    if (!directInsertError) {
      console.warn(
        "Notification created using direct insert fallback."
      );

      return;
    }

    console.error(
      "Direct notification insert also failed:",
      {
        message: directInsertError.message,
        code: directInsertError.code,
        details: directInsertError.details,
        hint: directInsertError.hint,
      }
    );

    const rpcDetails = getErrorDetails(rpcError);
    const directDetails =
      getErrorDetails(directInsertError);

    throw new Error(
      `Notification failed. RPC: ${rpcDetails}. Direct insert: ${directDetails}.`
    );
  }

  async function recordPayment() {
    if (!paymentRequest) return;

    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    setActionLoading(paymentRequest.id);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Admin session not found."
        );
      }

      const {
        error: updateError,
      } = await supabase
        .from("promotion_requests")
        .update({
          payment_amount: amount,
          payment_recorded_at:
            new Date().toISOString(),
          payment_recorded_by: user.id,
          status: "awaiting_payment",
        })
        .eq("id", paymentRequest.id);

      if (updateError) {
        throw updateError;
      }

      try {
        await createNotification(
          paymentRequest.user_id,
          "Promotion Payment Required",
          `Your promotion "${paymentRequest.title}" requires a payment of ₦${amount.toLocaleString(
            "en-NG",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}. Please contact STRIKEHUB for payment instructions.`
        );

        setMessage(
          "Payment amount recorded and the player has been notified."
        );
      } catch (notificationError) {
        console.error(
          "Payment recorded but notification failed:",
          getErrorDetails(notificationError)
        );

        setMessage(
          "Payment amount recorded, but the player notification could not be sent."
        );
      }

      setPaymentRequest(null);
      setPaymentAmount("");

      await loadData();
    } catch (err) {
      console.error(
        "Failed to record payment:",
        getErrorDetails(err)
      );

      setError(
        getErrorMessage(
          err,
          "Failed to record payment."
        )
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectPromotion() {
    if (!rejectRequest) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      setError(
        "Please enter a reason for rejecting this promotion."
      );
      return;
    }

    setActionLoading(rejectRequest.id);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Admin session not found."
        );
      }

      const {
        error: updateError,
      } = await supabase
        .from("promotion_requests")
        .update({
          status: "rejected",
          rejection_reason: reason,
        })
        .eq("id", rejectRequest.id);

      if (updateError) {
        throw updateError;
      }

      let notificationSent = false;

      try {
        await createNotification(
          rejectRequest.user_id,
          "Promotion Rejected",
          `Your promotion "${rejectRequest.title}" was rejected. Reason: ${reason}`
        );

        notificationSent = true;
      } catch (notificationError) {
        console.error(
          "Promotion rejected but notification failed:",
          getErrorDetails(notificationError)
        );
      }

      if (notificationSent) {
        setMessage(
          "Promotion rejected and the player has been notified."
        );
      } else {
        setMessage(
          "Promotion rejected, but the player notification could not be sent."
        );
      }

      setRejectRequest(null);
      setRejectionReason("");

      await loadData();
    } catch (err) {
      console.error(
        "Failed to reject promotion:",
        getErrorDetails(err)
      );

      setError(
        getErrorMessage(
          err,
          "Failed to reject promotion."
        )
      );
    } finally {
      setActionLoading(null);
    }
  }

  /*
   * APPROVE PROMOTION
   *
   * IMPORTANT:
   * The actual approval remains inside the protected
   * admin_approve_promotion() RPC.
   *
   * That RPC:
   * - verifies the admin
   * - checks the request
   * - prevents duplicate promotions
   * - creates the promotion
   * - marks the request approved
   */
  async function approvePromotion(
    request: PromotionRequest
  ) {
    setActionLoading(request.id);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Admin session not found."
        );
      }

      /*
       * DO NOT replace this with client-side
       * promotion insertion.
       *
       * The database RPC is the protected approval path.
       */
      const {
        data: approvalResult,
        error: approvalError,
      } = await supabase.rpc(
        "admin_approve_promotion",
        {
          p_request_id: request.id,
        }
      );

      if (approvalError) {
        throw approvalError;
      }

      if (!approvalResult) {
        throw new Error(
          "Promotion approval did not return a result."
        );
      }

      /*
       * At this point the promotion has already been
       * approved and published by the database RPC.
       *
       * Notification failure must NOT undo or falsely
       * report the approval as failed.
       */
      let notificationSent = false;
      let notificationErrorMessage = "";

      try {
        await createNotification(
          request.user_id,
          "Promotion Approved",
          `Your promotion "${request.title}" has been approved and is now eligible to appear on STRIKEHUB.`
        );

        notificationSent = true;
      } catch (notificationError) {
        notificationErrorMessage =
          getErrorDetails(notificationError);

        console.error(
          "Promotion approved but notification failed:",
          notificationErrorMessage
        );
      }

      if (notificationSent) {
        setMessage(
          "Promotion approved and published. The player has been notified."
        );
      } else {
        /*
         * The promotion is STILL approved.
         *
         * We only report the notification problem.
         */
        setMessage(
          `Promotion approved and published, but the player notification could not be sent.`
        );

        /*
         * Put the actual notification problem into the
         * console so it is no longer hidden as "{}".
         */
        console.error(
          "Notification failure details:",
          notificationErrorMessage
        );
      }

      await loadData();
    } catch (err) {
      console.error(
        "Failed to approve promotion:",
        getErrorDetails(err)
      );

      setError(
        getErrorMessage(
          err,
          "Failed to approve promotion."
        )
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function deletePromotion(id: string) {
    const confirmed = window.confirm(
      "Delete this promotion permanently?"
    );

    if (!confirmed) return;

    setActionLoading(id);
    setError("");
    setMessage("");

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("promotions")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      setMessage("Promotion deleted.");

      await loadData();
    } catch (err) {
      console.error(
        "Failed to delete promotion:",
        getErrorDetails(err)
      );

      setError(
        getErrorMessage(
          err,
          "Failed to delete promotion."
        )
      );
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return "Not specified";
    }

    return new Date(value).toLocaleString(
      "en-NG",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  function statusClasses(status: string) {
    switch (status) {
      case "approved":
      case "active":
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-400";

      case "rejected":
        return "border-red-500/20 bg-red-500/10 text-red-400";

      case "awaiting_payment":
        return "border-yellow-500/20 bg-yellow-500/10 text-yellow-400";

      default:
        return "border-white/10 bg-white/[0.04] text-zinc-400";
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
            STRIKEHUB ADMIN
          </p>

          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-3xl font-black sm:text-4xl">
                Promotions
              </h1>

              <p className="mt-2 text-sm text-zinc-500">
                Review, approve, reject and manage user promotion requests.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin"
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-300 transition hover:border-red-500/40 hover:bg-red-500/[0.06] hover:text-white"
              >
                ← Back to Admin Panel
              </Link>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-zinc-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
            <p className="text-sm font-bold text-emerald-400">
              ✓ {message}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/[0.08] p-4">
            <p className="whitespace-pre-wrap text-sm font-bold text-red-400">
              {error}
            </p>
          </div>
        )}

        {/* Promotion Requests */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
                Review Queue
              </p>

              <h2 className="mt-1 text-xl font-black">
                Promotion Requests
              </h2>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-zinc-400">
              {requests.length} request
              {requests.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-600">
              Loading promotion requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-600">
              No promotion requests yet.
            </div>
          ) : (
            <div className="space-y-5">
              {requests.map((request) => {
                const busy =
                  actionLoading === request.id;

                return (
                  <article
                    key={request.id}
                    className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025]"
                  >
                    <div className="grid lg:grid-cols-[300px_1fr]">

                      {/* Image */}
                      <div className="bg-black">
                        {request.image_url ? (
                          <a
                            href={request.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block h-full"
                          >
                            <img
                              src={request.image_url}
                              alt={request.title}
                              className="h-full min-h-[220px] w-full object-cover transition hover:opacity-80"
                            />
                          </a>
                        ) : (
                          <div className="flex min-h-[220px] items-center justify-center text-sm text-zinc-700">
                            No image submitted
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="p-6">
                        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-500">
                              Promotion Request
                            </p>

                            <h3 className="mt-1 text-xl font-black">
                              {request.title}
                            </h3>

                            <p className="mt-1 text-xs text-zinc-600">
                              Submitted{" "}
                              {formatDate(request.created_at)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusClasses(
                              request.status
                            )}`}
                          >
                            {request.status.replaceAll(
                              "_",
                              " "
                            )}
                          </span>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                              Advertiser
                            </p>

                            <p className="mt-1 text-sm font-bold text-zinc-200">
                              {request.advertiser_name}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                              Contact Email
                            </p>

                            <p className="mt-1 break-all text-sm text-zinc-300">
                              {request.contact_email}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                              Contact Number
                            </p>

                            <p className="mt-1 text-sm text-zinc-300">
                              {request.contact_number ||
                                "Not provided"}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                              Destination
                            </p>

                            <a
                              href={request.destination_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block break-all text-sm font-bold text-red-400 hover:text-red-300"
                            >
                              {request.destination_url}
                            </a>
                          </div>

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                              Requested Start
                            </p>

                            <p className="mt-1 text-sm text-zinc-300">
                              {formatDate(
                                request.requested_start_at
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                              Requested End
                            </p>

                            <p className="mt-1 text-sm text-zinc-300">
                              {formatDate(
                                request.requested_end_at
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/40 p-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                            Description
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                            {request.description}
                          </p>
                        </div>

                        {/* Notes */}
                        {request.notes && (
                          <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/40 p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                              Additional Notes
                            </p>

                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                              {request.notes}
                            </p>
                          </div>
                        )}

                        {/* Payment */}
                        {request.payment_amount != null && (
                          <div className="mt-4 rounded-2xl border border-yellow-500/10 bg-yellow-500/[0.04] p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-yellow-500">
                              Payment
                            </p>

                            <p className="mt-1 text-lg font-black text-yellow-400">
                              ₦
                              {Number(
                                request.payment_amount
                              ).toLocaleString(
                                "en-NG",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </p>

                            {request.payment_recorded_at && (
                              <p className="mt-1 text-[10px] text-zinc-600">
                                Recorded{" "}
                                {formatDate(
                                  request.payment_recorded_at
                                )}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Rejection Reason */}
                        {request.rejection_reason && (
                          <div className="mt-4 rounded-2xl border border-red-500/10 bg-red-500/[0.04] p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-500">
                              Rejection Reason
                            </p>

                            <p className="mt-2 text-sm leading-6 text-red-300">
                              {request.rejection_reason}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-6 flex flex-wrap gap-3 border-t border-white/[0.06] pt-5">

                          {request.status !== "rejected" &&
                            request.status !== "approved" && (
                              <>
                                {/* Payment */}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setError("");
                                    setMessage("");

                                    setPaymentAmount(
                                      request.payment_amount
                                        ? String(
                                            request.payment_amount
                                          )
                                        : ""
                                    );

                                    setPaymentRequest(
                                      request
                                    );
                                  }}
                                  className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] px-4 py-3 text-xs font-black uppercase tracking-wider text-yellow-400 transition hover:bg-yellow-500/10 disabled:opacity-50"
                                >
                                  Payment
                                </button>

                                {/* Reject */}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setError("");
                                    setMessage("");

                                    setRejectionReason(
                                      request.rejection_reason ||
                                        ""
                                    );

                                    setRejectRequest(
                                      request
                                    );
                                  }}
                                  className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs font-black uppercase tracking-wider text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                                >
                                  Reject
                                </button>

                                {/* Approve */}
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    approvePromotion(
                                      request
                                    )
                                  }
                                  className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  {busy
                                    ? "Processing..."
                                    : "Approve"}
                                </button>
                              </>
                            )}

                          {request.status === "approved" && (
                            <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs font-black uppercase tracking-wider text-emerald-400">
                              Approved
                            </span>
                          )}

                          {request.status === "rejected" && (
                            <span className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-xs font-black uppercase tracking-wider text-red-400">
                              Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Promotions */}
        <section>
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              Published
            </p>

            <h2 className="mt-1 text-xl font-black">
              Active Promotions
            </h2>
          </div>

          {promotions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-600">
              No published promotions.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {promotions.map((promotion) => (
                <article
                  key={promotion.id}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]"
                >
                  {promotion.image_url && (
                    <img
                      src={promotion.image_url}
                      alt={promotion.title}
                      className="h-48 w-full object-cover"
                    />
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-red-500">
                          {promotion.advertiser_name}
                        </p>

                        <h3 className="mt-1 font-black">
                          {promotion.title}
                        </h3>
                      </div>

                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${statusClasses(
                          promotion.status
                        )}`}
                      >
                        {promotion.status}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-zinc-500">
                      {promotion.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={promotion.destination_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase text-zinc-300 hover:text-white"
                      >
                        Open Link
                      </a>

                      <button
                        type="button"
                        disabled={
                          actionLoading ===
                          promotion.id
                        }
                        onClick={() =>
                          deletePromotion(
                            promotion.id
                          )
                        }
                        className="rounded-lg border border-red-500/20 px-3 py-2 text-[10px] font-black uppercase text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Payment Modal */}
      {paymentRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">

            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-500">
              Promotion Payment
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Enter Payment Amount
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Enter the amount the advertiser needs to pay for this promotion.
            </p>

            <div className="mt-6">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Amount (NGN)
              </label>

              <div className="flex overflow-hidden rounded-xl border border-white/10 bg-black">
                <span className="flex items-center border-r border-white/10 px-4 text-zinc-500">
                  ₦
                </span>

                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) =>
                    setPaymentAmount(
                      e.target.value
                    )
                  }
                  placeholder="0.00"
                  className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentRequest(null);
                  setPaymentAmount("");
                }}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  actionLoading ===
                  paymentRequest.id
                }
                onClick={recordPayment}
                className="flex-1 rounded-xl bg-yellow-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-yellow-500 disabled:opacity-50"
              >
                {actionLoading ===
                paymentRequest.id
                  ? "Saving..."
                  : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">

            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">
              Reject Promotion
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Why are you rejecting this promotion?
            </h2>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              This reason will be sent to the player in their notification.
            </p>

            <div className="mt-6">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Rejection Reason *
              </label>

              <textarea
                value={rejectionReason}
                onChange={(e) =>
                  setRejectionReason(
                    e.target.value
                  )
                }
                rows={5}
                maxLength={1000}
                placeholder="Enter the reason for rejecting this promotion..."
                className="w-full resize-none rounded-xl border border-white/10 bg-black px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-zinc-700 focus:border-red-500/50"
                autoFocus
              />

              <p className="mt-2 text-right text-[10px] text-zinc-700">
                {rejectionReason.length}/1000
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectRequest(null);
                  setRejectionReason("");
                }}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  actionLoading ===
                  rejectRequest.id
                }
                onClick={rejectPromotion}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-50"
              >
                {actionLoading ===
                rejectRequest.id
                  ? "Rejecting..."
                  : "Reject Promotion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}