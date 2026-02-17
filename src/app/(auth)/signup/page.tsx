"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@/lib/zod-resolver"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"

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
})

type SignupForm = z.infer<typeof signupSchema>

const tiers = [
  {
    type: "FREE" as const,
    name: "Free Plan",
    price: "$0",
    period: "/month",
    features: [
      "1 user",
      "1 property",
      "10 tenants",
      "Email notifications",
    ],
  },
  {
    type: "NORMAL" as const,
    name: "Normal Plan",
    price: "$29",
    period: "/month",
    features: [
      "5 users",
      "3 properties",
      "100 tenants",
      "Email & WhatsApp notifications",
    ],
  },
  {
    type: "PRO" as const,
    name: "Pro Plan",
    price: "$99",
    period: "/month",
    features: [
      "Unlimited users",
      "Unlimited properties",
      "Unlimited tenants",
      "All notification channels",
      "Advanced reports",
      "API access",
    ],
  },
]

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      tier: "FREE",
    },
  })

  const selectedTier = watch("tier")

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Signup failed")
      }

      // Redirect to login page after successful signup
      router.push("/login?signup=success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

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
                  <p className="text-sm text-destructive">{errors.name.message}</p>
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
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  {...register("organizationName")}
                  placeholder="Acme Properties"
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
                    <label
                      key={tier.type}
                      className="relative cursor-pointer"
                    >
                      <RadioGroupItem
                        value={tier.type}
                        className="peer sr-only"
                      />
                      <Card className="peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary">
                        <CardHeader>
                          <CardTitle className="text-lg">{tier.name}</CardTitle>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">{tier.price}</span>
                            <span className="text-sm text-muted-foreground">
                              {tier.period}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            {tier.features.map((feature, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-primary">✓</span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </label>
                  ))}
                </div>
              </RadioGroup>
              {errors.tier && (
                <p className="text-sm text-destructive">{errors.tier.message}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex-col space-y-4">
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
  )
}
