import { useState, useEffect } from "react";

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

const PSGCAddressFields = ({ value = {}, onChange, required = false }) => {
    const [regions, setRegions] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);

    const [selectedRegion, setSelectedRegion] = useState(null);
    const [selectedProvince, setSelectedProvince] = useState(null);
    const [selectedCity, setSelectedCity] = useState(null);

    const [loadingRegions, setLoadingRegions] = useState(true);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [apiError, setApiError] = useState(false);

    useEffect(() => {
        fetchPSGC("/regions")
            .then(data => setRegions(data.sort((a, b) => a.name.localeCompare(b.name))))
            .catch(() => setApiError(true))
            .finally(() => setLoadingRegions(false));
    }, []);

    const handleRegionChange = async (e) => {
        const code = e.target.value;
        const region = regions.find(r => r.code === code) || null;
        setSelectedRegion(region);
        setSelectedProvince(null);
        setSelectedCity(null);
        setProvinces([]);
        setCities([]);
        onChange({ ...value, province: "", city: "" });

        if (!region) return;
        setLoadingProvinces(true);
        try {
            // NCR has no provinces — fetch cities directly
            if (code === "130000000") {
                const data = await fetchPSGC(`/regions/${code}/cities-municipalities`);
                const metro = { code: "NCR", name: "Metro Manila (NCR)" };
                setProvinces([metro]);
                setCities(data.sort((a, b) => a.name.localeCompare(b.name)));
                setSelectedProvince(metro);
                onChange({ ...value, province: metro.name, city: "" });
            } else {
                const data = await fetchPSGC(`/regions/${code}/provinces`);
                setProvinces(data.sort((a, b) => a.name.localeCompare(b.name)));
            }
        } catch {
            setApiError(true);
        } finally {
            setLoadingProvinces(false);
        }
    };

    const handleProvinceChange = async (e) => {
        const code = e.target.value;
        const province = provinces.find(p => p.code === code) || null;
        setSelectedProvince(province);
        setSelectedCity(null);
        setCities([]);
        onChange({ ...value, province: province?.name || "", city: "" });

        if (!province || code === "NCR") return; // NCR cities already loaded
        setLoadingCities(true);
        try {
            const data = await fetchPSGC(`/provinces/${code}/cities-municipalities`);
            setCities(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch {
            setApiError(true);
        } finally {
            setLoadingCities(false);
        }
    };

    const handleCityChange = (e) => {
        const code = e.target.value;
        const city = cities.find(c => c.code === code) || null;
        setSelectedCity(city);
        onChange({ ...value, city: city?.name || "" });
    };

    if (apiError) {
        return (
            <p className="text-xs text-warning opacity-70">
                Address dropdowns unavailable (offline). Please type your province and city below.
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div className="form-control">
                <label className="label py-1">
                    <span className="label-text text-sm">Region {required && <span className="text-error">*</span>}</span>
                </label>
                <select
                    className="select select-bordered w-full"
                    value={selectedRegion?.code || ""}
                    onChange={handleRegionChange}
                    disabled={loadingRegions}
                >
                    <option value="">{loadingRegions ? "Loading regions…" : "Select Region"}</option>
                    {regions.map(r => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                    ))}
                </select>
            </div>

            {selectedRegion && selectedRegion.code !== "130000000" && (
                <div className="form-control">
                    <label className="label py-1">
                        <span className="label-text text-sm">Province {required && <span className="text-error">*</span>}</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
                        value={selectedProvince?.code || ""}
                        onChange={handleProvinceChange}
                        disabled={loadingProvinces}
                    >
                        <option value="">{loadingProvinces ? "Loading provinces…" : "Select Province"}</option>
                        {provinces.map(p => (
                            <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {(selectedProvince || selectedRegion?.code === "130000000") && (
                <div className="form-control">
                    <label className="label py-1">
                        <span className="label-text text-sm">City / Municipality {required && <span className="text-error">*</span>}</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
                        value={selectedCity?.code || ""}
                        onChange={handleCityChange}
                        disabled={loadingCities}
                    >
                        <option value="">{loadingCities ? "Loading cities…" : "Select City / Municipality"}</option>
                        {cities.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};

export default PSGCAddressFields;
