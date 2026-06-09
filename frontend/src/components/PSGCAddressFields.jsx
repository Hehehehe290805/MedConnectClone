import { useState, useEffect, useRef } from "react";

const API = "https://psgc.cloud/api";
const cache = {};

async function fetchPSGC(path) {
    if (cache[path]) return cache[path];
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error("PSGC fetch failed");
    const data = await res.json();
    cache[path] = data;
    return data;
}

const sortByName = (a, b) => a.name.localeCompare(b.name);

const NCR_CODE = "130000000";
// NCR has no traditional provinces — use the region code as a synthetic province code
const NCR_PROVINCE = { code: NCR_CODE, name: "Metro Manila (NCR)", isNcr: true };

// PSGCAddressFields renders Barangay + City + Province (each 1 column) inside a parent 2-col grid.
// Intended slot order: [Barangay][City] / [Province][...postal code rendered by parent]
// onChange receives { province, city, barangay, postalCode }.
//
// Relationships:
//   province selected  → province's cities appear first in city dropdown (rest follow)
//   city selected      → auto-sets province; loads that city's barangays for suggestions
//   barangay typed     → free text always; suggestions only after city is chosen
const PSGCAddressFields = ({ value = {}, onChange, required = false }) => {
    const [provinces, setProvinces] = useState([]);
    const [allCities, setAllCities] = useState([]);   // all ~1,600 loaded on mount
    const [barangays, setBarangays] = useState([]);   // city-scoped, loaded on city select

    const [selectedProvince, setSelectedProvince] = useState(null);
    const [selectedCity, setSelectedCity] = useState(null);
    const [barangayQuery, setBarangayQuery] = useState(value.barangay || "");
    const [barangayOpen, setBarangayOpen] = useState(false);

    const [loadingProvinces, setLoadingProvinces] = useState(true);
    const [loadingCities, setLoadingCities] = useState(true);
    const [loadingBarangays, setLoadingBarangays] = useState(false);
    const [apiError, setApiError] = useState(false);

    const barangayRef = useRef(null);
    const barangayQueryRef = useRef(barangayQuery);
    barangayQueryRef.current = barangayQuery;

    // Load provinces + all cities on mount (cities cached after first load)
    useEffect(() => {
        Promise.all([
            fetchPSGC("/provinces"),
            fetchPSGC("/cities-municipalities"),
        ])
            .then(([prov, cities]) => {
                setProvinces([...[...prov].sort(sortByName), NCR_PROVINCE]);
                setAllCities([...cities].sort(sortByName));
            })
            .catch(() => setApiError(true))
            .finally(() => {
                setLoadingProvinces(false);
                setLoadingCities(false);
            });
    }, []);

    // Sync barangay input when parent updates it externally (e.g. map-pin autofill)
    useEffect(() => {
        if ((value.barangay || "") !== barangayQueryRef.current) {
            setBarangayQuery(value.barangay || "");
        }
    }, [value.barangay]);

    // Close barangay dropdown on outside click
    useEffect(() => {
        const handle = (e) => {
            if (barangayRef.current && !barangayRef.current.contains(e.target)) {
                setBarangayOpen(false);
            }
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    // Emit onChange with current context merged with any partial update
    const emit = (partial) => {
        onChange({
            province: selectedProvince?.name || value.province || "",
            city: selectedCity?.name || value.city || "",
            barangay: barangayQuery,
            postalCode: value.postalCode || "",
            ...partial,
        });
    };

    const handleProvinceChange = (e) => {
        const code = e.target.value;
        const province = provinces.find(p => p.code === code) || null;
        setSelectedProvince(province);
        // Don't clear city — keep it selected; dropdown just reorders
        emit({ province: province?.name || "" });
    };

    const handleCityChange = async (e) => {
        const code = e.target.value;
        const city = allCities.find(c => c.code === code) || null;
        setSelectedCity(city);
        setBarangays([]);
        setBarangayQuery("");

        // Auto-fill province from city data
        let province = selectedProvince;
        if (city) {
            if (city.provinceCode) {
                const matched = provinces.find(p => p.code === city.provinceCode);
                if (matched) { setSelectedProvince(matched); province = matched; }
            } else if (city.regionCode === NCR_CODE) {
                setSelectedProvince(NCR_PROVINCE);
                province = NCR_PROVINCE;
            }
        }

        const postalCode = city?.postalCode ? String(city.postalCode) : value.postalCode || "";
        onChange({
            province: province?.name || value.province || "",
            city: city?.name || "",
            barangay: "",
            postalCode,
        });

        if (!city) return;
        setLoadingBarangays(true);
        try {
            const data = await fetchPSGC(`/cities-municipalities/${code}/barangays`);
            setBarangays([...data].sort(sortByName));
        } catch { /* no suggestions if fetch fails — free text still works */ }
        finally { setLoadingBarangays(false); }
    };

    // City options: province's cities first (optgroup), then all others
    const provinceCities = selectedProvince
        ? allCities.filter(c =>
            selectedProvince.isNcr
                ? c.regionCode === NCR_CODE
                : c.provinceCode === selectedProvince.code
        )
        : [];
    const otherCities = selectedProvince
        ? allCities.filter(c =>
            selectedProvince.isNcr
                ? c.regionCode !== NCR_CODE
                : c.provinceCode !== selectedProvince.code
        )
        : allCities;

    // Barangay suggestions filtered by typed query
    const filteredBarangays = barangays.filter(b =>
        barangayQuery.length === 0 || b.name.toLowerCase().includes(barangayQuery.toLowerCase())
    ).slice(0, 15);

    if (apiError) {
        return (
            <p className="text-xs text-warning opacity-70 col-span-2">
                Address dropdowns unavailable (offline). Please type your address manually.
            </p>
        );
    }

    const loading = loadingProvinces || loadingCities;

    return (
        <>
            {/* Barangay — 1 column, combobox: free text + dropdown suggestions after city selected */}
            <div className="form-control" ref={barangayRef}>
                <label className="label py-0">
                    <span className="label-text text-sm">
                        Barangay {required && <span className="text-error">*</span>}
                        {loadingBarangays && <span className="opacity-40 text-xs ml-1">(loading…)</span>}
                    </span>
                </label>
                <div className="relative">
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        placeholder={!selectedCity ? "Type barangay (select city for suggestions)" : "Type or select barangay"}
                        value={barangayQuery}
                        onChange={(e) => {
                            const val = e.target.value;
                            setBarangayQuery(val);
                            setBarangayOpen(true);
                            emit({ barangay: val });
                        }}
                        onFocus={() => { if (filteredBarangays.length > 0) setBarangayOpen(true); }}
                        autoComplete="off"
                    />
                    {barangayOpen && filteredBarangays.length > 0 && (
                        <div className="absolute z-30 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                            {filteredBarangays.map(b => (
                                <button
                                    key={b.code}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-base-200"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setBarangayQuery(b.name);
                                        setBarangayOpen(false);
                                        emit({ barangay: b.name });
                                    }}
                                >
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* City / Municipality — always enabled; province's cities shown first */}
            <div className="form-control">
                <label className="label py-0">
                    <span className="label-text text-sm">
                        City / Municipality {required && <span className="text-error">*</span>}
                    </span>
                </label>
                <select
                    className="select select-bordered w-full"
                    value={selectedCity?.code || ""}
                    onChange={handleCityChange}
                    disabled={loading}
                >
                    <option value="">{loading ? "Loading…" : "Select City / Municipality"}</option>
                    {selectedProvince ? (
                        <>
                            {provinceCities.length > 0 && (
                                <optgroup label={`Cities in ${selectedProvince.name}`}>
                                    {provinceCities.map(c => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </optgroup>
                            )}
                            {otherCities.length > 0 && (
                                <optgroup label="All Other Cities">
                                    {otherCities.map(c => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </optgroup>
                            )}
                        </>
                    ) : (
                        allCities.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                        ))
                    )}
                </select>
            </div>

            {/* Province — always enabled; selecting it reorders city dropdown */}
            <div className="form-control">
                <label className="label py-0">
                    <span className="label-text text-sm">
                        Province {required && <span className="text-error">*</span>}
                    </span>
                </label>
                <select
                    className="select select-bordered w-full"
                    value={selectedProvince?.code || ""}
                    onChange={handleProvinceChange}
                    disabled={loadingProvinces}
                >
                    <option value="">{loadingProvinces ? "Loading…" : "Select Province"}</option>
                    {provinces.map(p => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                </select>
            </div>
        </>
    );
};

export default PSGCAddressFields;
