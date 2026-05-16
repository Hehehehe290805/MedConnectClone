import { useEffect, useState } from "react";
import { SearchIcon, AlertCircleIcon } from "lucide-react";
import FriendCard from "../components/FriendCard.jsx";
import FilterSearch from "../components/FilterSearch.jsx";
import { axiosInstance } from "../lib/axios.js";

const SearchPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({});

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axiosInstance.get("/users/doctors");

      if (!res.data) throw new Error("Failed to fetch doctors");

      const doctors = res.data.data || [];
      setResults(doctors);
    } catch (err) {
      console.error("Error fetching doctors:", err);
      setError(err.message || "Failed to fetch doctors");
    } finally {
      setLoading(false);
    }
  };

  // Filtering logic
  const filteredResults = results.filter((item) => {
    const search = query.toLowerCase();
    const matchesSearch =
      !query ||
      item.firstName?.toLowerCase().includes(search) ||
      item.lastName?.toLowerCase().includes(search) ||
      item.role?.toLowerCase().includes(search) ||
      item.location?.toLowerCase().includes(search) ||
      item.profession?.toLowerCase().includes(search);

    const matchesRole =
      filters.roles?.length === 0 ||
      filters.roles?.some(
        (role) => item.role?.toLowerCase() === role.toLowerCase()
      );

    const matchesGender =
      filters.genders?.length === 0 ||
      filters.genders?.some(
        (gender) => item.sex?.toLowerCase() === gender.toLowerCase()
      );

    const matchesLanguages =
      filters.languages?.length === 0 ||
      (filters.matchMode === "all"
        ? filters.languages.every((lang) => item.languages?.includes(lang))
        : filters.languages.some((lang) => item.languages?.includes(lang)));

    const matchesLocation =
      filters.locations?.length === 0 ||
      (filters.matchMode === "all"
        ? filters.locations.every((loc) =>
          item.location?.toLowerCase().includes(loc.toLowerCase())
        )
        : filters.locations.some((loc) =>
          item.location?.toLowerCase().includes(loc.toLowerCase())
        ));

    const matchesProfession =
      !filters.profession ||
      item.profession?.toLowerCase().includes(filters.profession.toLowerCase());

    const matchesPrice =
      (!filters.minPrice || (item.pricing?.amount || 0) >= filters.minPrice) &&
      (!filters.maxPrice || (item.pricing?.amount || 0) <= filters.maxPrice);

    const matchesService =
      !filters.service ||
      item.services?.some((s) =>
        s.name?.toLowerCase().includes(filters.service.toLowerCase())
      );

    const matchesSpecialty =
      !filters.specialty ||
      item.specialties?.some((s) =>
        s.name?.toLowerCase().includes(filters.specialty.toLowerCase())
      );

    const matchesSubspecialty =
      !filters.subspecialty ||
      item.subspecialties?.some((s) =>
        s.name?.toLowerCase().includes(filters.subspecialty.toLowerCase())
      );

    return (
      matchesSearch &&
      matchesRole &&
      matchesGender &&
      matchesLanguages &&
      matchesLocation &&
      matchesProfession &&
      matchesPrice &&
      matchesService &&
      matchesSpecialty &&
      matchesSubspecialty
    );
  });

  useEffect(() => {
    fetchDoctors();
  }, []);

  return (
    <div className="min-h-screen bg-base-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">Find Professionals</h1>

          {/* Search bar and Filter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, role, or location"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input input-bordered w-full pl-10"
              />
            </div>
            <FilterSearch onFilterChange={setFilters} />
          </div>

          {/* Results count */}
          {!loading && !error && (
            <p className="text-sm text-gray-600">
              Found {filteredResults.length} result
              {filteredResults.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center text-error mt-10">
            <AlertCircleIcon className="w-8 h-8" />
            <p className="mt-2 text-center">{error}</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <p className="text-center mt-10 text-gray-500">
            No matching users found.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResults.map((friend) => (
              <FriendCard key={friend._id} friend={friend} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
