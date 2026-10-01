import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

type Action =
  | "suspend"
  | "unsuspend"
  | "blacklist"
  | "unblacklist"

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch {
              // Ignore cookie errors in server components
            }
          },
        },
      }
    )

    // Verify the currently logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify admin role
    const { data: adminRole, error: adminError } =
      await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single()

    if (adminError || adminRole?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      )
    }

    const body = await request.json()

    const userId = body?.userId as string
    const action = body?.action as Action
    const reason =
      typeof body?.reason === "string"
        ? body.reason.trim()
        : ""

    if (!userId || !action) {
      return NextResponse.json(
        { error: "User ID and action are required" },
        { status: 400 }
      )
    }

    const validActions: Action[] = [
      "suspend",
      "unsuspend",
      "blacklist",
      "unblacklist",
    ]

    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: "Invalid status action" },
        { status: 400 }
      )
    }

    // A reason is required when an account is being suspended or blacklisted.
    if (
      (action === "suspend" || action === "blacklist") &&
      !reason
    ) {
      return NextResponse.json(
        {
          error:
            "A reason is required when suspending or blacklisting an account.",
        },
        { status: 400 }
      )
    }

    if (reason.length > 500) {
      return NextResponse.json(
        { error: "The reason cannot exceed 500 characters." },
        { status: 400 }
      )
    }

    // Prevent an admin from changing their own account status
    if (userId === user.id) {
      return NextResponse.json(
        { error: "You cannot change your own account status" },
        { status: 400 }
      )
    }

    // Perform the protected update through the SECURITY DEFINER RPC.
    // The RPC also creates the affected player's notification.
    const { data, error } = await supabase.rpc(
      "admin_update_user_status",
      {
        p_user_id: userId,
        p_action: action,
        p_reason: reason || null,
      }
    )

    if (error) {
      console.error("Admin user status RPC error:", error)

      return NextResponse.json(
        {
          error:
            error.message ||
            "The account status could not be updated.",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Account status updated successfully.",
      user: data,
    })
  } catch (error) {
    console.error("Admin user status error:", error)

    return NextResponse.json(
      {
        error: "An unexpected error occurred.",
      },
      { status: 500 }
    )
  }
}
