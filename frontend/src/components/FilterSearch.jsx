import { useState, useRef, useEffect } from "react";
import { FilterIcon, XIcon, ChevronDownIcon } from "lucide-react";
import {
  ROLES,
  GENDERS,
  LANGUAGES,
  LOCATIONS,
} from "../constants/index.js";

const FilterSearch = ({ onFilterChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [matchMode, setMatchMode] = useState("any"); // "any" or "all"

  // Checkbox filters
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedGenders, setSelectedGenders] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

  // Text input filters
  const [profession, setProfession] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [service, setService] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [subspecialty, setSubspecialty] = useState("");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Apply filters
  useEffect(() => {
    const filters = {
      matchMode, // Include match mode in filters
      roles: selectedRoles,
      genders: selectedGenders,
      languages: selectedLanguages,
      locations: selectedLocations,
      profession: profession.trim(),
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      service: service.trim(),
      specialty: specialty.trim(),
      subspecialty: subspecialty.trim(),
    };
    onFilterChange(filters);
  }, [
    matchMode,
    selectedRoles,
    selectedGenders,
    selectedLanguages,
    selectedLocations,
    profession,
    minPrice,
    maxPrice,
    service,
    specialty,
    subspecialty,
    onFilterChange,
  ]);

  // Toggle checkbox selection
  const toggleSelection = (item, selected, setSelected) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedRoles([]);
    setSelectedGenders([]);
    setSelectedLanguages([]);
    setSelectedLocations([]);
    setProfession("");
    setMinPrice("");
    setMaxPrice("");
    setService("");
    setSpecialty("");
    setSubspecialty("");
  };

  // Count active filters
  const activeFilterCount =
    selectedRoles.length +
    selectedGenders.length +
    selectedLanguages.length +
    selectedLocations.length +
    (profession ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (service ? 1 : 0) +
    (specialty ? 1 : 0) +
    (subspecialty ? 1 : 0);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-outline gap-2"
      >
        <FilterIcon className="w-5 h-5" />
        Filters
        {activeFilterCount > 0 && (
          <div className="badge badge-primary badge-sm">{activeFilterCount}</div>
        )}
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Filter Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-base-200 rounded-lg shadow-xl z-50 max-h-[600px] overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">Filters</h3>
              <div className="flex gap-2">
                <button
                  onClick={clearFilters}
                  className="btn btn-ghost btn-xs"
                  disabled={activeFilterCount === 0}
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Match Mode Toggle */}
            <div className="bg-base-300 p-3 rounded-lg">
              <p className="text-sm font-semibold mb-2">Filter Mode</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setMatchMode("any")}
                  className={`btn btn-sm flex-1 ${
                    matchMode === "any" ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  Match Any
                </button>
                <button
                  onClick={() => setMatchMode("all")}
                  className={`btn btn-sm flex-1 ${
                    matchMode === "all" ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  Match All
                </button>
              </div>
              <p className="text-xs opacity-70 mt-2">
                {matchMode === "any"
                  ? "Show results that match at least one selected filter"
                  : "Show only results that match all selected filters"}
              </p>
            </div>

            <div className="divider my-2"></div>

            {/* Role Filter */}
            <div>
              <p className="font-semibold mb-2">Role</p>
              <div className="space-y-2">
                {ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selectedRoles.includes(role)}
                      onChange={() =>
                        toggleSelection(role, selectedRoles, setSelectedRoles)
                      }
                    />
                    <span className="text-sm">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="divider my-2"></div>

            {/* Gender Filter */}
            <div>
              <p className="font-semibold mb-2">Gender</p>
              <div className="space-y-2">
                {GENDERS.map((gender) => (
                  <label key={gender} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selectedGenders.includes(gender)}
                      onChange={() =>
                        toggleSelection(gender, selectedGenders, setSelectedGenders)
                      }
                    />
                    <span className="text-sm">{gender}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="divider my-2"></div>

            {/* Languages Filter */}
            <div>
              <p className="font-semibold mb-2">Languages</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {LANGUAGES.map((language) => (
                  <label key={language} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selectedLanguages.includes(language)}
                      onChange={() =>
                        toggleSelection(
                          language,
                          selectedLanguages,
                          setSelectedLanguages
                        )
                      }
                    />
                    <span className="text-sm">{language}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="divider my-2"></div>

            {/* Location Filter */}
            <div>
              <p className="font-semibold mb-2">Location</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {LOCATIONS.map((location) => (
                  <label key={location} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={selectedLocations.includes(location)}
                      onChange={() =>
                        toggleSelection(
                          location,
                          selectedLocations,
                          setSelectedLocations
                        )
                      }
                    />
                    <span className="text-sm">{location}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="divider my-2"></div>

            {/* Profession Filter */}
            <div>
              <p className="font-semibold mb-2">Profession</p>
              <input
                type="text"
                placeholder="e.g., Cardiologist"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            </div>

            {/* Price Range Filter */}
            <div>
              <p className="font-semibold mb-2">Price Range</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="input input-bordered input-sm w-full"
                />
                <span className="self-center">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="input input-bordered input-sm w-full"
                />
              </div>
            </div>

            {/* Service Filter */}
            <div>
              <p className="font-semibold mb-2">Service</p>
              <input
                type="text"
                placeholder="e.g., Consultation"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            </div>

            {/* Specialty Filter */}
            <div>
              <p className="font-semibold mb-2">Specialty</p>
              <input
                type="text"
                placeholder="e.g., Cardiology"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            </div>

            {/* Subspecialty Filter */}
            <div>
              <p className="font-semibold mb-2">Subspecialty</p>
              <input
                type="text"
                placeholder="e.g., Interventional Cardiology"
                value={subspecialty}
                onChange={(e) => setSubspecialty(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterSearch;
