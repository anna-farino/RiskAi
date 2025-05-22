import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type NavbarProps = {
  activeItem: string;
  onExportClick: () => void;
};

export default function Navbar({ activeItem, onExportClick }: NavbarProps) {
  const navItems = [
    {
      name: "research",
      label: "Capsule Research",
      path: "/dashboard/capsule/research",
    },
    {
      name: "reporting",
      label: "Executive Reporting",
      path: "/dashboard/capsule/reporting",
    },
  ];

  return (
    <div className="flex flex-col w-full gap-8 py-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">News Capsule</h1>
        <p className="text-slate-300 max-w-3xl">
          Scrape and summarize articles for your executive report
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between">
        <nav className="flex space-x-2 overflow-x-auto pb-2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeItem === item.name
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {activeItem === "reporting" && (
          <button
            onClick={onExportClick}
            className={cn(
              "mt-4 sm:mt-0 inline-flex items-center justify-center whitespace-nowrap rounded-md",
              "text-sm font-medium ring-offset-background transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "h-9 px-4 py-2"
            )}
          >
            Export Report
          </button>
        )}
      </div>
    </div>
  );
}