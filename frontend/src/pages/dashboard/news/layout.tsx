import { cn } from "@/lib/utils";
import { setSeconds } from "date-fns";
import { useState } from "react";
import { Link, Outlet } from "react-router-dom";


const buttons = [
  {
    label: 'Home',
    url: '/dashboard/news/home'
  },
  {
    label: 'Keywords',
    url: '/dashboard/news/keywords'
  },
  {
    label: 'Sources',
    url: '/dashboard/news/sources'
  },
]

export default function NewsLayout() {
  const pathnameSegments = window.location.pathname.split('/')
  const [ section, setSection ] = useState(pathnameSegments[3])

  return (
    <div className="flex flex-col w-full h-full gap-y-4">
      <div className={cn(
        "flex flex-row w-full",
        "min-h-[40px] max-h-[40px] p-4 rounded-md items-center gap-x-10 bg-primary-foreground",
        "font-light"
      )}>
        {buttons.map(button => {
          const selected = section === button.label.toLowerCase()

          return (
            <Link
              to={button.url}
              key={button.label}
              className={cn("hover:underline", {
                "text-orange-400": selected
              })} 
              onClick={()=>setSection(button.label.toLowerCase())}
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
