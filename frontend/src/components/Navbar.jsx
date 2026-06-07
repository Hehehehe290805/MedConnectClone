import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import useAuthUser from "../hooks/useAuthUser";
import { BellIcon, BriefcaseMedicalIcon, LogOutIcon, UserIcon, PlusIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import useLogout from "../hooks/useLogout";
import { getUnreadNotificationCount } from "../lib/api";
import SuggestServicePopup from "./SuggestServicePopup";

const Navbar = () => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const { authUser } = useAuthUser();
  const location = useLocation();
  const isChatPage = location.pathname?.startsWith("/chat");

  // const queryClient = useQueryClient();
  // const { mutate: logoutMutation } = useMutation({
  //   mutationFn: logout,
  //   onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authUser"] }),
  // });

  const { logoutMutation } = useLogout();

  const { data: unreadData } = useQuery({
    queryKey: ["notificationUnreadCount"],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30_000,
    enabled: Boolean(authUser),
  });
  const unreadCount = unreadData?.data?.count ?? 0;

  return (
    <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end w-full">
          {/* LOGO - ONLY IN THE CHAT PAGE */}
          {isChatPage && (
            <div className="pl-5">
              <Link to="/" className="flex items-center gap-2.5">
                <BriefcaseMedicalIcon className="size-9 text-primary" />
                <span className="text-primary text-3xl font-bold font-mono tracking-wider">
                  MedConnect
                </span>
              </Link>
            </div>
          )}

          <div className="flex items-center gap-3 sm:gap-4 ml-auto">
            {authUser?.role === "department" && location.pathname === "/services" && (
                <button 
                    className="btn btn-sm btn-primary gap-1"
                    onClick={() => setShowAddService(true)}
                >
                    <PlusIcon className="w-4 h-4" /> Add Service
                </button>
            )}
            <Link to={"/notifications"}>
              <button className="btn btn-ghost btn-circle relative">
                <BellIcon className="h-6 w-6 text-base-content opacity-70" />
                {unreadCount > 0 && (
                  <span className="badge badge-info badge-xs absolute top-1 right-1 pointer-events-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>
          </div>

          {/* TODO */}
          <ThemeSelector />
          <Link to={"/profile"}>
            <button className="btn btn-ghost btn-circle">
                <div className="avatar">
                    <div className="w-9 rounded-full bg-base-300 flex items-center justify-center">
                        {authUser?.profilePic?.url ? (
                            <img src={authUser.profilePic.url} alt="User Avatar" />
                          ) : (
                            <UserIcon className="size-5 text-base-content opacity-50" />
                          )}
                      </div>
                  </div>
              </button>
          </Link>
          
          {/* Logout button */}
          <button className="btn btn-ghost btn-circle" onClick={() => setShowLogoutModal(true)}>
            <LogOutIcon className="h-6 w-6 text-base-content opacity-70" />
          </button>
        </div>
      </div>

      {showLogoutModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-2">Confirm Logout</h3>
            <p className="text-sm opacity-70 mb-4">Are you sure you want to log out?</p>
            <div className="modal-action">
              <button onClick={() => setShowLogoutModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => { logoutMutation(); setShowLogoutModal(false); }} className="btn btn-error">
                Logout
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowLogoutModal(false)} />
        </div>
      )}

      {showAddService && (
          <SuggestServicePopup onClose={() => setShowAddService(false)} />
      )}
    </nav>
  );
};
export default Navbar;