import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import OpenAI from "openai"

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
              // Server component / route cookie updates can safely be ignored here.
            }
          },
        },
      }
    )

    // Check logged-in user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      )
    }

    // Check admin role
    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    if (roleError || role?.role !== "admin") {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      )
    }

    // Read request
    const body = await request.json()

    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : ""

    if (!prompt) {
      return NextResponse.json(
        { error: "Badge prompt is required." },
        { status: 400 }
      )
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        {
          error: "Badge prompt must be 2000 characters or fewer.",
        },
        { status: 400 }
      )
    }

    // Gemini API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not configured on the server.",
        },
        { status: 500 }
      )
    }

    // Use Google's OpenAI-compatible Gemini endpoint.
    const gemini = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL:
        "https://generativelanguage.googleapis.com/v1beta/openai/",
    })

    const finalPrompt = `
Create a premium STRIKEHUB esports player badge.

Badge artwork requirements:
- centered emblem
- professional competitive gaming aesthetic
- strong recognizable silhouette
- readable at small profile-badge size
- high-detail but clean
- dramatic lighting
- polished premium materials
- collectible esports achievement appearance
- clean background suitable for a profile badge
- no user interface
- no mockup
- no card frame
- no watermark
- no unnecessary text

Administrator's badge concept:
${prompt}
`

    const result = await gemini.images.generate({
      model: "gemini-2.5-flash-image",
      prompt: finalPrompt,
      n: 1,
      response_format: "b64_json",
    })

    const image = result.data?.[0]?.b64_json

    if (!image) {
      return NextResponse.json(
        {
          error:
            "Gemini did not return an image.",
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      image: `data:image/png;base64,${image}`,
    })
  } catch (error) {
    console.error("Gemini badge generation error:", error)

    let message = "Badge generation failed."

    if (error instanceof Error) {
      message = error.message
    }

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    )
  }
}