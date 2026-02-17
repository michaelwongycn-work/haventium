"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { EyeIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export interface PasswordInputProps
  extends React.ComponentPropsWithoutRef<"input"> {}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false)

    return (
      <div className="relative w-full">
        <Input
          type={showPassword ? "text" : "password"}
          className={className}
          ref={ref}
          {...props}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setShowPassword((prev) => !prev)}
          tabIndex={-1}
        >
          {showPassword ? (
            <HugeiconsIcon icon={ViewOffSlashIcon} strokeWidth={2} className="h-4 w-4" />
          ) : (
            <HugeiconsIcon icon={EyeIcon} strokeWidth={2} className="h-4 w-4" />
          )}
          <span className="sr-only">
            {showPassword ? "Hide password" : "Show password"}
          </span>
        </Button>
      </div>
    )
  }
)

PasswordInput.displayName = "PasswordInput"
