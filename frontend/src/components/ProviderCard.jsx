import { useState } from "react";
import { Link } from "react-router";
import { MapPinIcon, StarIcon } from "lucide-react";
import CreateBookingPopup from "../pages/CreateBookingPopup";
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
                    <div className="flex flex-wrap gap-1 mb-2">
                        {provider.specialties.slice(0, 3).map((s) => (
                            <span key={s} className="badge badge-primary badge-xs">{s}</span>
                        ))}
                        {provider.specialties.length > 3 && (
                            <span className="badge badge-ghost badge-xs">+{provider.specialties.length - 3}</span>
                        )}
                    </div>
                )}

                {!isDoctor && !isDepartment && provider.departmentTypes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {provider.departmentTypes.slice(0, 3).map((d) => (
                            <span key={d} className="badge badge-secondary badge-xs">{d}</span>
                        ))}
                        {provider.departmentTypes.length > 3 && (
                            <span className="badge badge-ghost badge-xs">+{provider.departmentTypes.length - 3}</span>
                        )}
                    </div>
                )}

                {isDepartment && provider.services?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {provider.services.slice(0, 3).map((s) => (
                            <span key={s} className="badge badge-secondary badge-xs">{s}</span>
                        ))}
                        {provider.services.length > 3 && (
                            <span className="badge badge-ghost badge-xs">+{provider.services.length - 3}</span>
                        )}
                    </div>
                )}

                {/* Languages (doctor only) */}
                {isDoctor && provider.languages?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {provider.languages.slice(0, 3).map((l) => (
                            <span key={l} className="badge badge-outline badge-xs">{l}</span>
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
                            className="btn btn-primary btn-sm w-full mt-2"
                            onClick={() => setShowBooking(true)}
                        >
                            Book Now
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

            {showBooking && isDoctor && (
                <CreateBookingPopup provider={provider} onClose={() => setShowBooking(false)} />
            )}
            {showBooking && isDepartment && (
                <CreateDepartmentBookingPopup provider={provider} onClose={() => setShowBooking(false)} />
            )}
        </div>
    );
};

export default ProviderCard;
