import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"

type Props = {
  setStateFn: (b: any) => void,
  state: boolean,
  top?: number
}
export default function PasswordEye({ setStateFn, state, top }: Props) {

  return (
    <div
      onClick={() => setStateFn((prev: boolean) => !prev)}
      className={cn(
        "absolute right-4",
        "z-10 text-muted-foreground hover:text-foreground cursor-pointer",
        "bg-transparent hover:border-none hover:shadow-none"
      )}
      style={{
        top: `${top ? top : 31}px`
      }}
      tabIndex={-1}
    >
      {state ? <EyeOff size={18} /> : <Eye size={18} />}
    </div>
  )
}
