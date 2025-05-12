import { ModeToggle } from "@/components/theme-toggle"

type Props = {
  children: React.ReactNode
  twHeight?: 'h-full' | 'min-h-screen' 
}
export default function AuthLayout({ 
  children,
  twHeight='min-h-screen'
}: Props) {
  return (
    <div className={`flex ${twHeight} items-center justify-center bg-background`}>
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
