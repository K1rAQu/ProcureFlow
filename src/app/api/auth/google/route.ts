import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleAuthUrl, getGoogleRedirectUri, isGoogleOAuthConfigured } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isGoogleOAuthConfigured()) {
    const url = new URL("/login?error=google_not_configured", request.url);
    return NextResponse.redirect(url);
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const redirectUri = getGoogleRedirectUri(request);
  const authUrl = getGoogleAuthUrl(state, redirectUri);
  return NextResponse.redirect(authUrl);
}
