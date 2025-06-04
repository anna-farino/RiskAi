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
        "bg-gradient-to-r from-[#BF00FF]/80 to-[#00FFFF]/60 backdrop-blur-sm border border-[#BF00FF]/50",
        "text-white hover:text-white hover:from-[#BF00FF] hover:to-[#00FFFF]",
        "transition-all duration-200 ease-in-out",
        "hover:scale-105 active:scale-95",
        "flex items-center justify-center",
        "focus:outline-none focus:ring-2 focus:ring-[#00FFFF]/50"
      )}
      aria-label="Back to top"
      title="Back to top"
    >
      <ChevronUp className="h-10 w-10" />
    </button>
  );
}