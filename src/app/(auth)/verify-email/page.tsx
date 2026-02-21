"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified") === "true";
  const next = searchParams.get("next"); // "dashboard" | "subscribe" | null
  const error = searchParams.get("error"); // "invalid_token" | "expired_token" | null

  const COOLDOWN_KEY = "verifyEmailCooldownUntil";
  const COOLDOWN_SECS = 60;

  const getRemainingCooldown = () => {
    const until = localStorage.getItem(COOLDOWN_KEY);
    if (!until) return 0;
    const remaining = Math.ceil((Number(until) - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  };

  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const [lastSentMsg, setLastSentMsg] = useState<string | null>(null);
  const prefilled = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldownTimer = (initialSeconds: number) => {
    setCooldown(initialSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!prefilled.current) {
      const stored = sessionStorage.getItem("pendingVerificationEmail");
      if (stored) setEmail(stored);
      prefilled.current = true;
    }
    // Resume cooldown from localStorage if still active
    const remaining = getRemainingCooldown();
    if (remaining > 0) startCooldownTimer(remaining);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResend = async () => {
    setIsSending(true);
    setResendError(null);
    setLastSentMsg(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        const data = await res.json();
        setResendError(data.error ?? "Tunggu sebelum meminta link baru.");
      } else {
        setLastSentMsg("Link verifikasi baru telah dikirim. Cek kotak masuk kamu.");
        localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_SECS * 1000));
        startCooldownTimer(COOLDOWN_SECS);
      }
    } catch {
      setResendError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setIsSending(false);
    }
  };

  const loginHref =
    next === "subscribe" ? "/login?callbackUrl=/subscribe" : "/login";

  // ── Verified state ────────────────────────────────────────────────────────
  if (verified) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-7 w-7 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold">Email terverifikasi!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Email kamu sudah berhasil diverifikasi. Silakan masuk untuk
              melanjutkan.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href={loginHref}>Masuk ke akun</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Invalid token error ───────────────────────────────────────────────────
  if (error === "invalid_token") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-7 w-7 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold">Link tidak valid</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Link verifikasi tidak ditemukan atau sudah digunakan. Minta link
              baru dari halaman verifikasi.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/verify-email">Kembali</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Default state (waiting + resend form), with optional expired error ────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <span className="font-semibold text-lg tracking-tight">Haventium</span>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Masuk
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-muted">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Cek email kamu
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Kami telah mengirimkan link verifikasi ke email kamu. Klik link
              tersebut untuk mengaktifkan akun.
            </p>
          </div>

          {/* Expired error banner */}
          {error === "expired_token" && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Link verifikasi sudah kedaluwarsa. Minta link baru di bawah ini.
            </div>
          )}

          {/* Resend section */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Tidak menerima email?</h2>
              {email && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Link dikirim ke{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                </p>
              )}
            </div>

            {lastSentMsg && (
              <p className="text-xs text-emerald-700">{lastSentMsg}</p>
            )}
            {resendError && (
              <p className="text-xs text-destructive">{resendError}</p>
            )}

            <Button
              onClick={handleResend}
              disabled={isSending || cooldown > 0 || !email}
              className="w-full"
              variant="outline"
            >
              {isSending
                ? "Mengirim..."
                : cooldown > 0
                  ? `Kirim ulang dalam ${cooldown}s`
                  : "Kirim ulang link verifikasi"}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Sudah verifikasi?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
