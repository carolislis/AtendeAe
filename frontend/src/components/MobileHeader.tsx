'use client';

import Link from 'next/link';
import { removeToken } from '@/lib/auth';

export function MobileHeader() {
  const handleLogout = () => {
    removeToken();
    window.location.href = '/login';
  };

  return (
    <header className="md:hidden flex-shrink-0 sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 safe-area-top flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary-600">
        <span className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm">A</span>
        Atendeaê
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Sair
      </button>
    </header>
  );
}
