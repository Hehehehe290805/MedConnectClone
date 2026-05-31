// frontend/src/components/MapPinModal.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { MapPinIcon, XIcon, CheckIcon, LoaderIcon, SearchIcon } from "lucide-react";

async function reverseGeocode(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "MedConnect/1.0 (medconnect-112605.me)" },
    });
    if (!res.ok) throw new Error("Reverse geocode failed");
    return res.json();
}

export async function forwardGeocode(addressParts) {
    const { street, barangay, city, province, postalCode } = addressParts;
    // fallback chain — try progressively broader queries until one resolves
    const attempts = [
        [street, barangay, city, province, postalCode],
        [barangay, city, province, postalCode],
        [city, province, postalCode],
        [city, province],
        [city],
    ];
    
    for (const parts of attempts) {
        const q = [...parts.filter(Boolean), "Philippines"].join(", ");
        if (!q.trim() || q === "Philippines") continue;
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=ph`;
            const res = await fetch(url, {
                headers: { "Accept-Language": "en", "User-Agent": "MedConnect/1.0 (medconnect-112605.me)" },
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (data.length) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } catch {
            continue;
        }
    }
    return null;
}

async function searchPlace(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Philippines")}&limit=5&countrycodes=ph&addressdetails=1`;
    const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "MedConnect/1.0 (medconnect-112605.me)" },
    });
    if (!res.ok) return [];
    return res.json();
}

function parseNominatimAddress(nominatimData) {
    const a = nominatimData.address || {};
    return {
        street: a.road || a.pedestrian || a.footway || "",
        barangay: a.suburb || a.village || a.neighbourhood || a.quarter || "",
        city: a.city || a.town || a.municipality || a.county || "",
        // province intentionally omitted — Nominatim returns unreliable values for PH (e.g. region codes)
        postalCode: a.postcode || "",
    };
}

let leafletLoadPromise = null;
function loadLeaflet() {
    if (leafletLoadPromise) return leafletLoadPromise;
    leafletLoadPromise = new Promise((resolve, reject) => {
        if (window.L) { resolve(window.L); return; }
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve(window.L);
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return leafletLoadPromise;
}

const DEFAULT_CENTER = [14.5995, 120.9842];
const DEFAULT_ZOOM = 13;

const MapPinModal = ({ isOpen, onClose, onConfirm }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    const pinIconRef = useRef(null);
    const [leafletReady, setLeafletReady] = useState(false);
    const [pin, setPin] = useState(null);
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const searchTimeoutRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        loadLeaflet()
            .then(() => setLeafletReady(true))
            .catch(() => setGeocodeError("Failed to load map. Check your connection."));
    }, [isOpen]);

    // Initialize map every time modal opens — destroy on close
    // fixes blank screen on second open caused by stale map instance
    useEffect(() => {
        if (!isOpen || !leafletReady || !mapRef.current) return;

        const L = window.L;
        const map = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        const icon = L.divIcon({
            className: "",
            html: `<div style="
                width:32px;height:32px;
                background:#570df8;
                border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);
                border:3px solid white;
                box-shadow:0 2px 8px rgba(0,0,0,0.4);
            "></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
        });
        pinIconRef.current = icon;

        map.on("click", (e) => {
            const { lat, lng } = e.latlng;
            setPin({ lat, lng });
            setGeocodeError("");
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            } else {
                markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
            }
        });

        mapInstanceRef.current = map;
        setTimeout(() => map.invalidateSize(), 100);

        return () => {
            map.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
        };
    }, [isOpen, leafletReady]);

    useEffect(() => {
        if (!isOpen) {
            setPin(null);
            setGeocodeError("");
            setSearchQuery("");
            setSearchResults([]);
        }
    }, [isOpen]);

    const handleSearchInput = (e) => {
        const q = e.target.value;
        setSearchQuery(q);
        setSearchResults([]);
        clearTimeout(searchTimeoutRef.current);
        if (!q.trim()) return;
        searchTimeoutRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const results = await searchPlace(q);
                setSearchResults(results);
            } finally {
                setSearching(false);
            }
        }, 600);
    };

    const handleSearchSelect = (result) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setPin({ lat, lng });
        setGeocodeError("");
        setSearchQuery(result.display_name.split(",").slice(0, 2).join(","));
        setSearchResults([]);

        if (!mapInstanceRef.current) return;
        const L = window.L;
        mapInstanceRef.current.setView([lat, lng], 16);
        if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
        } else {
            markerRef.current = L.marker([lat, lng], { icon: pinIconRef.current }).addTo(mapInstanceRef.current);
        }
    };

    const handleConfirm = useCallback(async () => {
        if (!pin) return;
        setGeocoding(true);
        setGeocodeError("");
        try {
            const data = await reverseGeocode(pin.lat, pin.lng);
            const addressFields = parseNominatimAddress(data);
            onConfirm({
                ...addressFields,
                coordinates: {
                    type: "Point",
                    coordinates: [pin.lng, pin.lat],
                },
            });
            onClose();
        } catch {
            setGeocodeError("Could not retrieve address for this location. Try a different spot.");
        } finally {
            setGeocoding(false);
        }
    }, [pin, onConfirm, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
            onClick={onClose}
        >
            <div
                className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
                style={{ maxHeight: "90vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
                    <div className="flex items-center gap-2">
                        <MapPinIcon className="size-5 text-primary" />
                        <h2 className="font-bold text-lg">Pin Your Location</h2>
                    </div>
                    <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={onClose}
                    >
                        <XIcon className="size-4" />
                    </button>
                </div>

                {/* Map container with overlaid search bar */}
                <div className="flex-1 relative" style={{ minHeight: "420px" }}>

                    {/* Search bar — overlaid on top of map */}
                    <div className="absolute top-3 left-3 right-3 z-[1000]">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-50 pointer-events-none" />
                            <input
                                type="text"
                                className="input input-bordered input-sm w-full pl-9 bg-base-100 shadow-md"
                                placeholder="Search a place (e.g. Makati City Hall)..."
                                value={searchQuery}
                                onChange={handleSearchInput}
                            />
                            {searching && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 loading loading-spinner loading-xs text-primary" />
                            )}
                        </div>
                        {searchResults.length > 0 && (
                            <div className="bg-base-100 border border-base-300 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                                {searchResults.map((r) => (
                                    <button
                                        key={r.place_id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-base-200 truncate"
                                        onClick={() => handleSearchSelect(r)}
                                    >
                                        {r.display_name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Loading overlay */}
                    {!leafletReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-base-200">
                            <span className="loading loading-spinner loading-lg text-primary" />
                        </div>
                    )}

                    <div ref={mapRef} className="w-full h-full" style={{ minHeight: "420px" }} />
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-base-300">
                    {geocodeError && (
                        <p className="text-error text-xs mb-2">{geocodeError}</p>
                    )}
                    <button
                        type="button"
                        className="btn btn-primary w-full gap-2"
                        disabled={!pin || geocoding}
                        onClick={handleConfirm}
                    >
                        {geocoding ? (
                            <><LoaderIcon className="size-4 animate-spin" />Getting address...</>
                        ) : (
                            <><CheckIcon className="size-4" />Confirm Pin</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MapPinModal;