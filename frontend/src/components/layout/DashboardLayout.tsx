import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { RisqHeader } from './RisqHeader';
import { MainNavigation } from './MainNavigation';
import { useAuth0 } from '@auth0/auth0-react';

export default function DashboardLayout() {
  const { 
    isAuthenticated, 
    isLoading, 
    user,
    logout
  } = useAuth0()
  const navigate = useNavigate()

  useEffect(()=>{
    if (!isLoading && !isAuthenticated) {
      navigate('/auth/login')
    }
    if (!isLoading && !user?.email_verified) {
      logout({ logoutParams: { returnTo: '' }})
      navigate('/auth/login')
    }
  },[isLoading, isAuthenticated, navigate])


  if (isLoading || !isAuthenticated) return null


  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-gray-900">
      <RisqHeader />
      
      <div className="flex pt-[88px]">
        {/* Sidebar Navigation - hidden on mobile */}
        <aside className="hidden md:block w-64 min-h-[calc(100vh-88px)] border-r border-[#BF00FF]/20 bg-black/80 backdrop-blur-sm fixed">
          <MainNavigation className="py-4 px-2" />
        </aside>
        
        {/* Main Content Area - with sidebar margin on desktop */}
        <main className="flex-1 md:ml-64 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
