import { Outlet } from "react-router-dom";

export default function TechStackLayout() {
  return (
    <div className="flex flex-col w-full h-full gap-y-2">
      <Outlet />
    </div>
  );
}
