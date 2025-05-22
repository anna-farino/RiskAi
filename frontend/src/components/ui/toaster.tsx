import { useToast } from "@/hooks/use-toast"

type ToastProps = {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

export function Toaster() {
  const { toast } = useToast()
  
  function showToast({ title, description, variant = "default" }: ToastProps) {
    toast({
      title,
      description,
      variant
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toast container */}
    </div>
  )
}