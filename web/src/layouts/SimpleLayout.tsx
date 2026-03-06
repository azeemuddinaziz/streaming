import Header from "@/components/Header";
import { Outlet } from "react-router-dom";

export default function SimpleLayout() {
  return (
    <div className="flex flex-col h-screen">
      <Header isSimple={true} />
      <Outlet />
    </div>
  );
}
