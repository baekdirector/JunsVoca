import { Link, useLocation } from 'react-router-dom'
import { BookIcon, ChartIcon, HomeIcon } from './icons'

export function BottomNav() {
  const { pathname } = useLocation()

  const items = [
    { to: '/', label: '홈', icon: HomeIcon, active: pathname === '/' },
    { to: '/wordsets', label: '단어장', icon: BookIcon, active: pathname.startsWith('/wordsets') },
    { to: '/parent', label: '결과', icon: ChartIcon, active: pathname.startsWith('/parent') },
  ]

  return (
    <div className="flex h-[72px] flex-none border-t border-border bg-surface">
      {items.map(({ to, label, icon: Icon, active }) => (
        <Link
          key={to}
          to={to}
          className={`flex flex-1 flex-col items-center justify-center gap-1 ${active ? 'text-primary' : 'text-ink-muted'}`}
        >
          <div className={`mb-0.5 h-[3px] w-6 rounded ${active ? 'bg-primary' : 'bg-transparent'}`} />
          <Icon width={21} height={21} />
          <span className={`text-[11px] ${active ? 'font-bold' : ''}`}>{label}</span>
        </Link>
      ))}
    </div>
  )
}
