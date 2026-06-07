import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon, MapPinIcon, StethoscopeIcon, BuildingIcon, SparklesIcon, XIcon, ActivityIcon } from "lucide-react";
import ProviderCard from "../components/ProviderCard.jsx";
import FilterSearch from "../components/FilterSearch.jsx";
import { axiosInstance } from "../lib/axios";
import useAuthUser from "../hooks/useAuthUser.js";

const buildParams = (name, filters) => {
    const params = new URLSearchParams();
    if (name.trim()) {
        // Support multi-term: "Cardiology + ECG" → terms=["Cardiology","ECG"]
        const terms = name.split("+").map(t => t.trim()).filter(Boolean);
        if (terms.length === 1) {
            params.set("name", terms[0]);
        } else {
            terms.forEach(t => params.append("name", t));
        }
    }
    Object.entries(filters).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
        else if (v !== "" && v != null) params.set(k, v);
    });
    return params.toString();
};

const SearchPage = () => {
    const { authUser } = useAuthUser();
    const [mode, setMode] = useState("doctor"); // "doctor" | "institute" | "department"
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState({});

    // Pre-consultation data written by ConsultationPage wizard (may be null)
    const [preConsult, setPreConsult] = useState(() => {
        try {
            const raw = sessionStorage.getItem("preConsultation");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    const dismissPreConsult = () => {
        sessionStorage.removeItem("preConsultation");
        setPreConsult(null);
    };

    const qs = buildParams(query, filters);

    const { data, isLoading, error } = useQuery({
        queryKey: ["search", mode, qs],
        queryFn: () => axiosInstance.get(`/search/${mode === "doctor" ? "doctors" : mode === "institute" ? "institutes" : "departments"}?${qs}`).then(r => r.data),
        keepPreviousData: true,
    });

    const results = mode === "doctor"
        ? (data?.data?.doctors ?? [])
        : mode === "institute"
            ? (data?.data?.institutes ?? [])
            : (data?.data?.departments ?? []);

    const sortedByProximity = data?.data?.sortedByProximity ?? false;

    const handleFilterChange = useCallback((f) => setFilters(f), []);

    // Bipartite-inspired ranking using specialty confidence, rating, proximity, and language match.
    // Only active when the user arrived from the ConsultationPage wizard.
    const recommendedDoctors = useMemo(() => {
        if (!preConsult?.specialtyConfidence || mode !== "doctor") return [];
        const doctors = data?.data?.doctors ?? [];
        if (!doctors.length) return [];

        const conf = preConsult.specialtyConfidence; // { "Cardiology": 0.62, ... }

        // Patient's languages — normalised to lowercase for case-insensitive comparison
        const patientLangs = (authUser?.languages ?? []).map(l => l.toLowerCase());
        const useLanguageScore = patientLangs.length > 0;

        return doctors
            .map((doc) => {
                const specialtyScore = Math.max(0, ...(doc.specialties ?? []).map((s) => conf[s] ?? 0));
                if (specialtyScore === 0) return null;

                const ratingScore    = (doc.averageRating ?? 3) / 5;
                // Proximity decay: score 1.0 at 0 km, ~0.67 at 10 km, ~0.33 at 40 km
                const proximityScore = doc.distanceKm != null ? 1 / (1 + doc.distanceKm * 0.05) : 0.5;

                let compositeScore;
                if (useLanguageScore) {
                    // Boost doctors who share at least one language with the patient
                    const docLangs = (doc.languages ?? []).map(l => l.toLowerCase());
                    const languageScore = docLangs.some(l => patientLangs.includes(l)) ? 1 : 0;
                    // Adjusted weights to make room for language: specialty 0.4, rating 0.25, proximity 0.15, language 0.2
                    compositeScore = specialtyScore * 0.4 + ratingScore * 0.25 + proximityScore * 0.15 + languageScore * 0.2;
                } else {
                    compositeScore = specialtyScore * 0.5 + ratingScore * 0.3 + proximityScore * 0.2;
                }

                return { ...doc, compositeScore, specialtyScore };
            })
            .filter(Boolean)
            .sort((a, b) => b.compositeScore - a.compositeScore)
            .slice(0, 3);
    }, [preConsult, data, mode, authUser?.languages]);

    const switchMode = (newMode) => {
        setMode(newMode);
        setQuery("");
        setFilters({});
    };

    return (
        <div className="min-h-screen bg-base-100 p-6">
            <div className="max-w-5xl mx-auto space-y-5">
                <h1 className="text-3xl font-bold">Find a Provider</h1>

                {/* Mode toggle */}
                <div className="tabs tabs-boxed bg-base-200 w-fit">
                    <button
                        className={`tab gap-2 ${mode === "doctor" ? "tab-active" : ""}`}
                        onClick={() => switchMode("doctor")}
                    >
                        <StethoscopeIcon className="w-4 h-4" />Doctors
                    </button>
                    <button
                        className={`tab gap-2 ${mode === "institute" ? "tab-active" : ""}`}
                        onClick={() => switchMode("institute")}
                    >
                        <BuildingIcon className="w-4 h-4" />Institutes
                    </button>
                    <button
                        className={`tab gap-2 ${mode === "department" ? "tab-active" : ""}`}
                        onClick={() => switchMode("department")}
                    >
                        <ActivityIcon className="w-4 h-4" />Departments
                    </button>
                </div>

                {/* Search bar + filters */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 w-5 h-5" />
                        <input
                            type="text"
                            placeholder={mode === "doctor"
                                ? "Search by name, specialty or subspecialty..."
                                : mode === "institute"
                                    ? "Search by name, department type or service..."
                                    : "Search by institute name, department type or service..."}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="input input-bordered w-full pl-10"
                        />
                    </div>
                    <FilterSearch mode={mode} onFilterChange={handleFilterChange} />
                </div>
                <p className="text-xs opacity-40">
                    Tip: Use <span className="font-mono font-semibold">+</span> to search multiple terms — e.g. <span className="font-mono">Cardiology + ECG</span>
                </p>

                {/* Result count + proximity notice */}
                {!isLoading && !error && (
                    <div className="flex items-center gap-3 text-sm opacity-60">
                        <span>{results.length} result{results.length !== 1 ? "s" : ""}</span>
                        {sortedByProximity && (
                            <span className="flex items-center gap-1 text-primary">
                                <MapPinIcon className="w-3.5 h-3.5" />
                                Sorted by proximity
                            </span>
                        )}
                    </div>
                )}

                {/* Bipartite-recommended doctors (only when arriving from ConsultationPage) */}
                {!isLoading && !error && recommendedDoctors.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <SparklesIcon className="w-4 h-4 text-primary" />
                                <span className="font-semibold text-sm">Recommended for Your Symptoms</span>
                                <span className="badge badge-primary badge-xs">Bayesian match</span>
                            </div>
                            <button className="btn btn-ghost btn-xs gap-1" onClick={dismissPreConsult}>
                                <XIcon className="w-3 h-3" /> Dismiss
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {recommendedDoctors.map((provider) => (
                                <div key={provider._id} className="relative">
                                    <div className="absolute top-2 left-2 z-10 pointer-events-none">
                                        <span className="badge badge-primary badge-sm gap-1 shadow">
                                            <SparklesIcon className="w-3 h-3" />
                                            {(provider.specialtyScore * 100).toFixed(0)}% specialty match
                                        </span>
                                    </div>
                                    <ProviderCard provider={provider} />
                                </div>
                            ))}
                        </div>
                        <div className="divider text-xs opacity-40 my-2">All Doctors</div>
                    </div>
                )}

                {/* Results */}
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <span className="loading loading-spinner loading-lg text-primary" />
                    </div>
                ) : error ? (
                    <div className="text-center py-16 text-error">
                        <p>Failed to load results. Please try again.</p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="text-center py-16 opacity-50">
                        <p className="text-lg">No {mode === "doctor" ? "doctors" : mode === "institute" ? "institutes" : "departments"} found.</p>
                        <p className="text-sm mt-1">Try adjusting your filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {results.map((provider) => (
                            <ProviderCard key={provider._id} provider={provider} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
