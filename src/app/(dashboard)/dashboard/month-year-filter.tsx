"use client"

import { useRouter } from "next/navigation"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function MonthYearFilter({
  currentMonth,
  currentYear,
}: {
  currentMonth: number
  currentYear: number
}) {
  const router = useRouter()
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => thisYear - 2 + i)

  function handleChange(month: number, year: number) {
    router.push(`/dashboard?month=${month}&year=${year}`)
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={currentMonth}
        onChange={(e) => handleChange(Number(e.target.value), currentYear)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={currentYear}
        onChange={(e) => handleChange(currentMonth, Number(e.target.value))}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
