import { useState } from "react";
import { Link } from "react-router";
import { MapPinIcon, StarIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import CreateBookingPopup from "../pages/CreateBookingPopup";
import ViewPendingAppointmentPatientPopup from "../pages/ViewPendingAppointmentPatientPopup";
import CreateDepartmentBookingPopup from "../pages/CreateDepartmentBookingPopup";

const StarRating = ({ value, count }) => {
    if (!value) return null;
    return (
        <div className="flex items-center gap-1 text-xs">
            <StarIcon className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="font-medium">{value.toFixed(1)}</span>
            {count > 0 && <span className="opacity-50">({count})</span>}
        </div>
    );
};

const ProviderCard = ({ provider }) => {
    const [showBooking, setShowBooking] = useState(false);
    const [bookedAppointment, setBookedAppointment] = useState(null);
    const [showAllSpecialties, setShowAllSpecialties] = useState(false);
    const isDoctor = provider.role === "doctor";
    const isDepartment = provider.role === "department";
    const location = [provider.city, provider.province].filter(Boolean).join(", ") || null;

    // Build Google Maps directions URL using coordinates (preferred) or address string
    const getDirectionsUrl = () => {
        const coords = provider.coordinates;
        if (coords?.length === 2) return `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
        const addr = [provider.city, provider.province].filter(Boolean).join(", ");
        if (addr) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
        return null;
    };
    const directionsUrl = getDirectionsUrl();

    return (
        <div className="card bg-base-200 hover:shadow-md transition-shadow h-full">
            <div className="card-body p-4 flex flex-col">
                {/* Header */}
                <div className="flex items-start gap-3 mb-2">
                    <Link to={`/profile/${provider._id}`} className="shrink-0">
                        <div className="relative w-12 h-12">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-base-300 flex items-center justify-center">
                                {provider.profilePic?.url ? (
                                    <img
                                        src={provider.profilePic.url}
                                        alt={isDoctor ? `Dr. ${provider.firstName} ${provider.lastName}` : isDepartment ? `${provider.rootInstitute?.instituteName} - ${provider.departmentTypeName}` : provider.instituteName}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-lg">{isDoctor ? "👨‍⚕️" : isDepartment ? "🔬" : "🏥"}</span>
                                )}
                            </div>
                            {isDoctor && (
                                <span
                                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-base-200 ${provider.isOnline ? "bg-success" : "bg-base-content/30"}`}
                                    title={provider.isOnline ? "Online" : "Offline"}
                                />
                            )}
                        </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                        <Link to={`/profile/${provider._id}`} className="hover:text-primary transition-colors">
                            <h3 className="font-semibold text-sm leading-tight truncate">
                                {isDoctor
                                    ? `Dr. ${provider.firstName} ${provider.lastName}`
                                    : isDepartment
                                        ? `${provider.rootInstitute?.instituteName} - ${provider.departmentTypeName}`
                                        : provider.instituteName}
                            </h3>
                        </Link>

                        {isDoctor && provider.sex && (
                            <span className="badge badge-ghost badge-xs capitalize mt-0.5">{provider.sex}</span>
                        )}
                        {!isDoctor && provider.instituteType && (
                            <span className={`badge badge-xs capitalize mt-0.5 ${provider.instituteType === "hospital" ? "badge-warning" : "badge-info"}`}>
                                {provider.instituteType}
                            </span>
                        )}
                    </div>
                </div>

                {/* Specialties / Department Types */}
                {isDoctor && provider.specialties?.length > 0 && (
                    <div className="mb-2">
                        <div className="flex flex-wrap gap-1.5">
                            {(showAllSpecialties ? provider.specialties : provider.specialties.slice(0, 3)).map((s) => (
                                <span key={s} className="badge badge-primary badge-sm font-medium text-xs">{s}</span>
                            ))}
                        </div>
                        {provider.specialties.length > 3 && (
                            <button
                                className="btn btn-ghost btn-xs mt-1 gap-1 opacity-60 px-0 h-auto min-h-0 py-0.5"
                                onClick={(e) => { e.preventDefault(); setShowAllSpecialties(p => !p); }}
                            >
                                {showAllSpecialties
                                    ? <><ChevronUpIcon className="size-3" /> Show less</>
                                    : <><ChevronDownIcon className="size-3" /> +{provider.specialties.length - 3} more</>
                                }
                            </button>
                        )}
                    </div>
                )}

                {!isDoctor && !isDepartment && provider.departmentTypes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {provider.departmentTypes.slice(0, 3).map((d) => (
                            <span key={d} className="badge badge-secondary badge-sm">{d}</span>
                        ))}
                        {provider.departmentTypes.length > 3 && (
                            <span className="badge badge-ghost badge-sm">+{provider.departmentTypes.length - 3}</span>
                        )}
                    </div>
                )}

                {isDepartment && provider.services?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {provider.services.slice(0, 3).map((s) => (
                            <span key={s} className="badge badge-secondary badge-sm">{s}</span>
                        ))}
                        {provider.services.length > 3 && (
                            <span className="badge badge-ghost badge-sm">+{provider.services.length - 3}</span>
                        )}
                    </div>
                )}

                {/* Languages (doctor only) */}
                {isDoctor && provider.languages?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {provider.languages.slice(0, 3).map((l) => (
                            <span key={l} className="badge badge-outline badge-sm">{l}</span>
                        ))}
                    </div>
                )}

                {/* Location + Distance */}
                {(location || provider.distanceKm != null) && (
                    <div className="flex items-center gap-1 text-xs opacity-60 mb-2">
                        <MapPinIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                            {location}
                            {provider.distanceKm != null && (
                                <span className="ml-1 text-primary font-medium">· {provider.distanceKm} km away</span>
                            )}
                        </span>
                    </div>
                )}

                {/* Rating */}
                <StarRating value={provider.averageRating} count={provider.reviewCount} />

                {/* Price */}
                <div className="mt-auto pt-2">
                    {isDoctor && provider.price != null && (
                        <p className="text-sm font-semibold text-primary">₱{provider.price.toLocaleString("en-PH")}</p>
                    )}
                    {!isDoctor && provider.priceRange && (
                        <p className="text-sm font-semibold text-primary">
                            ₱{provider.priceRange.min.toLocaleString("en-PH")}
                            {provider.priceRange.min !== provider.priceRange.max && ` – ₱${provider.priceRange.max.toLocaleString("en-PH")}`}
                        </p>
                    )}

                    {(isDoctor || isDepartment) && (
                        <button
                            className={`btn btn-sm w-full mt-2 ${provider.isFullToday ? "btn-disabled opacity-50 cursor-not-allowed" : "btn-primary"}`}
                            onClick={() => !provider.isFullToday && setShowBooking(true)}
                            disabled={provider.isFullToday}
                            title={provider.isFullToday ? "This doctor has reached their patient limit for today" : ""}
                        >
                            {provider.isFullToday ? "Fully Booked Today" : "Book Now"}
                        </button>
                    )}
                    {directionsUrl && (
                        <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm w-full mt-1 gap-1"
                        >
                            <MapPinIcon className="w-3.5 h-3.5" />
                            Get Directions
                        </a>
                    )}
                </div>
            </div>

            {showBooking && (
                <CreateBookingPopup
                    provider={provider}
                    onClose={() => setShowBooking(false)}
                    onBookingCreated={(appt) => { setShowBooking(false); setBookedAppointment(appt); }}
                />
            )}

            {bookedAppointment && (
                <ViewPendingAppointmentPatientPopup
                    appointment={bookedAppointment}
                    onClose={() => setBookedAppointment(null)}
                    onUpdated={() => {}}
                />
            )}
        </div>
    );
};

export default ProviderCard;
