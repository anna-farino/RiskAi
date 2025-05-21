import { useLoaderData } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { RisqHeader } from "./RisqHeader";
import { RisqFooter } from "./RisqFooter";

// Import the navigation styles
import "@/styles/navigation.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = useLoaderData();
  const { data: userData } = useAuth();
  
  //console.log("User data from dashboard layout", userData)

  return (
    <div className="min-h-screen bg-background dark:bg-slate-900 overflow-x-hidden flex flex-col">
      {/* Header with brand logo and tagline */}
      <RisqHeader />
      
      {/* Main content area */}
      <main className="flex-1 mx-auto mt-[60px] w-full max-w-7xl px-4 py-4 pt-20 sm:py-6 pb-12">
        {children}
      </main>
      
      {/* Footer with brand logo and tagline */}
      <RisqFooter />
    </div>
  );
}
