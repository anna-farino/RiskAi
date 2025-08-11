import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { RisqHeader } from './RisqHeader';
import { MainNavigation } from './MainNavigation';
import { useAuth0 } from '@auth0/auth0-react';
import { toast } from '@/hooks/use-toast';

export default function DashboardLayout() {
  const { 
    isAuthenticated, 
    isLoading, 
    user,
    logout
  } = useAuth0()
  const navigate = useNavigate()

  function checkAuth() {
    if (!isLoading && !isAuthenticated) {
      navigate('/auth/login')
      return
    }
    if (!isLoading && !user?.email_verified) {
      navigate('/auth/login')
    }
  }
  useEffect(()=>{
    checkAuth()
  },[isLoading, isAuthenticated, navigate])


  if (isLoading || !isAuthenticated) return null


  return (
    <div className="min-h-screen bg-black">
      <RisqHeader />
      
      <div className="flex pt-[100px] md:pt-[110px] lg:pt-[120px]">
        {/* Sidebar Navigation - hidden on mobile */}
        <aside className="hidden md:block w-64 min-h-[calc(100vh-110px)] lg:min-h-[calc(100vh-120px)] border-r border-[#BF00FF]/20 bg-black/80 backdrop-blur-sm fixed">
          <MainNavigation className="py-4 px-2" />
        </aside>
        
        {/* Main Content Area - with sidebar margin on desktop */}
        <main className="flex-1 md:ml-64 px-4 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
