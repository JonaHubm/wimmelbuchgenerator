import { cookies } from "next/headers";
import { WimmelbuchGenerator } from "@/components/wimmelbuch-generator";
import { AI_USAGE_COOKIE_NAME, getPublicAiStatus, readAiUsage } from "@/lib/access-control";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionUsed = await readAiUsage(cookieStore.get(AI_USAGE_COOKIE_NAME)?.value);

  return <WimmelbuchGenerator initialAiStatus={getPublicAiStatus(sessionUsed)} />;
}
