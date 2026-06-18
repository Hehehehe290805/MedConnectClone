import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import useAuthUser from "../hooks/useAuthUser";
import { BellIcon, BriefcaseMedicalIcon, LogOutIcon, UserIcon, PlusIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import useLogout from "../hooks/useLogout";
import { getUnreadNotificationCount } from "../lib/api";
import SuggestServicePopup from "./SuggestServicePopup";

const Navbar = ({ offsetSidebar = false }) => {
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAddService, setShowAddService] = useState(false);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const { authUser } = useAuthUser();
  const location = useLocation();
  const isChatPage = location.pathname?.startsWith("/chat");
  const profilePicUrl = authUser?.profilePic?.url;

  useEffect(() => {
    setProfileImageFailed(false);
  }, [profilePicUrl]);

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
    <nav className={`fixed top-0 right-0 ${offsetSidebar ? "left-0 lg:left-64" : "left-0"} bg-primary text-primary-content border-b-2 border-primary/30 shadow-[0_3px_14px_rgba(47,112,186,0.28)] z-40 h-20 flex items-center`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end w-full">
          {/* LOGO - ONLY IN THE CHAT PAGE */}
          {isChatPage && (
            <div className="pl-5">
              <Link to="/" className="flex items-center gap-2.5">
                <BriefcaseMedicalIcon className="size-9 text-primary-content" />
                <span className="text-primary-content text-3xl font-bold font-mono tracking-wider">
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
                <BellIcon className="h-6 w-6 text-primary-content opacity-90" />
                {unreadCount > 0 && (
                  <span className="badge bg-red-500 text-white border-red-500 badge-xs absolute top-1 right-1 pointer-events-none">
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
                    <div className="w-9 rounded-full bg-base-300 border-2 border-primary-content/70 shadow-sm flex items-center justify-center">
                        {profilePicUrl && !profileImageFailed ? (
                            <img src={profilePicUrl} alt="User Avatar" onError={() => setProfileImageFailed(true)} />
                          ) : (
                            <UserIcon className="size-5 text-base-content opacity-50" />
                          )}
                      </div>
                  </div>
              </button>
          </Link>
          
          {/* Logout button */}
          <button className="btn btn-ghost btn-circle" onClick={() => setShowLogoutModal(true)}>
            <LogOutIcon className="h-6 w-6 text-primary-content opacity-90" />
          </button>
        </div>
      </div>

      {showLogoutModal && (
        <div className="modal modal-open">
          <div className="modal-box text-base-content">
            <h3 className="font-bold text-lg mb-2">Confirm Logout</h3>
            <p className="text-sm opacity-70 mb-4">Are you sure you want to log out?</p>
            <div className="modal-action">
              <button onClick={() => setShowLogoutModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => { logoutMutation(); setShowLogoutModal(false); }} className="btn btn-primary">
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
