import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const userId = String(body?.user_id ?? "").trim();

    // Blood Strike UID must be exactly 12 digits
    if (!/^\d{12}$/.test(userId)) {
      return NextResponse.json(
        {
          verified: false,
          message: "Blood Strike UID must be exactly 12 digits.",
        },
        { status: 400 }
      );
    }

    const memberCode = process.env.LIOGAMES_MEMBER_CODE;
    const keyId = process.env.LIOGAMES_KEY_ID;
    const keySecret = process.env.LIOGAMES_KEY_SECRET;

    if (!memberCode || !keyId || !keySecret) {
      console.error("LioGames environment variables are missing.");

      return NextResponse.json(
        {
          verified: false,
          message: "Blood Strike verification service is not configured.",
        },
        { status: 500 }
      );
    }

    // Keep the body exactly the same for signing and sending.
    const payload = {
      member_code: memberCode,
      game: "blood-strike",
      user_id: userId,
    };

    const rawJson = JSON.stringify(payload);

    // LioGames requires HMAC-SHA256 using the scoped key secret.
    const signature = crypto
      .createHmac("sha256", keySecret)
      .update(rawJson)
      .digest("hex");

    const response = await fetch(
      "https://distribution.liogames.com/api/v1/username-check",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-LIOG-KEY-ID": keyId,
          "x-liog-sign": signature,
        },
        body: rawJson,
        cache: "no-store",
      }
    );

    const result = await response.json();

    console.log("LioGames username check:", {
      status: response.status,
      ok: result?.ok,
      found: result?.found,
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          verified: false,
          message:
            result?.message ||
            "Unable to verify this Blood Strike account.",
        },
        { status: response.status }
      );
    }

    if (!result?.found) {
      return NextResponse.json({
        verified: false,
        message: "Blood Strike account not found.",
      });
    }

    return NextResponse.json({
      verified: true,
      username: result.username ?? null,
      user_id: userId,
    });
  } catch (error) {
    console.error("Blood Strike verification error:", error);

    return NextResponse.json(
      {
        verified: false,
        message: "Unable to verify Blood Strike UID right now.",
      },
      { status: 500 }
    );
  }
}