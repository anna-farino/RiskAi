import { Outlet, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { RisqHeader } from './RisqHeader';
import { MainNavigation } from './MainNavigation';

export default function DashboardLayout() {
  const { isAuthenticated, isLoading, user } = useAuth0();

  // Show loading while Auth0 is determining authentication state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF00FF] mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated or email not verified
  if (!isAuthenticated || !user?.email_verified) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="min-h-screen bg-black">
      <RisqHeader />

      <div className="flex pt-[100px] lg:pt-[110px] xl:pt-[120px]">
        {/* Sidebar Navigation - hidden on mobile */}
        <aside className="hidden lg:block w-64 min-h-[calc(100vh-110px)] lg:min-h-[calc(100vh-120px)] border-r border-[#BF00FF]/20 bg-black/80 backdrop-blur-sm fixed">
          <MainNavigation className="py-4 px-2" />
        </aside>

        {/* Main Content Area - with sidebar margin on desktop */}
        <main className="flex-1 lg:ml-64 px-4 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
