import Navbar from '../news-capsule/news-capsule-navbar';
import { useLocation } from 'react-router-dom';
import { useNewsCapsuleStore } from '@/store/news-capsule-store';

export default function NewsCapsuleLayout() {
  const location = useLocation();
  const {
    setShowExportModal
  } = useNewsCapsuleStore()
  
  function getActiveNavItem() {
    const urlArray = location.pathname.split('/')
    if (urlArray.length !== 4) return ''
    else return urlArray[3]
  };
  
  const onExportClick = () => {
    setShowExportModal(true);
  };
  
  return (
    <Navbar 
      activeItem={getActiveNavItem()} 
      onExportClick={onExportClick}
    />
  );
};

