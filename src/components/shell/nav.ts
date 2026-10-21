import { CircleUserRound, Dumbbell, LayoutGrid, TrendingUp, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should highlight this tab */
  match?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Today', icon: LayoutGrid },
  { href: '/train', label: 'Train', icon: Dumbbell, match: ['/train'] },
  { href: '/progress', label: 'Progress', icon: TrendingUp, match: ['/progress', '/history'] },
  { href: '/profile', label: 'Profile', icon: CircleUserRound, match: ['/profile', '/admin'] },
];

export function isActive(item: NavItem, pathname: string) {
  if (item.href === '/') return pathname === '/';
  return (item.match ?? [item.href]).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
