import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import VirtualJoinPrompt from "./VirtualJoinPrompt";
import ChatbotWidget from "./ChatbotWidget";

const Layout = ({ showSidebar = true }) => {
  return (
    <div className="min-h-screen">
      <div className="flex">
        {showSidebar && <Sidebar />}

        <div className="flex-1 flex flex-col">
          <Navbar />

          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Global virtual call join prompt — appears when a virtual appointment starts */}
      <VirtualJoinPrompt />

      {/* AI Assistant — fixed bottom-right, all authenticated pages */}
      <ChatbotWidget />
    </div>
  );
};

export default Layout;
