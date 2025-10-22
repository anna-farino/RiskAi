import { useState, useEffect, useRef } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(true); // Controls fade in/out
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const toggleVisibility = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const shouldBeVisible = scrollTop > 300;
      
      setIsVisible(shouldBeVisible);
      
      if (shouldBeVisible) {
        // Show button when scrolling
        setIsActive(true);
        
        // Clear existing timer
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        
        // Set new timer to hide after 3 seconds of inactivity
        hideTimerRef.current = setTimeout(() => {
          setIsActive(false);
        }, 3000);
      }
    };

    // Check on mount
    toggleVisibility();

    // Add scroll listener
    window.addEventListener("scroll", toggleVisibility, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", toggleVisibility);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
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
        "fixed bottom-8 right-8 z-[60]",
        "h-14 w-14 sm:h-14 sm:w-14 rounded-full shadow-xl",
        "bg-[#BF00FF]/80 backdrop-blur-sm border border-[#BF00FF]/50",
        "text-white hover:text-black hover:bg-[#00FFFF]",
        "transition-all duration-500 ease-in-out",
        "hover:scale-105 active:scale-95",
        "flex items-center justify-center",
        "focus:outline-none focus:ring-2 focus:ring-[#00FFFF]/50",
        // Smart auto-hide: fade out after 3 seconds of scroll inactivity
        isActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      aria-label="Back to top"
      title="Back to top"
    >
      <ChevronUp className="h-10 w-10" />
    </button>
  );
}