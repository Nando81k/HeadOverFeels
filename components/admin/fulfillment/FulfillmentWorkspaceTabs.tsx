'use client'

import type { FulfillmentConsoleTab } from '@/lib/fulfillment/console'

interface FulfillmentWorkspaceTabsProps {
  activeTab: FulfillmentConsoleTab
  tabs: Array<{ key: FulfillmentConsoleTab; label: string }>
  isDisabled: (tab: FulfillmentConsoleTab) => boolean
  onChange: (tab: FulfillmentConsoleTab) => void
}

export function FulfillmentWorkspaceTabs({
  activeTab,
  tabs,
  isDisabled,
  onChange,
}: FulfillmentWorkspaceTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = activeTab === tab.key
        const disabled = isDisabled(tab.key)
        return (
          <button
            key={tab.key}
            onClick={() => {
              if (disabled) return
              onChange(tab.key)
            }}
            disabled={disabled}
            className={`h-8 px-3 rounded-md border text-xs uppercase tracking-[0.12em] ${
              active
                ? 'border-blue-600 bg-blue-600 text-white'
                : disabled
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
