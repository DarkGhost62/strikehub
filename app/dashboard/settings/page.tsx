"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NOTIFICATIONS_KEY = "strikehub_notifications_enabled";
const COMMUNITY_NOTIFICATIONS_KEY = "strikehub_community_notifications_enabled";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [communityNotificationsEnabled, setCommunityNotificationsEnabled] =
    useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      try {
        // Get the actual authenticated Supabase user first.
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (mounted && user) {
          setUserEmail(user.email ?? "");
        }

        // Keep the existing localStorage fallback for UID.
        if (typeof window !== "undefined") {
          const storedUserId =
            localStorage.getItem("user_id") ||
            localStorage.getItem("uid") ||
            "";

          if (mounted) {
            setUserId(storedUserId);
          }
        }
      } catch (error) {
        console.error("Failed to load settings:", error);

        // Fallback to existing localStorage values.
        try {
          if (typeof window !== "undefined") {
            const storedEmail =
              localStorage.getItem("user_email") ||
              localStorage.getItem("email") ||
              "";

            const storedUserId =
              localStorage.getItem("user_id") ||
              localStorage.getItem("uid") ||
              "";

            if (mounted) {
              setUserEmail(storedEmail);
              setUserId(storedUserId);
            }
          }
        } catch {
          // Ignore localStorage errors.
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Load saved player preferences.
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedNotifications = localStorage.getItem(NOTIFICATIONS_KEY);
      const savedCommunityNotifications = localStorage.getItem(
        COMMUNITY_NOTIFICATIONS_KEY
      );

      // Default is ON for both settings.
      setNotificationsEnabled(savedNotifications !== "false");
      setCommunityNotificationsEnabled(
        savedCommunityNotifications !== "false"
      );
    } catch (error) {
      console.error("Failed to load player preferences:", error);
    } finally {
      setPreferencesLoaded(true);
    }
  }, []);

  function handleNotificationsToggle() {
    const nextValue = !notificationsEnabled;

    setNotificationsEnabled(nextValue);

    try {
      localStorage.setItem(NOTIFICATIONS_KEY, String(nextValue));

      // Tell other open STRIKEHUB pages/tabs that the preference changed.
      window.dispatchEvent(
        new CustomEvent("strikehub-notifications-changed", {
          detail: {
            enabled: nextValue,
          },
        })
      );
    } catch (error) {
      console.error("Failed to save notification preference:", error);
    }
  }

  function handleCommunityNotificationsToggle() {
    const nextValue = !communityNotificationsEnabled;

    setCommunityNotificationsEnabled(nextValue);

    try {
      localStorage.setItem(
        COMMUNITY_NOTIFICATIONS_KEY,
        String(nextValue)
      );

      // Tell other open STRIKEHUB pages/tabs that the preference changed.
      window.dispatchEvent(
        new CustomEvent("strikehub-community-notifications-changed", {
          detail: {
            enabled: nextValue,
          },
        })
      );
    } catch (error) {
      console.error(
        "Failed to save community notification preference:",
        error
      );
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    const email = userEmail.trim();

    if (!email) {
      setPasswordError(
        "Unable to identify your account email. Please log in again."
      );
      return;
    }

    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }

    if (!newPassword) {
      setPasswordError("Enter a new password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "Your new password must be different from your current password."
      );
      return;
    }

    setChangingPassword(true);

    try {
      /*
       * Re-authenticate first.
       *
       * Supabase's updateUser() changes the password for the currently
       * authenticated session, but it does not ask for the old password.
       * We therefore verify the current password by signing in again.
       */
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });

      if (signInError) {
        setPasswordError(
          "Your current password is incorrect. Please try again."
        );
        return;
      }

      // Now update the password.
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error("PASSWORD UPDATE ERROR:", updateError);

        setPasswordError(
          updateError.message || "Unable to change your password."
        );
        return;
      }

      setPasswordMessage(
        "Password changed successfully. Your new password is now active."
      );

      // Clear the fields after a successful change.
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      // Close the form after a short delay.
      window.setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordMessage("");
      }, 2500);
    } catch (error) {
      console.error("CHANGE PASSWORD ERROR:", error);

      setPasswordError(
        error instanceof Error
          ? error.message
          : "Unable to change your password right now."
      );
    } finally {
      setChangingPassword(false);
    }
  }

  function closePasswordForm() {
    if (changingPassword) return;

    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordError("");
    setPasswordMessage("");
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mb-6 text-sm font-semibold text-gray-400 transition hover:text-white"
          >
            ← Back to Dashboard
          </button>

          <div className="mb-2 text-xs font-black uppercase tracking-[0.35em] text-red-500">
            STRIKEHUB
          </div>

          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            Settings
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-gray-500 md:text-base">
            Manage your account, security and player preferences.
          </p>
        </div>

        {/* Main grid */}
        <div className="grid gap-5 md:grid-cols-2">
          {/* Account */}
          <section className="rounded-2xl border border-white/10 bg-[#0b0b0d] p-6">
            <div className="mb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-red-500">
                Account
              </p>

              <h2 className="mt-2 text-xl font-black">
                Account Information
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your basic STRIKEHUB account information.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  Email
                </p>

                <p className="mt-1 break-all text-sm font-semibold text-gray-200">
                  {loading
                    ? "Loading..."
                    : userEmail || "Your account email"}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  BloodStrike UID
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-200">
                  {loading
                    ? "Loading..."
                    : userId || "Available on your profile"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/dashboard/profile")}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold transition hover:border-red-500/40 hover:bg-red-500/10"
              >
                View Profile
              </button>
            </div>
          </section>

          {/* Security */}
          <section className="rounded-2xl border border-white/10 bg-[#0b0b0d] p-6">
            <div className="mb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-red-500">
                Security
              </p>

              <h2 className="mt-2 text-xl font-black">
                Account Security
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Security options for your STRIKEHUB account.
              </p>
            </div>

            <div className="space-y-3">
              {/* Password */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">Password</p>

                    <p className="mt-1 text-xs text-gray-500">
                      Keep your account password secure.
                    </p>
                  </div>

                  <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-[10px] font-black uppercase text-green-400">
                    Protected
                  </span>
                </div>

                {!showPasswordForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordError("");
                      setPasswordMessage("");
                      setShowPasswordForm(true);
                    }}
                    className="mt-4 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-300 transition hover:bg-red-500/20 hover:text-white"
                  >
                    Change Password
                  </button>
                ) : (
                  <form
                    onSubmit={handleChangePassword}
                    className="mt-4 space-y-3"
                  >
                    {/* Current password */}
                    <div>
                      <label
                        htmlFor="current-password"
                        className="mb-1.5 block text-xs font-bold text-gray-400"
                      >
                        Current Password
                      </label>

                      <input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        autoComplete="current-password"
                        placeholder="Enter your current password"
                        disabled={changingPassword}
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/50"
                      />
                    </div>

                    {/* New password */}
                    <div>
                      <label
                        htmlFor="new-password"
                        className="mb-1.5 block text-xs font-bold text-gray-400"
                      >
                        New Password
                      </label>

                      <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) =>
                          setNewPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        disabled={changingPassword}
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/50"
                      />
                    </div>

                    {/* Confirm new password */}
                    <div>
                      <label
                        htmlFor="confirm-new-password"
                        className="mb-1.5 block text-xs font-bold text-gray-400"
                      >
                        Confirm New Password
                      </label>

                      <input
                        id="confirm-new-password"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(event) =>
                          setConfirmNewPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        placeholder="Repeat your new password"
                        disabled={changingPassword}
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-700 focus:border-red-500/50"
                      />
                    </div>

                    {/* Error */}
                    {passwordError && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                        <p className="text-xs font-semibold leading-5 text-red-300">
                          {passwordError}
                        </p>
                      </div>
                    )}

                    {/* Success */}
                    {passwordMessage && (
                      <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3">
                        <p className="text-xs font-semibold leading-5 text-green-300">
                          ✓ {passwordMessage}
                        </p>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {changingPassword
                          ? "Changing..."
                          : "Update Password"}
                      </button>

                      <button
                        type="button"
                        onClick={closePasswordForm}
                        disabled={changingPassword}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-bold text-gray-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Email verification */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">
                      Email Verification
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Your STRIKEHUB account uses email verification.
                    </p>
                  </div>

                  <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-[10px] font-black uppercase text-green-400">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section className="rounded-2xl border border-white/10 bg-[#0b0b0d] p-6">
            <div className="mb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-red-500">
                Preferences
              </p>

              <h2 className="mt-2 text-xl font-black">
                Player Preferences
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Control how STRIKEHUB notifications appear for you.
              </p>
            </div>

            <div className="space-y-3">
              {/* Notifications */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      Notifications
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Tournament, wallet and account notifications.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={notificationsEnabled}
                    aria-label="Toggle notifications"
                    disabled={!preferencesLoaded}
                    onClick={handleNotificationsToggle}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      notificationsEnabled
                        ? "bg-red-600"
                        : "bg-gray-700"
                    } ${
                      !preferencesLoaded
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                        notificationsEnabled
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${
                      notificationsEnabled
                        ? "text-green-400"
                        : "text-gray-500"
                    }`}
                  >
                    {notificationsEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>

              {/* Community notifications */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      Community Notifications
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Notifications related to community activity and chat.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={communityNotificationsEnabled}
                    aria-label="Toggle community notifications"
                    disabled={!preferencesLoaded}
                    onClick={handleCommunityNotificationsToggle}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      communityNotificationsEnabled
                        ? "bg-red-600"
                        : "bg-gray-700"
                    } ${
                      !preferencesLoaded
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                        communityNotificationsEnabled
                          ? "left-6"
                          : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${
                      communityNotificationsEnabled
                        ? "text-green-400"
                        : "text-gray-500"
                    }`}
                  >
                    {communityNotificationsEnabled
                      ? "Enabled"
                      : "Disabled"}
                  </span>
                </div>
              </div>

              {/* Important note */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs leading-5 text-gray-500">
                  These preferences only control your notification
                  preferences. They do not override tournament,
                  community, suspension or blacklist restrictions
                  applied to your account.
                </p>
              </div>
            </div>
          </section>

          {/* Quick Links */}
          <section className="rounded-2xl border border-white/10 bg-[#0b0b0d] p-6">
            <div className="mb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-red-500">
                Quick Links
              </p>

              <h2 className="mt-2 text-xl font-black">
                STRIKEHUB
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Quickly return to the areas you use most.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold transition hover:border-red-500/40 hover:bg-red-500/10"
              >
                Dashboard
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/profile")}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold transition hover:border-red-500/40 hover:bg-red-500/10"
              >
                Profile
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/community")}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold transition hover:border-red-500/40 hover:bg-red-500/10"
              >
                Community
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard/tournaments")}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold transition hover:border-red-500/40 hover:bg-red-500/10"
              >
                Tournaments
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-white/10 pt-6 text-center">
          <p className="text-xs text-gray-600">
            STRIKEHUB • COMPETE. EARN. RISE.
          </p>
        </div>
      </div>
    </main>
  );
}