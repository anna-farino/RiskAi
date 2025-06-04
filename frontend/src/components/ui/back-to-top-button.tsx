import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsVisible(scrollTop > 300);
    };

    // Check on mount
    toggleVisibility();

    // Add scroll listener
    window.addEventListener("scroll", toggleVisibility, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={cn(
        "fixed bottom-4 right-[100px] sm:bottom-6 sm:right-[100px] z-[60]",
        "h-12 w-12 sm:h-10 sm:w-10 rounded-full shadow-xl",
        "bg-slate-900/90 backdrop-blur-sm border border-slate-700/50",
        "text-[#BF00FF] hover:text-[#00FFFF] hover:bg-slate-800",
        "transition-all duration-200 ease-in-out",
        "hover:scale-105 active:scale-95",
        "flex items-center justify-center",
        "focus:outline-none focus:ring-2 focus:ring-[#00FFFF]/50"
      )}
      aria-label="Back to top"
      title="Back to top"
    >
      <ChevronUp className="h-8 w-8" />
    </button>
  );
}