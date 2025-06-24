import { Logo } from '@/components/ui/logo';

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
      {/* Logo with subtle animation */}
      <div className="mb-6 animate-pulse">
        <Logo size="lg" variant="gradient" />
      </div>
      
      {/* Animated spinner with brand gradient */}
      <div className="relative">
        <div className="w-8 h-8 border-2 border-transparent rounded-full animate-spin">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] opacity-75"></div>
          <div className="absolute inset-1 rounded-full bg-black"></div>
        </div>
      </div>
      
      {/* Loading text with brand styling */}
      <p className="mt-4 text-sm text-gray-300 font-light tracking-wide">
        Loading...
      </p>
    </div>
  );
}