import { useEffect } from "react";
import Layout from "@/components/layout/news-capsule-layout";
import { useNewsCapsuleStore } from "@/store/news-capsule-store";
import { Outlet } from "react-router-dom";

export default function NewsCapsuleHome() {
  const {
    allReports,
    setAllReports,
    setShowExportModal,
  } = useNewsCapsuleStore()

  useEffect(() => {
    const savedReportsJson = sessionStorage.getItem('analysisReports');
    if (savedReportsJson) {
      try {
        const savedReports = JSON.parse(savedReportsJson);
        if (Array.isArray(savedReports)) {
          setAllReports(savedReports);
        }
      } catch (e) {
        console.error("Failed to parse saved reports:", e);
      }
    }
    document.addEventListener('openExportModal', handleExportClick);
    return () => {
      document.removeEventListener('openExportModal', handleExportClick);
    };
  }, []);

  // Save reports to sessionStorage when they change
  useEffect(() => {
    if (allReports.length > 0) {
      sessionStorage.setItem('analysisReports', JSON.stringify(allReports));
    }
  }, [allReports]);

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  return (
    <>
      <Layout/>
      <Outlet/>
    </>
  );
}

