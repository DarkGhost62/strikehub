'use client'

import { useState } from 'react'

type Currency = 'gold' | 'naira' | 'usd'

export default function CurrencySwitcher({
  gold,
  naira,
  usd,
}: {
  gold: number
  naira: number
  usd: number
}) {
  const [currency, setCurrency] = useState<Currency>('gold')

  const values = {
    gold: {
      label: 'GOLD',
      value: gold.toLocaleString(),
      symbol: '🪙',
    },
    naira: {
      label: 'NAIRA',
      value: `₦${naira.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      symbol: '₦',
    },
    usd: {
      label: 'USD',
      value: `$${usd.toFixed(2)}`,
      symbol: '$',
    },
  }

  const current = values[currency]

  return (
    <div className="flex items-center gap-2">

      <div className="hidden rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 sm:block">
        <span className="mr-2 text-xs text-gray-500">
          {current.symbol}
        </span>

        <span className="text-sm font-black text-yellow-400">
          {current.value}
        </span>

        <span className="ml-2 text-[10px] font-bold text-gray-600">
          {current.label}
        </span>
      </div>

      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value as Currency)}
        className="rounded-xl border border-white/10 bg-[#101014] px-3 py-2 text-xs font-bold text-gray-300 outline-none transition focus:border-red-500"
      >
        <option value="gold">🪙 Gold</option>
        <option value="naira">₦ Naira</option>
        <option value="usd">$ USD</option>
      </select>

    </div>
  )
}