'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconMenu, IconCart, IconWhatsApp, IconLogout, IconTruck, IconCreditCard } from './Icons';
import { removeToken } from '@/lib/auth';

const nav = [
  { href: '/', label: 'Início', Icon: IconHome },
  { href: '/cardapio', label: 'Cardápio', Icon: IconMenu },
  { href: '/pedidos', label: 'Pedidos', Icon: IconCart },
  { href: '/motoboys', label: 'Motoboys', Icon: IconTruck },
  { href: '/bot', label: 'Bot', Icon: IconWhatsApp },
  { href: '/assinatura', label: 'Assinatura', Icon: IconCreditCard },
];

function NavLink({
  href,
  label,
  Icon,
  isActive,
  compact,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  compact?: boolean;
}) {
  const base = 'flex items-center justify-center gap-2 font-medium transition-all duration-200';
  const desktopActive = 'bg-primary-600 text-white shadow-lg shadow-primary-900/30';
  const desktopInactive = 'text-gray-400 hover:bg-white/5 hover:text-white';
  const mobileActive = 'text-primary-500';
  const mobileInactive = 'text-gray-500';

  if (compact) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-2 px-1 rounded-lg active:bg-gray-100 ${
          isActive ? mobileActive : mobileInactive
        }`}
        aria-label={label}
      >
        <Icon className="w-6 h-6 flex-shrink-0" />
        <span className="text-[10px] truncate w-full text-center">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${base} ${
        isActive ? desktopActive : desktopInactive
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: sidebar lateral */}
      <aside className="hidden md:flex w-60 min-h-screen flex-col bg-gradient-to-b from-gray-900 to-gray-800 text-white shadow-xl flex-shrink-0">
        <div className="p-6 border-b border-white/10">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-xl text-primary-400 hover:text-primary-300 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-primary-600/90 flex items-center justify-center text-white font-bold shadow-lg">
              A
            </span>
            Atendeaê
          </Link>
          <p className="text-xs text-gray-400 mt-2 ml-11">Dashboard</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ href, label, Icon }) => {
            const isActive =
              pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <NavLink
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                isActive={isActive}
              />
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={() => {
              removeToken();
              window.location.href = '/login';
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm w-full text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-200"
          >
            <IconLogout className="w-5 h-5 flex-shrink-0" />
            Sair
          </button>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <IconWhatsApp className="w-4 h-4 text-[#25D366]" />
            Cardápio digital via WhatsApp
          </div>
        </div>
      </aside>

      {/* Mobile: barra inferior fixa */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch bg-white border-t border-gray-200 safe-area-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        {nav.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <NavLink
              key={href}
              href={href}
              label={label}
              Icon={Icon}
              isActive={isActive}
              compact
            />
          );
        })}
      </nav>
    </>
  );
}
