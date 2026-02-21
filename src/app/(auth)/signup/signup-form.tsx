"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { trackSignupIntent } from "@/lib/meta-pixel";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TierData = {
  id: string;
  type: "FREE" | "NORMAL" | "PRO";
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  maxUsers: number;
  maxProperties: number;
  maxUnits: number;
  maxTenants: number;
  features: string[];
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/\d/, "Must contain number")
    .regex(/[@$!%*?&]/, "Must contain special character"),
  name: z.string().min(1, "Name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  tier: z.enum(["FREE", "NORMAL", "PRO"]),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
});

type SignupForm = z.infer<typeof signupSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIDR(amount: number): string {
  if (amount === 0) return "Gratis";
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function getLimits(tier: TierData): { label: string; value: string }[] {
  return [
    {
      label: "Properti",
      value:
        tier.maxProperties === -1 ? "Tak terbatas" : String(tier.maxProperties),
    },
    {
      label: "Unit per properti",
      value: tier.maxUnits === -1 ? "Tak terbatas" : String(tier.maxUnits),
    },
    {
      label: "Penyewa",
      value: tier.maxTenants === -1 ? "Tak terbatas" : String(tier.maxTenants),
    },
    {
      label: "Pengguna",
      value: tier.maxUsers === -1 ? "Tak terbatas" : String(tier.maxUsers),
    },
  ];
}

// ─── Tier styles (index: FREE=0, STANDARD=1, PRO=2) — monotone ──────────────

const TIER_ACCENT = [
  "text-muted-foreground",
  "text-foreground",
  "text-foreground",
];
const TIER_BORDER = [
  "border-border",
  "border-foreground ring-2 ring-foreground",
  "border-foreground ring-2 ring-foreground",
];
const TIER_BTN = [
  "bg-foreground text-background hover:bg-foreground/90",
  "bg-foreground text-background hover:bg-foreground/90",
  "bg-foreground text-background hover:bg-foreground/90",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignupForm({ tiers }: { tiers: TierData[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"pricing" | "form">("pricing");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { tier: "FREE", billingCycle: "MONTHLY" },
  });

  const selectedTier = watch("tier");
  const billingCycle = watch("billingCycle");

  const selectedTierData = tiers.find((t) => t.type === selectedTier);
  const hasAnnual = tiers.some((t) => t.annualPrice > 0);

  const displayPrice = (tier: TierData) =>
    billingCycle === "ANNUAL" ? tier.annualPrice : tier.monthlyPrice;

  const handleSelectTier = (type: TierData["type"]) => {
    setValue("tier", type);
    setStep("form");
  };

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setError(null);

    const tierData = tiers.find((t) => t.type === data.tier);
    if (tierData) {
      trackSignupIntent(tierData.monthlyPrice, tierData.name, "IDR");
    }

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Signup failed");
      }

      if (result.paymentLinkUrl) {
        window.location.href = result.paymentLinkUrl;
        return;
      }

      if (result.autoLogin) {
        sessionStorage.setItem(
          "pendingVerificationEmail",
          result.autoLogin.email,
        );
        // Record cooldown timestamp so verify-email page knows email was just sent
        localStorage.setItem("verifyEmailCooldownUntil", String(Date.now() + 60 * 1000));
        await signIn("credentials", {
          email: result.autoLogin.email,
          password: result.autoLogin.password,
          redirect: false,
        });
      }

      router.push(result.redirect || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Shared top bar ──────────────────────────────────────────────────────────
  const TopBar = () => (
    <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
      <span className="font-semibold text-lg tracking-tight">Haventium</span>
      <p className="text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground hover:underline"
        >
          Masuk
        </Link>
      </p>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Pricing (full viewport)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === "pricing") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopBar />

        <div className="flex-1 flex flex-col">
          <div className="max-w-6xl w-full mx-auto px-4 py-10 lg:py-14 flex flex-col flex-1">
            {/* Heading */}
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
                Pilih paket yang tepat
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Mulai gratis, upgrade kapan saja.
              </p>

              {/* Billing toggle */}
              {hasAnnual && (
                <div className="mt-5 inline-flex items-center gap-1 rounded-full border bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setValue("billingCycle", "MONTHLY")}
                    className={cn(
                      "rounded-full px-5 py-1.5 text-sm font-medium transition-all",
                      billingCycle === "MONTHLY"
                        ? "bg-background shadow text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("billingCycle", "ANNUAL")}
                    className={cn(
                      "rounded-full px-5 py-1.5 text-sm font-medium transition-all",
                      billingCycle === "ANNUAL"
                        ? "bg-background shadow text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Tahunan
                    <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Hemat 20%
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Cards */}
            <div className="grid gap-5 sm:grid-cols-3 flex-1 items-stretch">
              {tiers.map((tier, idx) => {
                const price = displayPrice(tier);
                const limits = getLimits(tier);
                const accentClass = TIER_ACCENT[idx] ?? "text-primary";
                const borderClass = TIER_BORDER[idx] ?? "border-border";
                const btnClass = TIER_BTN[idx] ?? TIER_BTN[1];

                return (
                  <div
                    key={tier.type}
                    className={cn(
                      "relative flex flex-col rounded-2xl border bg-card p-6 transition-all",
                      borderClass,
                    )}
                  >
                    {/* Pro badge */}
                    {tier.type === "PRO" && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-foreground px-3 py-0.5 text-xs font-semibold text-background">
                          Pro
                        </span>
                      </div>
                    )}

                    {/* Tier name */}
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-widest mb-3",
                        accentClass,
                      )}
                    >
                      {tier.name}
                    </p>

                    {/* Price */}
                    <div className="mb-1">
                      {price === 0 ? (
                        <span className="text-4xl font-bold tracking-tight">
                          Gratis
                        </span>
                      ) : (
                        <div className="flex items-baseline gap-1 flex-wrap">
                          <span className="text-4xl font-bold tracking-tight">
                            {formatIDR(price)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /{billingCycle === "ANNUAL" ? "thn" : "bln"}
                          </span>
                        </div>
                      )}
                    </div>

                    {billingCycle === "ANNUAL" && tier.annualPrice > 0 && (
                      <p className="text-xs text-muted-foreground mb-1">
                        ≈ {formatIDR(Math.round(tier.annualPrice / 12))}/bln
                      </p>
                    )}

                    <div className="h-px bg-border my-4" />

                    {/* Limits */}
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                        Batas penggunaan
                      </p>
                      <ul className="space-y-2">
                        {limits.map((l) => (
                          <li
                            key={l.label}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {l.label}
                            </span>
                            <span className={cn("font-semibold", accentClass)}>
                              {l.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Features — always rendered so button stays at bottom */}
                    <div className="h-px bg-border mb-4" />
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                        Fitur termasuk
                      </p>
                      {tier.features.length > 0 ? (
                        <ul className="space-y-2">
                          {tier.features.map((feature) => (
                            <li
                              key={feature}
                              className="flex items-start gap-2 text-sm"
                            >
                              <svg
                                className="mt-0.5 h-4 w-4 shrink-0 text-foreground"
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
                              <span className="text-muted-foreground">
                                {feature}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Manajemen properti & penyewa dasar.
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <button
                      type="button"
                      onClick={() => handleSelectTier(tier.type)}
                      className={cn(
                        "mt-6 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors",
                        btnClass,
                      )}
                    >
                      {price === 0 ? "Mulai Gratis" : `Pilih ${tier.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Account form
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />

      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
        <div className="max-w-lg w-full mx-auto px-4 py-10 lg:py-14 flex flex-col flex-1">
          {/* Selected tier summary */}
          <div className="rounded-2xl border border-border bg-card p-4 mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                Paket dipilih
              </p>
              <p className="font-semibold text-foreground">
                {selectedTierData?.name}{" "}
                <span className="font-normal text-muted-foreground text-sm">
                  {selectedTierData && displayPrice(selectedTierData) > 0
                    ? `— ${formatIDR(displayPrice(selectedTierData))}/${billingCycle === "ANNUAL" ? "thn" : "bln"}`
                    : "— Gratis"}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep("pricing")}
              className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Ganti paket
            </button>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border bg-card p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Buat akun</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Isi detail akun kamu di bawah ini.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Budi Santoso"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="organizationName">Nama Organisasi</Label>
                <Input
                  id="organizationName"
                  {...register("organizationName")}
                  placeholder="Kos Sejahtera"
                  disabled={isLoading}
                />
                {errors.organizationName && (
                  <p className="text-xs text-destructive">
                    {errors.organizationName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="budi@example.com"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                {...register("password")}
                placeholder="Min. 8 karakter"
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold rounded-xl"
              disabled={isLoading}
            >
              {isLoading
                ? "Memproses..."
                : selectedTierData && displayPrice(selectedTierData) > 0
                  ? `Daftar & Bayar ${formatIDR(displayPrice(selectedTierData))}`
                  : "Buat Akun Gratis"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Dengan mendaftar, kamu menyetujui syarat & ketentuan kami.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
