import { ModeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/ui/logo"

type Props = {
  children: React.ReactNode
  twHeight?: 'h-full' | 'min-h-screen' 
}
export default function AuthLayout(
{ 
  children,
  twHeight='min-h-screen'
}
  : Props
) {

  return (
    <div className={`flex ${twHeight} items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_center,rgba(94,58,162,0.05)_0%,rgba(0,0,0,0)_80%)]`}>
      {false && <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>}
      <div className="w-full max-w-md flex flex-col items-center px-4 sm:px-0">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4">
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                window.location.reload(); 
              }} 
              title="Click to refresh page" 
              className="inline-block"
            >
              <Logo size="lg" interactive variant="gradient" />
            </a>
          </div>
          <p className="text-sm text-slate-400 italic text-center">Secure your tomorrow, today.</p>
        </div>
        <div className="w-full">
          {children}
        </div>
      </div>
    </div>
  )
}
