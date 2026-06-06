"use client";

import { FormEvent, useState } from "react";
import { BookOpen, Loader2, LockKeyhole } from "lucide-react";
import { apiRequestErrorMessage, readApiResponse } from "@/lib/api-client";

export default function AccessPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/access", {
        body: JSON.stringify({ passcode }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await readApiResponse<{ error?: string; ok?: boolean }>(response, "Access failed.");

      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Access failed.");
      }

      window.location.assign("/");
    } catch (accessError) {
      setError(apiRequestErrorMessage(accessError, "Access failed."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f4ee] px-4 py-10 text-neutral-950">
      <section className="w-full max-w-md border border-black/10 bg-white p-5 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="grid h-11 w-11 place-items-center bg-black text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Private test</p>
            <h1 className="text-2xl font-black tracking-normal">Wimmelbuch Generator</h1>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submitAccess}>
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Access code</span>
            <input
              autoComplete="off"
              autoFocus
              className="h-12 w-full border border-black/10 bg-[#fdfbf5] px-3 text-base font-semibold outline-none transition focus:border-black"
              onChange={(event) => setPasscode(event.target.value)}
              type="password"
              value={passcode}
            />
          </label>

          {error ? (
            <div className="border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            className="flex h-12 w-full items-center justify-center gap-2 border border-black bg-black px-4 text-sm font-black text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!passcode.trim() || isSubmitting}
            type="submit"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            Enter
          </button>
        </form>
      </section>
    </main>
  );
}
