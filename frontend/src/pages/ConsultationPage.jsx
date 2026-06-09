import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeftIcon, ArrowRightIcon, SearchIcon, AlertTriangleIcon, XIcon } from "lucide-react";
import diseaseData from "../data/diseaseSymptoms.json";

// Body-system cards and their associated canonical symptom strings.
// Symptom text must exactly match the strings in diseaseSymptoms.json for
// the intersection-based scoring to work correctly.
const BODY_SYSTEMS = [
  {
    id: "cardiovascular", label: "Heart & Blood", icon: "❤️",
    symptoms: ["Palpitations / racing heart", "Sharp chest pain", "Chest tightness", "Shortness of breath", "Dizziness or fainting", "Irregular heartbeat", "Leg swelling", "Poor circulation"],
  },
  {
    id: "respiratory", label: "Lungs & Breathing", icon: "🫁",
    symptoms: ["Cough", "Shortness of breath", "Wheezing", "Breathing fast", "Coughing up blood", "Hoarse voice", "Congestion in chest", "Difficulty breathing"],
  },
  {
    id: "gastro", label: "Stomach & Digestion", icon: "🫃",
    symptoms: ["Nausea or vomiting", "Diarrhea", "Sharp abdominal pain", "Heartburn or acid reflux", "Stomach bloating", "Blood in stool", "Constipation", "Loss of appetite"],
  },
  {
    id: "neuro", label: "Brain & Nerves", icon: "🧠",
    symptoms: ["Headache", "Dizziness", "Insomnia", "Seizures or convulsions", "Tingling or numbness", "Weakness on one side", "Slurring words", "Memory problems"],
  },
  {
    id: "msk", label: "Bones & Muscles", icon: "🦴",
    symptoms: ["Joint pain", "Muscle pain", "Back pain", "Low back pain", "Knee pain", "Hip pain", "Bones are painful", "Muscle stiffness or weakness"],
  },
  {
    id: "derm", label: "Skin & Hair", icon: "🌿",
    symptoms: ["Skin rash", "Itching of skin", "Skin lesion or growth", "Acne or pimples", "Skin moles (changing)", "Dry or peeling skin", "Hair loss", "Skin infection"],
  },
  {
    id: "ent", label: "Ear, Nose & Throat", icon: "👂",
    symptoms: ["Sore throat", "Nasal congestion", "Ear pain", "Ringing in ear", "Diminished hearing", "Throat swelling or tightness", "Nosebleed", "Difficulty swallowing"],
  },
  {
    id: "ophthalmology", label: "Eyes", icon: "👁️",
    symptoms: ["Diminished vision", "Double vision", "Pain in eye", "Eye redness", "Itchy or watery eyes", "Blurred vision", "Spots in vision", "Eye burns or stings"],
  },
  {
    id: "mental", label: "Mental Health", icon: "🧘",
    symptoms: ["Anxiety and nervousness", "Depression or low mood", "Insomnia", "Emotional instability", "Fears and phobias", "Obsessive thoughts", "Low self-esteem", "Feeling disconnected from reality"],
  },
  {
    id: "endo", label: "Hormones & Metabolism", icon: "⚗️",
    symptoms: ["Excessive urination", "Excessive thirst", "Unexplained weight gain", "Unexplained weight loss", "Excessive appetite", "Sensitivity to heat or cold", "Excessive sweating", "Fatigue"],
  },
  {
    id: "repro", label: "Reproductive & Urinary", icon: "🌸",
    symptoms: ["Painful urination", "Frequent urination", "Blood in urine", "Vaginal discharge", "Pelvic pain", "Painful menstruation", "Irregular menstruation", "Vaginal itching"],
  },
  {
    id: "dental", label: "Dental & Oral", icon: "🦷",
    symptoms: ["Toothache", "Tooth sensitivity", "Bleeding gums", "Gum swelling or tenderness", "Jaw pain", "Mouth sores or ulcers", "Bad breath", "Difficulty chewing"],
  },
  {
    id: "general", label: "General / Not Sure", icon: "🏥",
    symptoms: ["Fever", "Fatigue or tiredness", "Weakness", "Chills", "Unexplained weight loss", "Swollen lymph nodes", "Aching all over", "Feeling generally unwell"],
  },
];

const DURATION_OPTIONS = [
  { value: "less_than_day", label: "Less than a day" },
  { value: "few_days",      label: "A few days" },
  { value: "weeks",         label: "Weeks" },
  { value: "month_plus",    label: "A month or more" },
];

const AGE_OPTIONS = [
  { value: "child",  label: "Child (under 18)" },
  { value: "adult",  label: "Adult (18–59)" },
  { value: "senior", label: "Senior (60 and above)" },
];

const URGENCY_CONFIG = {
  high:   { label: "Seek care soon",    cls: "badge-error" },
  medium: { label: "Schedule a visit",  cls: "badge-warning" },
  low:    { label: "Routine consult",   cls: "badge-success" },
};

// Generates the markdown text that will be attached to the appointment as a
// pre-consultation record. The doctor sees this before and during the session.
function buildPreConsultationMarkdown({ system, symptoms, duration, ageGroup, matches }) {
    const systemData = BODY_SYSTEMS.find(s => s.id === system);
    const systemLabel = systemData?.label ?? system;
    const DURATION_MAP = {
        less_than_day: "Less than a day",
        few_days: "A few days",
        weeks: "Weeks",
        month_plus: "A month or more",
    };
    const AGE_MAP = {
        child: "Child (under 18)",
        adult: "Adult (18–59)",
        senior: "Senior (60 and above)",
    };

    const lines = [
        "# Pre-Consultation Summary",
        "",
        `**Body System Concerned:** ${systemLabel}`,
        `**Duration:** ${DURATION_MAP[duration] ?? duration}`,
        `**Age Group:** ${AGE_MAP[ageGroup] ?? ageGroup}`,
        "",
        "## Reported Symptoms",
        ...(symptoms.length > 0 ? symptoms.map(s => `- ${s}`) : ["- None selected"]),
        "",
        "## Suggested Conditions",
        ...(matches.length > 0
            ? matches.map((m, i) => `${i + 1}. **${m.disease}** (${m.specialty}) — ${m.matchCount} matching symptom${m.matchCount > 1 ? "s" : ""}, ${(m.confidence * 100).toFixed(0)}% relative confidence`)
            : ["No conditions matched the selected symptoms."]),
        "",
        "---",
        "*This summary was generated by the MedConnect Pre-Consultation Wizard.*",
        "*It is not a medical diagnosis. Please assess the patient independently.*",
    ];
    return lines.join("\n");
}

// score = |intersection| / |union|  (Jaccard similarity)
// Normalized across candidates to produce a relative confidence used by the
// bipartite doctor ranker in SearchPage (via specialtyConfidence in sessionStorage).
function matchDiseases(selectedSymptoms) {
  if (selectedSymptoms.length === 0) return [];

  const selectedSet = new Set(selectedSymptoms);

  const candidates = diseaseData
    .map((d) => {
      const intersect = d.symptoms.filter((s) => selectedSet.has(s));
      if (!intersect.length) return null;
      const unionSize = new Set([...d.symptoms, ...selectedSymptoms]).size;
      return { ...d, score: intersect.length / unionSize, matchCount: intersect.length };
    })
    .filter(Boolean);

  if (!candidates.length) return [];

  const total = candidates.reduce((s, d) => s + d.score, 0);
  return candidates
    .map((d) => ({ ...d, confidence: total > 0 ? d.score / total : 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Flat list of all unique symptoms across all body systems, with their source system label
const ALL_SYMPTOMS = [...new Map(
  BODY_SYSTEMS.flatMap(sys => sys.symptoms.map(s => [s, { symptom: s, systemLabel: sys.label }]))
).values()];

const ConsultationPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [duration, setDuration] = useState(null);
  const [ageGroup, setAgeGroup] = useState(null);
  const [symptomSearch, setSymptomSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const searchRef = useRef(null);

  const systemData = BODY_SYSTEMS.find(s => s.id === selectedSystem);

  // Run matching only when the result step is reached to avoid re-computing on every render
  const matches = useMemo(
    () => (step === "result" ? matchDiseases(selectedSymptoms) : []),
    [step, selectedSymptoms]
  );

  // Highest urgency among matched conditions — drives the alert banner colour
  const topUrgency = matches[0]?.urgency ?? "low";

  const toggleSymptom = (symptom) =>
    setSelectedSymptoms(prev =>
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );

  const addSymptomFromSearch = (symptom) => {
    if (!selectedSymptoms.includes(symptom)) {
      setSelectedSymptoms(prev => [...prev, symptom]);
    }
    setSymptomSearch("");
    setShowDropdown(false);
  };

  const filteredSearchResults = useMemo(() => {
    if (!symptomSearch.trim()) return [];
    const q = symptomSearch.toLowerCase();
    return ALL_SYMPTOMS.filter(({ symptom }) => symptom.toLowerCase().includes(q)).slice(0, 8);
  }, [symptomSearch]);

  const handleSkip = () => navigate("/search");

  const handleStep1Select = (id) => {
    setSelectedSystem(id);
    setSelectedSymptoms([]);
    setOtherText("");
    setShowOtherInput(false);
    setStep(2);
  };

  const handleNext2 = () => setStep(3);

  const handleNext3 = () => setStep("result");

  // Saves the wizard answers to sessionStorage so the booking flow can attach
  // them as a pre-consultation file when the patient confirms an appointment.
  // specialtyConfidence is used by SearchPage to do bipartite-inspired ranking.
  const storePreConsultation = () => {
    const specialtyConfidence = {};
    for (const m of matches) {
      if (!specialtyConfidence[m.specialty] || m.confidence > specialtyConfidence[m.specialty]) {
        specialtyConfidence[m.specialty] = m.confidence;
      }
    }
    const data = {
      system: selectedSystem,
      symptoms: selectedSymptoms,
      duration,
      ageGroup,
      matches,
      specialtyConfidence,
      markdown: buildPreConsultationMarkdown({
        system: selectedSystem,
        symptoms: selectedSymptoms,
        duration,
        ageGroup,
        matches,
      }),
    };
    sessionStorage.setItem("preConsultation", JSON.stringify(data));
  };

  const handleSearchSpecialty = (specialty) => {
    storePreConsultation();
    navigate(`/search?specialty=${encodeURIComponent(specialty)}`);
  };

  const StepBar = () => (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3].map(n => (
        <div key={n} className="flex items-center gap-2">
          <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
            step === n ? "bg-primary text-primary-content"
            : (typeof step === "number" && step > n) || step === "result" ? "bg-success text-success-content"
            : "bg-base-200 opacity-50"
          }`}>
            {(typeof step === "number" && step > n) || step === "result" ? "✓" : n}
          </div>
          {n < 3 && <div className={`h-0.5 w-8 rounded ${(typeof step === "number" && step > n) || step === "result" ? "bg-success" : "bg-base-200"}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Start Consultation</h1>
        <p className="text-sm opacity-60 mt-1">Answer a few questions and we'll help you find the right specialist.</p>
      </div>

      {/* ── Step 1: Body system ── */}
      {step === 1 && (
        <div className="space-y-4">
          <StepBar />
          <h2 className="font-semibold text-lg">What area concerns you most?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {BODY_SYSTEMS.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => handleStep1Select(id)}
                className="card bg-base-100 border border-base-300 hover:border-primary hover:bg-primary/5 transition-colors p-4 text-left gap-2 h-auto"
              >
                <span className="text-2xl">{icon}</span>
                <span className="text-sm font-medium leading-tight">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={handleSkip} className="btn btn-ghost btn-sm gap-1">
              Skip to Search <ArrowRightIcon className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Symptoms ── */}
      {step === 2 && systemData && (
        <div className="space-y-4">
          <StepBar />
          <div className="flex items-center gap-2">
            <span className="text-xl">{systemData.icon}</span>
            <h2 className="font-semibold text-lg">Which symptoms are you experiencing?</h2>
          </div>
          <p className="text-sm opacity-60">Select from the list below, or search for any symptom.</p>

          {/* Typeahead search */}
          <div className="relative" ref={searchRef}>
            <div className="flex items-center gap-2 input input-bordered w-full px-3 py-2">
              <SearchIcon className="size-4 opacity-40 shrink-0" />
              <input
                type="text"
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder="Search any symptom…"
                value={symptomSearch}
                onChange={e => { setSymptomSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              />
              {symptomSearch && (
                <button className="opacity-40 hover:opacity-70" onClick={() => { setSymptomSearch(""); setShowDropdown(false); }}>
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>
            {showDropdown && filteredSearchResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 bg-base-100 border border-base-300 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
                {filteredSearchResults.map(({ symptom, systemLabel }) => (
                  <button
                    key={symptom}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 flex items-center justify-between gap-2 ${selectedSymptoms.includes(symptom) ? "text-primary font-medium" : ""}`}
                    onMouseDown={() => addSymptomFromSearch(symptom)}
                  >
                    <span>{symptom}</span>
                    <span className="text-xs opacity-40 shrink-0">{systemLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected via search (not in current grid) */}
          {selectedSymptoms.filter(s => !systemData.symptoms.includes(s)).length > 0 && (
            <div>
              <p className="text-xs opacity-50 mb-1.5">Added via search:</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedSymptoms.filter(s => !systemData.symptoms.includes(s)).map(s => (
                  <span key={s} className="badge badge-primary badge-sm gap-1">
                    {s}
                    <button onClick={() => toggleSymptom(s)} className="hover:opacity-70"><XIcon className="size-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Grid for current body system */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {systemData.symptoms.map(symptom => (
              <label
                key={symptom}
                className="flex items-center gap-3 p-3 rounded-lg border border-base-300 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={selectedSymptoms.includes(symptom)}
                  onChange={() => toggleSymptom(symptom)}
                />
                <span className="text-sm">{symptom}</span>
              </label>
            ))}
          </div>

          {/* Other — free-text custom symptom */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-base-300 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={showOtherInput}
                onChange={(e) => { setShowOtherInput(e.target.checked); if (!e.target.checked) setOtherText(""); }}
              />
              <span className="text-sm">Other…</span>
            </label>
            {showOtherInput && (
              <div className="flex gap-2 pl-1">
                <input
                  type="text"
                  className="input input-sm input-bordered flex-1"
                  placeholder="Describe your symptom…"
                  value={otherText}
                  onChange={e => setOtherText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && otherText.trim()) {
                      addSymptomFromSearch(otherText.trim());
                      setOtherText("");
                    }
                  }}
                  autoFocus
                />
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!otherText.trim()}
                  onClick={() => { addSymptomFromSearch(otherText.trim()); setOtherText(""); }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="btn btn-ghost btn-sm gap-1">
              <ArrowLeftIcon className="size-3" /> Back
            </button>
            <button onClick={handleNext2} className="btn btn-primary btn-sm gap-1">
              Next <ArrowRightIcon className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Follow-up ── */}
      {step === 3 && (
        <div className="space-y-5">
          <StepBar />
          <h2 className="font-semibold text-lg">A few more questions</h2>

          <div>
            <p className="text-sm font-medium mb-2">How long have you had these symptoms?</p>
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDuration(value)}
                  className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                    duration === value ? "border-primary bg-primary/10 font-medium" : "border-base-300 hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Your age group?</p>
            <div className="flex flex-wrap gap-2">
              {AGE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setAgeGroup(value)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                    ageGroup === value ? "border-primary bg-primary/10 font-medium" : "border-base-300 hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="btn btn-ghost btn-sm gap-1">
              <ArrowLeftIcon className="size-3" /> Back
            </button>
            <button
              onClick={handleNext3}
              className="btn btn-primary btn-sm gap-1"
              disabled={!duration || !ageGroup}
            >
              See Results <ArrowRightIcon className="size-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Result: Expert system output ── */}
      {step === "result" && (
        <div className="space-y-5">
          {/* Urgency banner */}
          {topUrgency === "high" && (
            <div className="flex items-start gap-2 text-error text-sm">
              <AlertTriangleIcon className="size-4 shrink-0 mt-0.5" />
              <span>Some possible conditions are urgent. Please seek medical attention promptly.</span>
            </div>
          )}

          <div className="card bg-base-100 border border-base-300 p-5 rounded-xl space-y-4">
            <div>
              <p className="font-bold text-lg">Based on your responses</p>
              <p className="text-sm opacity-70">
                You reported concerns related to <strong>{systemData?.label}</strong>
                {selectedSymptoms.length > 0 && (
                  <>: {selectedSymptoms.slice(0, 3).join(", ")}{selectedSymptoms.length > 3 ? ` +${selectedSymptoms.length - 3} more` : ""}</>
                )}.
              </p>
            </div>

            {matches.length === 0 ? (
              <p className="text-sm opacity-60">
                Not enough symptoms selected to suggest a condition.
                Use the search below to find the right specialist.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold opacity-50 uppercase tracking-wide">Possible Conditions</p>
                {matches.map((m, i) => {
                  const urgency = URGENCY_CONFIG[m.urgency] || URGENCY_CONFIG.low;
                  return (
                    <div key={m.disease} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-base-300 bg-base-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{m.disease}</span>
                          {i === 0 && <span className="badge badge-sm badge-primary">Top match</span>}
                          <span className={`badge badge-sm ${urgency.cls}`}>{urgency.label}</span>
                        </div>
                        <p className="text-xs opacity-60 mt-0.5">
                          {m.matchCount} matching symptom{m.matchCount > 1 ? "s" : ""} · {(m.confidence * 100).toFixed(0)}% confidence · See a <strong>{m.specialty}</strong> specialist
                        </p>
                      </div>
                      <button
                        className="btn btn-xs btn-outline shrink-0"
                        onClick={() => handleSearchSpecialty(m.specialty)}
                      >
                        Find {m.specialty}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-xs opacity-50 italic">
              This is not a medical diagnosis. These suggestions are based on symptom patterns only.
              Always consult a licensed physician.
            </div>

            {/* Notice: pre-consultation answers will be sent to the doctor */}
            <div className="alert alert-info text-sm gap-2 mt-1">
              <span>
                When you book an appointment from here, your answers will be sent to the doctor as a pre-consultation summary so they can prepare before your session.
              </span>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => { storePreConsultation(); navigate("/search"); }}
                className="btn btn-primary btn-sm gap-2"
              >
                <SearchIcon className="size-4" />
                Search All Doctors
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem("preConsultation");
                  setStep(1); setSelectedSystem(null); setSelectedSymptoms([]); setDuration(null); setAgeGroup(null);
                }}
                className="btn btn-ghost btn-sm"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationPage;
