import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen">
      <Header isSimple={false} />
      <div className="flex md:grid grid-cols-[240px_minmax(900px,_1fr)] h-full overflow-hidden">
        <Sidebar />
        <Outlet />
      </div>
    </div>
  );
}
