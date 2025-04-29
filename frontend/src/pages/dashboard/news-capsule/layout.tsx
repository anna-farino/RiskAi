import { cn } from "@/lib/utils";
import { Link, Outlet, useLocation } from "react-router-dom";


const buttons = [
  {
    label: 'Home',
    url: '/dashboard/capsule/home'
  },
  {
    label: 'Reports',
    url: '/dashboard/capsule/reports'
  },
]

export default function NewsLayout() {
  const location = useLocation().pathname.split('/')[3]

  return (
    <div className="flex flex-col w-full h-full gap-y-4">
      <div className={cn(
        "flex flex-row w-full",
        "min-h-[40px] max-h-[40px] p-4 rounded-md items-center gap-x-10 bg-primary-foreground",
        "font-light"
      )}>
        {buttons.map(button => {
          const selected = location === button.label.toLowerCase()

          return (
            <Link
              to={button.url}
              key={button.label}
              className={cn("hover:underline", {
                "text-orange-400": selected
              })} 
            >
              {button.label}
            </Link>
          )
        })}
      </div>
      <Outlet/>
    </div>
  )
}
