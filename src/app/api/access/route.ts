import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ACCESS_COOKIE_NAME,
  createAccessToken,
  getAccessCookieOptions,
  getAccessGateConfig,
  isAccessCodeValid,
} from "@/lib/access-control";

export const runtime = "nodejs";

const accessRequestSchema = z.object({
  passcode: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const config = getAccessGateConfig();

  if (!config.enabled) {
    return NextResponse.json({ ok: true });
  }

  if (!config.configured) {
    return NextResponse.json(
      { error: "Private access is not configured on the server." },
      { status: 503 },
    );
  }

  const parsed = accessRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success || !(await isAccessCodeValid(parsed.data.passcode))) {
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE_NAME, await createAccessToken(), getAccessCookieOptions());

  return response;
}
