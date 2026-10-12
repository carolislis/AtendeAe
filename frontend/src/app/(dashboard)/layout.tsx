import { BackendHint } from '@/components/BackendHint';
import { BillingBanner } from '@/components/BillingBanner';
import { DashboardGuard } from '@/components/DashboardGuard';
import { MobileHeader } from '@/components/MobileHeader';
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardGuard>
      <div className="min-h-screen flex w-full flex-col md:flex-row">
        <Sidebar />
        {/* Mobile: cabeçalho fixo */}
        <MobileHeader />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-gray-50/80 pb-24 md:pb-6">
          <BackendHint />
          <BillingBanner />
          {children}
        </main>
      </div>
    </DashboardGuard>
  );
}
