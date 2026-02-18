"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
});

type SignupForm = z.infer<typeof signupSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SignupForm({ tiers }: { tiers: TierData[] }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultTier = (tiers[0]?.type ?? "FREE") as "FREE" | "NORMAL" | "PRO";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { tier: defaultTier },
  });

  const selectedTier = watch("tier");

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    setError(null);

    // Fire Meta Pixel — price drives the event, no hardcoding
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

      router.push("/login?signup=success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Get started with Haventium - Rental Property CRM
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="John Doe"
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="john@example.com"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  {...register("password")}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  {...register("organizationName")}
                  placeholder="Kos Ku"
                  disabled={isLoading}
                />
                {errors.organizationName && (
                  <p className="text-sm text-destructive">
                    {errors.organizationName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Select Plan</Label>
              <RadioGroup
                value={selectedTier}
                onValueChange={(value) =>
                  setValue("tier", value as "FREE" | "NORMAL" | "PRO")
                }
                disabled={isLoading}
              >
                <div className="grid gap-4 md:grid-cols-3">
                  {tiers.map((tier) => (
                    <label key={tier.type} className="relative cursor-pointer">
                      <RadioGroupItem
                        value={tier.type}
                        className="peer sr-only"
                      />
                      <Card className="peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary">
                        <CardHeader>
                          <CardTitle className="text-lg">{tier.name}</CardTitle>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">
                              {tier.monthlyPrice === 0
                                ? "Free"
                                : `Rp ${tier.monthlyPrice.toLocaleString("id-ID")}`}
                            </span>
                            {tier.monthlyPrice > 0 && (
                              <span className="text-sm text-muted-foreground">
                                /month
                              </span>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {tier.features.length > 0 ? (
                              tier.features.map((feature, index) => (
                                <li
                                  key={index}
                                  className="flex items-start gap-2"
                                >
                                  <span className="text-primary">✓</span>
                                  <span>{feature}</span>
                                </li>
                              ))
                            ) : (
                              <>
                                <li className="flex items-start gap-2">
                                  <span className="text-primary">✓</span>
                                  <span>
                                    {tier.maxUsers === -1
                                      ? "Unlimited users"
                                      : `${tier.maxUsers} user${tier.maxUsers !== 1 ? "s" : ""}`}
                                  </span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <span className="text-primary">✓</span>
                                  <span>
                                    {tier.maxProperties === -1
                                      ? "Unlimited properties"
                                      : `${tier.maxProperties} propert${tier.maxProperties !== 1 ? "ies" : "y"}`}
                                  </span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <span className="text-primary">✓</span>
                                  <span>
                                    {tier.maxTenants === -1
                                      ? "Unlimited tenants"
                                      : `${tier.maxTenants} tenants`}
                                  </span>
                                </li>
                              </>
                            )}
                          </ul>
                        </CardContent>
                      </Card>
                    </label>
                  ))}
                </div>
              </RadioGroup>
              {errors.tier && (
                <p className="text-sm text-destructive">
                  {errors.tier.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex-col space-y-4 mt-6">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
