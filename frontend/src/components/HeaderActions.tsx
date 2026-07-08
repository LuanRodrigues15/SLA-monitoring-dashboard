import { ThemeToggle } from './ThemeToggle'
import { UserMenuButton } from './UserMenuButton'

export function HeaderActions() {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <ThemeToggle />
      <UserMenuButton />
    </div>
  )
}
