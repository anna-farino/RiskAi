import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../../pages/dashboard/news-capsule/components/news-capsule-navbar';
import { useNewsCapsuleStore } from '@/store/news-capsule-store';
import { useState } from 'react';

export default function NewsCapsuleLayout() {
  const location = useLocation();
  const { setShowExportModal } = useNewsCapsuleStore();
  
  function getActiveNavItem() {
    const urlArray = location.pathname.split('/');
    if (urlArray.length < 4) return '';
    return urlArray[3];
  }
  
  const onExportClick = () => {
    setShowExportModal(true);
  };
  
  return (
    <div className="container mx-auto flex flex-col min-h-screen">
      <Navbar 
        activeItem={getActiveNavItem()} 
        onExportClick={onExportClick}
      />
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}