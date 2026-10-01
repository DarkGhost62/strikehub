"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Withdrawal = {
  id: string;
  user_id: string;
  amount_gold: number;
  method: "bloodstrike" | "bank" | string;
  details: Record<string, any> | null;
  status: "pending" | "approved" | "rejected" | string;
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  player_name: string | null;
  in_game_name: string | null;
  bloodstrike_uid: string | null;
};

const supabase = createClient();

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatGold(value: number) {
  return Number(value || 0).toLocaleString("en-NG");
}

function formatNaira(value: unknown) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");

  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function loadWithdrawals() {
    setLoading(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc(
      "get_admin_withdrawals"
    );

    if (rpcError) {
      setError(rpcError.message);
      setWithdrawals([]);
      setLoading(false);
      return;
    }

    setWithdrawals((data || []) as Withdrawal[]);
    setLoading(false);
  }

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const filteredWithdrawals = useMemo(() => {
    if (filter === "all") return withdrawals;

    return withdrawals.filter((item) => item.status === filter);
  }, [withdrawals, filter]);

  const pendingCount = withdrawals.filter(
    (item) => item.status === "pending"
  ).length;

  const approvedCount = withdrawals.filter(
    (item) => item.status === "approved"
  ).length;

  const rejectedCount = withdrawals.filter(
    (item) => item.status === "rejected"
  ).length;

  const pendingGold = withdrawals
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount_gold || 0), 0);

  async function handleApprove(id: string) {
    const request = withdrawals.find((item) => item.id === id);

    if (!request) return;

    const confirmed = window.confirm(
      `Approve this withdrawal?\n\n${formatGold(
        request.amount_gold
      )} Gold\n${formatNaira(request.details?.naira_amount)}`
    );

    if (!confirmed) return;

    setProcessingId(id);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc("approve_withdrawal", {
      p_withdrawal_id: id,
      p_admin_note: noteFor === id ? note.trim() || null : null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setProcessingId(null);
      return;
    }

    setSuccess("Withdrawal approved successfully.");
    setNoteFor(null);
    setNote("");
    setProcessingId(null);

    await loadWithdrawals();
  }

  async function handleReject(id: string) {
    const request = withdrawals.find((item) => item.id === id);

    if (!request) return;

    const trimmedNote = noteFor === id ? note.trim() : "";

    if (!trimmedNote) {
      setError("Please enter a reason before rejecting a withdrawal.");
      setNoteFor(id);
      return;
    }

    const confirmed = window.confirm(
      `Reject this withdrawal?\n\n${formatGold(
        request.amount_gold
      )} Gold will be returned to the player.`
    );

    if (!confirmed) return;

    setProcessingId(id);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc("reject_withdrawal", {
      p_withdrawal_id: id,
      p_admin_note: trimmedNote,
    });

    if (rpcError) {
      setError(rpcError.message);
      setProcessingId(null);
      return;
    }

    setSuccess(
      `${formatGold(
        request.amount_gold
      )} Gold has been returned and the withdrawal was rejected.`
    );

    setNoteFor(null);
    setNote("");
    setProcessingId(null);

    await loadWithdrawals();
  }

  function openNote(id: string, existingNote: string | null) {
    setError("");
    setNoteFor(id);
    setNote(existingNote || "");
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-400">
              Admin
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Withdrawal Requests
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Review and process player withdrawal requests.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/admin"
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800"
            >
              ← Back to Admin
            </a>

            <button
              onClick={loadWithdrawals}
              disabled={loading}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Requests"
            value={withdrawals.length.toLocaleString("en-NG")}
          />

          <StatCard
            label="Pending"
            value={pendingCount.toLocaleString("en-NG")}
          />

          <StatCard
            label="Approved"
            value={approvedCount.toLocaleString("en-NG")}
          />

          <StatCard
            label="Pending Gold"
            value={`${formatGold(pendingGold)} Gold`}
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {[
            ["all", `All (${withdrawals.length})`],
            ["pending", `Pending (${pendingCount})`],
            ["approved", `Approved (${approvedCount})`],
            ["rejected", `Rejected (${rejectedCount})`],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() =>
                setFilter(
                  value as "all" | "pending" | "approved" | "rejected"
                )
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                filter === value
                  ? "bg-red-600 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
            Loading withdrawal requests...
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="font-semibold text-white">
              No withdrawal requests found.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              There are no requests in the selected category.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredWithdrawals.map((withdrawal) => {
              const details = withdrawal.details || {};
              const isPending = withdrawal.status === "pending";
              const isProcessing = processingId === withdrawal.id;

              const playerName =
                withdrawal.in_game_name ||
                withdrawal.player_name ||
                "Unknown Player";

              return (
                <div
                  key={withdrawal.id}
                  className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl"
                >
                  <div className="flex flex-col gap-4 border-b border-zinc-800 p-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-lg font-bold">{playerName}</h2>

                        <StatusBadge status={withdrawal.status} />

                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">
                          {withdrawal.method === "bank"
                            ? "Bank"
                            : "BloodStrike"}
                        </span>
                      </div>

                      <p className="mt-2 break-all text-xs text-zinc-500">
                        Request ID: {withdrawal.id}
                      </p>

                      {withdrawal.bloodstrike_uid && (
                        <p className="mt-1 text-sm text-zinc-400">
                          BloodStrike UID:{" "}
                          <span className="font-semibold text-zinc-200">
                            {withdrawal.bloodstrike_uid}
                          </span>
                        </p>
                      )}
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-2xl font-bold text-yellow-400">
                        {formatGold(withdrawal.amount_gold)} Gold
                      </p>

                      <p className="mt-1 text-sm text-zinc-400">
                        {formatNaira(details.naira_amount)}
                      </p>

                      <p className="mt-2 text-xs text-zinc-500">
                        Submitted {formatDate(withdrawal.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
                    <InfoBox
                      label="Withdrawal Method"
                      value={
                        withdrawal.method === "bank"
                          ? "Bank Transfer"
                          : "BloodStrike"
                      }
                    />

                    <InfoBox
                      label="Gold Reserved"
                      value={`${formatGold(withdrawal.amount_gold)} Gold`}
                    />

                    <InfoBox
                      label="Naira Amount"
                      value={formatNaira(details.naira_amount)}
                    />

                    <InfoBox
                      label="Rate Used"
                      value={
                        details.naira_per_gold
                          ? `₦${Number(
                              details.naira_per_gold
                            ).toLocaleString("en-NG", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6,
                            })} / Gold`
                          : "—"
                      }
                    />
                  </div>

                  {withdrawal.method === "bank" && (
                    <div className="mx-5 mb-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
                        Bank Details
                      </h3>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <DetailItem
                          label="Account Name"
                          value={details.account_name || "—"}
                        />

                        <DetailItem
                          label="Bank"
                          value={details.bank_name || "—"}
                        />

                        <DetailItem
                          label="Account Number"
                          value={details.account_number || "—"}
                        />
                      </div>
                    </div>
                  )}

                  {withdrawal.method === "bloodstrike" && (
                    <div className="mx-5 mb-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
                        BloodStrike Details
                      </h3>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <DetailItem
                          label="BloodStrike UID"
                          value={
                            details.bloodstrike_uid ||
                            withdrawal.bloodstrike_uid ||
                            "—"
                          }
                        />

                        <DetailItem
                          label="Gold Requested"
                          value={`${formatGold(
                            withdrawal.amount_gold
                          )} Gold`}
                        />
                      </div>
                    </div>
                  )}

                  {withdrawal.admin_note && (
                    <div className="mx-5 mb-5 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                        Admin Note
                      </p>

                      <p className="mt-2 text-sm text-zinc-300">
                        {withdrawal.admin_note}
                      </p>
                    </div>
                  )}

                  {isPending && (
                    <div className="border-t border-zinc-800 bg-zinc-950/40 p-5">
                      {noteFor === withdrawal.id && (
                        <div className="mb-4">
                          <label className="mb-2 block text-sm font-semibold text-zinc-300">
                            Admin Note
                          </label>

                          <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Add a note. A reason is required when rejecting."
                            rows={3}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-red-500"
                          />
                        </div>
                      )}

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          onClick={() =>
                            openNote(withdrawal.id, withdrawal.admin_note)
                          }
                          disabled={isProcessing}
                          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
                        >
                          {noteFor === withdrawal.id
                            ? "Close Note"
                            : "Add Admin Note"}
                        </button>

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            onClick={() =>
                              handleReject(withdrawal.id)
                            }
                            disabled={isProcessing}
                            className="rounded-lg border border-red-800 bg-red-950/40 px-5 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing
                              ? "Processing..."
                              : "Reject & Refund"}
                          </button>

                          <button
                            onClick={() =>
                              handleApprove(withdrawal.id)
                            }
                            disabled={isProcessing}
                            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing ? "Processing..." : "Approve"}
                          </button>
                        </div>
                      </div>

                      <p className="mt-4 text-xs text-zinc-600">
                        Rejecting this request automatically returns{" "}
                        {formatGold(withdrawal.amount_gold)} Gold to the
                        player.
                      </p>
                    </div>
                  )}

                  {!isPending && withdrawal.reviewed_at && (
                    <div className="border-t border-zinc-800 px-5 py-4 text-xs text-zinc-500">
                      Reviewed {formatDate(withdrawal.reviewed_at)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400">
        Approved
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="rounded-full bg-red-950 px-3 py-1 text-xs font-bold text-red-400">
        Rejected
      </span>
    );
  }

  return (
    <span className="rounded-full bg-yellow-950 px-3 py-1 text-xs font-bold text-yellow-400">
      Pending
    </span>
  );
}