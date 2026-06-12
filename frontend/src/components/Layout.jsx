import { useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import VirtualJoinPrompt from "./VirtualJoinPrompt";
import ChatbotWidget from "./ChatbotWidget";
import useCallStore from "../store/useCallStore";
import { VideoIcon, XIcon } from "lucide-react";

const PiPOverlay = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeCallId, clearActiveCallId } = useCallStore();
  const [pos, setPos] = useState({ x: 20, y: 80 });
  const dragRef = useRef(null);
  const didDragRef = useRef(false);

  if (!activeCallId || location.pathname.startsWith("/call/")) return null;

  const handleMouseDown = (e) => {
    if (e.target.closest("[data-dismiss]")) return;
    didDragRef.current = false;
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };

    const handleMove = (me) => {
      didDragRef.current = true;
      setPos({ x: me.clientX - dragRef.current.startX, y: me.clientY - dragRef.current.startY });
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleClick = () => {
    if (!didDragRef.current) navigate(`/call/${activeCallId}`);
  };

  return (
    <div
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999 }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="bg-success text-success-content rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 cursor-grab select-none animate-bounce-once"
    >
      <VideoIcon className="size-5 shrink-0 animate-pulse" />
      <div>
        <p className="text-sm font-semibold">Call in progress</p>
        <p className="text-xs opacity-80">Click to return</p>
      </div>
      <button
        data-dismiss="true"
        className="btn btn-ghost btn-xs btn-circle text-success-content hover:bg-success-content/20"
        onClick={(e) => { e.stopPropagation(); clearActiveCallId(); }}
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
};

const Layout = ({ showSidebar = true }) => {
  return (
    <div className="min-h-screen">
      <div className="flex">
        {showSidebar && <Sidebar />}

        <div className="flex-1 flex flex-col">
          <Navbar offsetSidebar={showSidebar} />

          <main className="flex-1 overflow-y-auto pt-20">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Global virtual call join prompt — appears when a virtual appointment starts */}
      <VirtualJoinPrompt />

      {/* Draggable PiP overlay — shown when navigating away from an active call */}
      <PiPOverlay />

      {/* AI Assistant — fixed bottom-right, all authenticated pages */}
      <ChatbotWidget />
    </div>
  );
};

export default Layout;
