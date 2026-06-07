import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import useAuthUser from "../hooks/useAuthUser";
import toast from "react-hot-toast";
import { SearchIcon, ClockIcon } from "lucide-react";

const ClaimServicesPopup = ({ onClose }) => {
    const { authUser } = useAuthUser();
    const [services, setServices] = useState([]);
    const [claimed, setClaimed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [durations, setDurations] = useState({});
    const [claiming, setClaiming] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [servicesRes, claimedRes] = await Promise.all([
                    axiosInstance.get(`/services/${authUser.departmentType}/services`),
                    axiosInstance.get("/services/my-services"),
                ]);
                setServices(servicesRes.data.data?.items || []);
                setClaimed(claimedRes.data.data?.services || []);
            } catch {
                toast.error("Failed to load services.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authUser.departmentType]);

    const claimedIds = new Set(claimed.map(c => c.serviceId?._id?.toString()));
    const available = services.filter(s => !claimedIds.has(s._id.toString()));
    const filtered = available.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase())
    );

    const handleDurationChange = (serviceId, val) => {
        if (/^\d*$/.test(val)) {
            setDurations(prev => ({ ...prev, [serviceId]: val }));
        }
    };

    const handleClaim = async (serviceId, serviceName) => {
        const duration = parseInt(durations[serviceId]);
        if (!duration || duration < 1) {
            return toast.error("Enter a valid duration in minutes.");
        }
        setClaiming(serviceId);
        try {
            await axiosInstance.post("/services/claim", {
                targetId: serviceId,
                durationMinutes: duration,
            });
            toast.success(`"${serviceName}" claimed. Waiting for admin approval.`);
            setClaimed(prev => [...prev, { serviceId: { _id: serviceId }, status: "pending" }]);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to claim service.");
        } finally {
            setClaiming(null);
        }
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <button
                    onClick={onClose}
                    className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                >✕</button>

                <h3 className="font-bold text-lg mb-1">Claim Existing Service</h3>
                <p className="text-sm opacity-60 mb-4">
                    Select a service your department offers and set its average duration.
                </p>

                <div className="relative mb-4">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-40" />
                    <input
                        type="text"
                        placeholder="Search services..."
                        className="input input-bordered w-full pl-9"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <span className="loading loading-spinner loading-md" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-sm opacity-40 text-center py-8">
                            {available.length === 0
                                ? "All available services have already been claimed."
                                : "No services match your search."}
                        </p>
                    ) : (
                        filtered.map(service => (
                            <div
                                key={service._id}
                                className="flex items-center gap-3 bg-base-200 rounded-xl px-4 py-3"
                            >
                                <span className="text-sm font-medium flex-1 truncate">{service.name}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <ClockIcon className="size-4 opacity-40" />
                                    <input
                                        type="text"
                                        placeholder="min"
                                        className="input input-bordered input-sm w-20 text-center"
                                        value={durations[service._id] || ""}
                                        onChange={e => handleDurationChange(service._id, e.target.value)}
                                        disabled={claiming === service._id}
                                    />
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleClaim(service._id, service.name)}
                                        disabled={claiming === service._id}
                                    >
                                        {claiming === service._id
                                            ? <span className="loading loading-spinner loading-xs" />
                                            : "Claim"}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="modal-action mt-4">
                    <button className="btn btn-ghost" onClick={onClose}>Done</button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

export default ClaimServicesPopup;
