import { NavLink } from 'react-router'
import type { LucideIcon } from 'lucide-react'

export interface BottomNavItem {
  label: string
  path: string
  icon: LucideIcon
}

interface BottomNavProps {
  items: BottomNavItem[]
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-bg-1">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path.split('/').length <= 2}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-fg-2 hover:text-fg-1'
                }`
              }
            >
              <Icon size={20} strokeWidth={1.5} />
              {item.label}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
