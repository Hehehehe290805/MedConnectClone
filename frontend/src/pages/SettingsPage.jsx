import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Link as NavLink } from "react-router";
import useAuthUser from "../hooks/useAuthUser.js";
import { ImageUploadField, uploadPendingImages } from "./OnboardingShared.jsx";
import {
  Trash2Icon, AlertTriangleIcon, XIcon, EyeIcon, EyeOffIcon, LogOutIcon,
  KeyRoundIcon, ShieldCheckIcon, UploadCloudIcon, HelpCircleIcon, FlagIcon,
  ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, FileTextIcon, MailIcon,
  SmartphoneIcon, CheckCircleIcon,
} from "lucide-react";

const FAQ_ITEMS = [
  { q: "How do I book an appointment?", a: "Go to the Search page, find a doctor or institute, and click 'Book Appointment'. You'll need to pay a 50% deposit to confirm." },
  { q: "Can I cancel a booking?", a: "Yes. You can cancel before the appointment is accepted. Once accepted, cancellations are subject to the provider's policy and the deposit is non-refundable." },
  { q: "How does the payment work?", a: "Virtual consultations require a 50% deposit upfront, with the remaining balance due after the session. In-person visits are covered by the deposit alone." },
  { q: "What happens if someone misses a virtual appointment?", a: "The system checks who joined the video call. If the patient misses the appointment, the deposit is non-refundable. If the provider misses the appointment, the patient may file a report so an admin can review the case and decide whether a refund is appropriate." },
  { q: "How do I update my license or permits?", a: "Go to Settings → Licenses & Permits, then click 'Renew' next to the document you want to update. Submit the new image and expiry date for admin review." },
  { q: "What happens if my license expires?", a: "Your account will be placed in 'Needs Renewal' status 60 days before expiry. If it expires without renewal, your account is suspended until the renewal is approved." },
  { q: "How do I dispute an appointment?", a: "While the appointment is ongoing or within 8 hours of completion, you can file a dispute from the appointment details page. An admin will review and resolve it." },
  { q: "How do I change my email or password?", a: "In Settings, under 'Update Credentials', you can request an email or password change. You'll receive a verification code to confirm the update." },
  { q: "How do I delete my account?", a: "Scroll to the bottom of Settings and click 'Delete Account'. This schedules a 30-day soft delete — you can cancel by logging back in within that period." },
];

const FAQModal = ({ onClose }) => {
  const [open, setOpen] = useState(null);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-base-100 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold">Frequently Asked Questions</h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><XIcon className="size-4" /></button>
        </div>
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className="border border-base-300 rounded-lg overflow-hidden">
            <button
              className="w-full flex justify-between items-center p-3 text-left text-sm font-medium hover:bg-base-200"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span>{item.q}</span>
              {open === i ? <ChevronUpIcon className="size-4 shrink-0" /> : <ChevronDownIcon className="size-4 shrink-0" />}
            </button>
            {open === i && <p className="px-3 pb-3 text-sm opacity-70">{item.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

const REPORT_CATEGORIES = [
  { value: "bug", label: "Bug / Something broken" },
  { value: "ux", label: "UI / Usability issue" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other" },
];
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios.js";
import {
  requestEmailUpdate, verifyCurrentEmailUpdate, verifyNewEmailUpdate,
  requestPasswordUpdate, verifyPasswordUpdate,
  requestPermitRenewal, getMyRenewals,
  toggle2FA, toggleEmailNotifications,
  requestPhoneVerify, confirmPhoneVerify, requestPhoneChange,
} from "../lib/api.js";
import { uploadFile } from "../lib/api.js";
import useLogout from "../hooks/useLogout.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const getPasswordValidity = (val) => {
  if (!val) return "Password is required";
  const missing = [];
  if (val.length < 8) missing.push("at least 8 characters");
  if (!/[A-Z]/.test(val)) missing.push("an uppercase letter");
  if (!/[a-z]/.test(val)) missing.push("a lowercase letter");
  if (!/\d/.test(val)) missing.push("a number");
  if (!/[@$!%*?&]/.test(val)) missing.push("a symbol (@$!%*?&)");
  return missing.length > 0 ? "Password needs: " + missing.join(", ") : "";
};

const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

function getLicenseStatus(expiration, pendingRenewal) {
  if (pendingRenewal) return { label: "Renewal Pending", cls: "badge-info" };
  if (!expiration) return { label: "Unknown", cls: "badge-ghost" };
  const exp = new Date(expiration);
  const now = new Date();
  if (exp <= now) return { label: "Expired", cls: "badge-error" };
  if (exp - now <= SIXTY_DAYS) return { label: "Expiring Soon", cls: "badge-warning" };
  return { label: "Valid", cls: "badge-success" };
}

// ── OTP INPUT (reusable) ────────────────────────────────────────────────────
const OtpInput = ({ code, setCode, invalid, setInvalid, error, setError }) => {
  const refs = useRef([]);
  const handleChange = (i, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[i] = value.slice(-1);
    setCode(next);
    setInvalid(false);
    setError("");
    if (value && i < 5) refs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...code];
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setCode(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };
  return (
    <div className="flex justify-center gap-2">
      {code.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className={`input input-bordered w-12 h-12 text-center text-xl font-bold ${invalid ? "input-error" : ""}`}
        />
      ))}
    </div>
  );
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const { authUser } = useAuthUser();
  const queryClient = useQueryClient();
  const { logoutMutation, isPending: isLoggingOut } = useLogout();

  const isAdmin = authUser?.role === "admin";
  const isPatient = authUser?.role === "patient";
  const showPermits = !isAdmin && !isPatient;

  // ── 2FA toggle ─────────────────────────────────────────────────────────
  const [twoFAEnabled, setTwoFAEnabled] = useState(authUser?.twoFactorEnabled ?? false);

  const { mutate: doToggle2FA, isPending: isTogglingTwoFA } = useMutation({
    mutationFn: toggle2FA,
    onSuccess: (data) => {
      setTwoFAEnabled(data.data.twoFactorEnabled);
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: () => toast.error("Failed to update two-factor authentication."),
  });

  // ── Email notifications toggle ──────────────────────────────────────────
  const [emailNotifsEnabled, setEmailNotifsEnabled] = useState(authUser?.emailNotificationsEnabled ?? true);

  const { mutate: doToggleEmailNotifs, isPending: isTogglingEmailNotifs } = useMutation({
    mutationFn: toggleEmailNotifications,
    onSuccess: (data) => {
      setEmailNotifsEnabled(data.data.emailNotificationsEnabled);
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: () => toast.error("Failed to update email notification preference."),
  });

  // ── FAQ & report issue ──────────────────────────────────────────────────
  const [showFAQ, setShowFAQ] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState("bug");
  const [reportSubject, setReportSubject] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const { mutate: submitReport, isPending: isSubmittingReport } = useMutation({
    mutationFn: () => axiosInstance.post("/app-reports", {
      category: reportCategory,
      subject: reportSubject.trim(),
      description: reportDescription.trim(),
    }),
    onSuccess: () => {
      toast.success("Report submitted. Thank you!");
      setShowReportModal(false);
      setReportSubject("");
      setReportDescription("");
      setReportCategory("bug");
    },
    onError: (err) => toast.error(err?.response?.data?.message || "Failed to submit report."),
  });

  // ── delete account ──────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showEmail, setShowEmail] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const maskEmail = (email) => {
    if (!email) return "Not provided";
    const [username, domain] = email.split("@");
    return username.charAt(0) + "*".repeat(username.length - 1) + "@" + domain;
  };

  const { mutate: deleteAccount, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const r = await axiosInstance.delete("/auth/delete-me");
      if (r.status < 200 || r.status >= 300) throw new Error(r.data?.message || "Failed");
      return r.data;
    },
    onSuccess: () => {
      toast.success("Deletion scheduled. You have 30 days to cancel by logging in again.");
      queryClient.clear();
      setTimeout(() => { window.location.href = "/login"; }, 1500);
    },
    onError: (err) => toast.error(err.message || "Failed to delete account"),
  });

  // ── edit profile ────────────────────────────────────────────────────────
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editBio, setEditBio] = useState(authUser?.bio || "");
  const [editLanguages, setEditLanguages] = useState(authUser?.languages || []);
  const [editLangInput, setEditLangInput] = useState("");
  const [editProfilePic, setEditProfilePic] = useState(authUser?.profilePic || {});
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);

  const canEditBio = ["patient", "doctor", "pharmacy", "institute", "department"].includes(authUser?.role);
  const canEditLanguages = ["patient", "doctor"].includes(authUser?.role);

  const { mutate: saveProfile, isPending: isSavingProfile } = useMutation({
    mutationFn: async () => {
      const payload = {};
      if (canEditBio) payload.bio = editBio.trim();
      if (canEditLanguages) payload.languages = editLanguages;

      // Upload new profile pic to S3 if one was selected; old key is deleted server-side
      let picData = editProfilePic;
      if (editProfilePic?.file) {
        const uploaded = await uploadPendingImages({ profilePic: editProfilePic }, ["profilePic"]);
        picData = uploaded.profilePic;
      }
      if (picData?.key) payload.profilePic = picData;

      const response = await axiosInstance.patch("/auth/update-profile", payload);
      return response.data;
    },
    onSuccess: async (data) => {
      const updatedUser = data?.data?.user;
      if (updatedUser) {
        queryClient.setQueryData(["authUser"], (current) => ({
          ...(current || {}),
          data: {
            ...(current?.data || {}),
            ...updatedUser,
          },
        }));
        setEditBio(updatedUser.bio || "");
        setEditLanguages(updatedUser.languages || []);
        setEditProfilePic(updatedUser.profilePic || {});
      }

      await queryClient.invalidateQueries({ queryKey: ["authUser"] });
      await queryClient.refetchQueries({ queryKey: ["authUser"], type: "active" });
      toast.success("Profile updated.");
      setShowEditProfile(false);
    },
    onError: (err) => {
      const validationMessage = err?.response?.data?.errors?.[0]?.message;
      toast.error(validationMessage || err?.response?.data?.message || err.message || "Failed to update profile.");
    },
  });

  const openEditProfile = () => {
    setEditBio(authUser?.bio || "");
    setEditLanguages(authUser?.languages || []);
    setEditLangInput("");
    setEditProfilePic(authUser?.profilePic || {});
    setShowEditProfile(true);
  };

  const addLanguage = () => {
    const lang = editLangInput.trim();
    if (!lang) return;
    if (!editLanguages.includes(lang)) setEditLanguages(prev => [...prev, lang]);
    setEditLangInput("");
  };

  const removeLanguage = (lang) => setEditLanguages(prev => prev.filter(l => l !== lang));

  // ── credentials: state machine ──────────────────────────────────────────
  const [credMode, setCredMode] = useState("password"); // "email" | "password" | "phone"
  const [credStep, setCredStep] = useState("form");     // "form" | "otp1" | "otp2"
  const [credForm, setCredForm] = useState({ currentPassword: "", newEmail: "", newPassword: "", confirmPassword: "", adminCode: "", newPhone: "", newPhoneType: "mobile" });
  const [credError, setCredError] = useState("");
  const [otp1, setOtp1] = useState(["","","","","",""]);
  const [otp1Invalid, setOtp1Invalid] = useState(false);
  const [otp1Error, setOtp1Error] = useState("");
  const [otp2, setOtp2] = useState(["","","","","",""]);
  const [otp2Invalid, setOtp2Invalid] = useState(false);
  const [otp2Error, setOtp2Error] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const newPasswordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const resetCred = () => {
    setCredStep("form");
    setCredForm({ currentPassword: "", newEmail: "", newPassword: "", confirmPassword: "", adminCode: "", newPhone: "", newPhoneType: "mobile" });
    setCredError("");
    setOtp1(["","","","","",""]); setOtp1Invalid(false); setOtp1Error("");
    setOtp2(["","","","","",""]); setOtp2Invalid(false); setOtp2Error("");
    setResendCooldown(0);
  };

  const { mutate: requestEmail, isPending: isRequestingEmail } = useMutation({
    mutationFn: requestEmailUpdate,
    onSuccess: () => { setCredStep("otp1"); setCredError(""); setResendCooldown(60); },
    onError: (err) => setCredError(err?.response?.data?.message || "Failed to send code."),
  });
  const { mutate: verifyCurrentEmail, isPending: isVerifying1 } = useMutation({
    mutationFn: verifyCurrentEmailUpdate,
    onSuccess: () => { setCredStep("otp2"); setOtp1(["","","","","",""]); setResendCooldown(60); },
    onError: (err) => { setOtp1Invalid(true); setOtp1Error(err?.response?.data?.message || "Incorrect code."); setOtp1(["","","","","",""]); },
  });
  const { mutate: verifyNewEmail, isPending: isVerifying2 } = useMutation({
    mutationFn: verifyNewEmailUpdate,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["authUser"] }); toast.success("Email updated. Please log in again."); navigate("/login"); },
    onError: (err) => { setOtp2Invalid(true); setOtp2Error(err?.response?.data?.message || "Incorrect code."); setOtp2(["","","","","",""]); },
  });
  const { mutate: requestPw, isPending: isRequestingPw } = useMutation({
    mutationFn: requestPasswordUpdate,
    onSuccess: () => { setCredStep("otp1"); setCredError(""); setResendCooldown(60); },
    onError: (err) => setCredError(err?.response?.data?.message || "Failed to send code."),
  });
  const [phoneChangeMockCode, setPhoneChangeMockCode] = useState(null);
  const { mutate: requestPhone, isPending: isRequestingPhoneChange } = useMutation({
    mutationFn: requestPhoneChange,
    onSuccess: (data) => { setPhoneChangeMockCode(data?.data?.mockCode || null); setCredStep("otp1"); setCredError(""); },
    onError: (err) => setCredError(err?.response?.data?.message || "Failed to send code."),
  });
  const { mutate: confirmPhone, isPending: isConfirmingPhoneChange } = useMutation({
    mutationFn: (data) => confirmPhoneVerify(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      toast.success("Phone number updated and verified.");
      setShowCredModal(false);
      resetCred();
      setPhoneChangeMockCode(null);
    },
    onError: (err) => { setOtp1Invalid(true); setOtp1Error(err?.response?.data?.message || "Incorrect code."); setOtp1(["","","","","",""]); },
  });
  const { mutate: verifyPw, isPending: isVerifyingPw } = useMutation({
    mutationFn: verifyPasswordUpdate,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["authUser"] }); toast.success("Password updated. Please log in again."); navigate("/login"); },
    onError: (err) => { setOtp1Invalid(true); setOtp1Error(err?.response?.data?.message || "Incorrect code."); setOtp1(["","","","","",""]); },
  });

  const handleCredSubmit = (e) => {
    e.preventDefault();
    setCredError("");
    if (credMode === "email") {
      requestEmail({ currentEmail: authUser?.email, currentPassword: credForm.currentPassword, newEmail: credForm.newEmail, ...(isAdmin && { adminCode: credForm.adminCode }) });
    } else if (credMode === "phone") {
      const digits = credForm.newPhone.replace(/\D/g, "");
      if (digits.length !== 10) { setCredError("Enter a valid 10-digit mobile number."); return; }
      requestPhone({ currentPassword: credForm.currentPassword, phoneNumber: "0" + digits, phoneType: credForm.newPhoneType });
    } else {
      const msg = getPasswordValidity(credForm.newPassword);
      if (msg) { newPasswordRef.current?.setCustomValidity(msg); newPasswordRef.current?.reportValidity(); return; }
      if (credForm.newPassword !== credForm.confirmPassword) { confirmPasswordRef.current?.setCustomValidity("Passwords do not match"); confirmPasswordRef.current?.reportValidity(); return; }
      requestPw({ currentEmail: authUser?.email, currentPassword: credForm.currentPassword, newPassword: credForm.newPassword, confirmPassword: credForm.confirmPassword, ...(isAdmin && { adminCode: credForm.adminCode }) });
    }
  };

  const handleOtp1Submit = (e) => {
    e.preventDefault();
    const code = otp1.join("");
    if (code.length !== 6) return;
    if (credMode === "email") verifyCurrentEmail({ code });
    else if (credMode === "phone") confirmPhone({ code });
    else verifyPw({ code });
  };

  const handleOtp2Submit = (e) => {
    e.preventDefault();
    const code = otp2.join("");
    if (code.length !== 6) return;
    verifyNewEmail({ code });
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    if (credMode === "email") requestEmail({ currentEmail: authUser?.email, currentPassword: credForm.currentPassword, newEmail: credForm.newEmail, ...(isAdmin && { adminCode: credForm.adminCode }) });
    else requestPw({ currentEmail: authUser?.email, currentPassword: credForm.currentPassword, newPassword: credForm.newPassword, confirmPassword: credForm.confirmPassword, ...(isAdmin && { adminCode: credForm.adminCode }) });
  };

  const isCredPending = isRequestingEmail || isVerifying1 || isVerifying2 || isRequestingPw || isVerifyingPw || isRequestingPhoneChange || isConfirmingPhoneChange;

  // ── credentials modal ───────────────────────────────────────────────────
  const [showCredModal, setShowCredModal] = useState(false);

  // ── permits popup ────────────────────────────────────────────────────────
  const [showPermitsModal, setShowPermitsModal] = useState(false);
  const [myRenewals, setMyRenewals] = useState([]);
  const [renewalForm, setRenewalForm] = useState({ type: "", newLicenseNumber: "", licenseCode: "", newExpiration: "", newImageFile: null, newImageUploading: false });
  const [renewalError, setRenewalError] = useState("");
  const [renewalSuccess, setRenewalSuccess] = useState("");

  const loadRenewals = async () => {
    try { const data = await getMyRenewals(); setMyRenewals(data?.data?.renewals || []); } catch {}
  };

  useEffect(() => { if (showPermitsModal) loadRenewals(); }, [showPermitsModal]);

  const pendingRenewalTypes = new Set(myRenewals.filter(r => r.status === "pending").map(r => r.type));

  const licenseItems = () => {
    const role = authUser?.role;
    const items = [];
    if (role === "doctor") {
      items.push({ type: "doctor_license", label: "PRC License", expiration: authUser?.licenseExpiration, hasLicenseNumber: true });
    } else if (role === "pharmacy") {
      items.push({ type: "pharmacist_license", label: "Pharmacist License", expiration: authUser?.pharmacistLicenseExpiration, hasLicenseNumber: true });
      items.push({ type: "pharmacy_business_permit", label: "Business Permit", expiration: authUser?.businessPermitExpiration, hasLicenseNumber: false });
      items.push({ type: "pharmacy_fda_license", label: "FDA License", expiration: authUser?.fdaLicenseExpiration, hasLicenseNumber: false });
    } else if (role === "department") {
      items.push({ type: "technologist_license", label: "Technologist License", expiration: authUser?.technologistLicenseExpiration, hasLicenseNumber: true });
    } else if (role === "institute") {
      items.push({ type: "institute_business_permit", label: "Business Permit", expiration: authUser?.businessPermitExpiration, hasLicenseNumber: false });
      if (authUser?.instituteType === "hospital") {
        items.push({ type: "institute_construction_permit", label: "Construction Permit", expiration: authUser?.constructionPermitExpiration, hasLicenseNumber: false });
      }
    }
    return items;
  };

  // ── phone verification ──────────────────────────────────────────────────
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneTypeInput, setPhoneTypeInput] = useState("mobile");
  const [phoneMockCode, setPhoneMockCode] = useState(null);
  const [phoneOtpInput, setPhoneOtpInput] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneDone, setPhoneDone] = useState(false);

  const openPhoneModal = () => {
    setPhoneInput(authUser?.phoneNumber?.replace(/^0/, "") || "");
    setPhoneTypeInput(authUser?.phoneType || "mobile");
    setPhoneMockCode(null);
    setPhoneOtpInput("");
    setPhoneError("");
    setPhoneDone(false);
    setShowPhoneModal(true);
  };

  const { mutate: doRequestPhone, isPending: isRequestingPhone } = useMutation({
    mutationFn: () => requestPhoneVerify({ phoneNumber: "0" + phoneInput, phoneType: phoneTypeInput }),
    onSuccess: (data) => { setPhoneMockCode(data.data?.mockCode || null); setPhoneError(""); setPhoneOtpInput(""); },
    onError: (err) => setPhoneError(err?.response?.data?.message || "Failed to send code."),
  });

  const { mutate: doConfirmPhone, isPending: isConfirmingPhone } = useMutation({
    mutationFn: () => confirmPhoneVerify({ code: phoneOtpInput }),
    onSuccess: () => {
      setPhoneDone(true);
      setPhoneMockCode(null);
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      toast.success("Phone number verified!");
    },
    onError: (err) => setPhoneError(err?.response?.data?.message || "Incorrect code."),
  });

  const [activeRenewalType, setActiveRenewalType] = useState(null);
  const renewFileRef = useRef(null);
  const minRenewalExp = new Date(new Date().getFullYear(), new Date().getMonth() + 3, 1).toISOString().split("T")[0];

  const { mutate: submitRenewal, isPending: isSubmittingRenewal } = useMutation({
    mutationFn: async ({ type, newLicenseNumber, licenseCode, newExpiration, file }) => {
      let newImage;
      if (file) {
        const result = await uploadFile(file, type === "doctor_license" || type === "pharmacist_license" || type === "technologist_license" ? "licenseImage" : "businessPermit");
        newImage = { url: result.data?.url || "", key: result.data?.key };
      }
      return requestPermitRenewal({
        type,
        newLicenseNumber: newLicenseNumber || undefined,
        licenseCode: licenseCode || undefined,
        newExpiration,
        newImage,
      });
    },
    onSuccess: () => {
      setRenewalSuccess("Renewal submitted for admin approval.");
      setActiveRenewalType(null);
      setRenewalForm({ type: "", newLicenseNumber: "", licenseCode: "", newExpiration: "", newImageFile: null, newImageUploading: false });
      loadRenewals();
      setTimeout(() => setRenewalSuccess(""), 4000);
    },
    onError: (err) => setRenewalError(err?.response?.data?.message || "Failed to submit renewal."),
  });

  return (
    <div className="min-h-screen bg-base-100 p-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-base-content opacity-70 mt-2">Manage your account settings and preferences</p>
        </div>

        {/* Account Information */}
        <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-4">Account Information</h2>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm opacity-70">Email</p>
                  <button onClick={() => setShowEmail(!showEmail)} className="btn btn-ghost btn-xs gap-1">
                    {showEmail ? <><EyeOffIcon className="w-4 h-4" />Hide</> : <><EyeIcon className="w-4 h-4" />Show</>}
                  </button>
                </div>
                <p className="font-semibold">{showEmail ? authUser?.email || "Not provided" : maskEmail(authUser?.email)}</p>
              </div>
              <div><p className="text-sm opacity-70">Role</p><p className="font-semibold capitalize">{authUser?.role || "User"}</p></div>
              <div><p className="text-sm opacity-70">Status</p><p className="font-semibold capitalize">{authUser?.status || "Not onboarded"}</p></div>
              <div>
                <p className="text-sm opacity-70">Joined</p>
                <p className="font-semibold">{authUser?.createdAt ? dayjs(authUser.createdAt).tz(PH_TZ).format("MMMM D, YYYY") : "Unknown"}</p>
              </div>
            </div>
          </div>
        </div>


        {/* Edit Profile */}
        {canEditBio && (
          <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
            <div className="card-body">
              <h2 className="card-title text-xl"><PencilIcon className="w-5 h-5" />Edit Profile</h2>
              <p className="text-sm opacity-70 mt-1">
                Update your bio{canEditLanguages ? " and languages" : ""}.
              </p>
              {authUser?.bio && (
                <p className="text-sm opacity-60 mt-1 line-clamp-2">{authUser.bio}</p>
              )}
              <div className="mt-4">
                <button className="btn btn-primary btn-sm" onClick={openEditProfile}>Edit Profile</button>
              </div>
            </div>
          </div>
        )}

        {/* Session */}
        <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
          <div className="card-body">
            <h2 className="card-title text-xl mb-2">Session</h2>
            <p className="text-sm opacity-70 mb-4">Sign out of your account on this device.</p>
            <button onClick={() => setShowLogoutModal(true)} className="btn btn-outline gap-2" disabled={isLoggingOut}>
              <LogOutIcon className="w-5 h-5" />Logout
            </button>
          </div>
        </div>

        {/* Update Credentials + Licenses/Permits — buttons that open modals */}
        <div className={showPermits ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}>
          <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
            <div className="card-body">
              <h2 className="card-title text-xl"><KeyRoundIcon className="w-5 h-5" />Update Account Credentials</h2>
              <p className="text-sm opacity-70 mt-1">Change your email address, phone number, or password. Limited to once per month.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-primary btn-sm" onClick={() => setShowCredModal(true)}>
                  Update Credentials
                </button>
                {!authUser?.phoneVerified && (
                  <button className="btn btn-outline btn-sm" onClick={openPhoneModal}>
                    {authUser?.phoneNumber ? "Verify Phone" : "Add & Verify Phone"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {showPermits && (
            <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
              <div className="card-body">
                <h2 className="card-title text-xl"><ShieldCheckIcon className="w-5 h-5" />Licenses & Permits</h2>
                <p className="text-sm opacity-70 mt-1">
                  {licenseItems().length} license(s) on file.
                  {authUser?.status === "pending" && <span className="text-warning ml-1">Pending admin review.</span>}
                </p>
                <div className="mt-4">
                  <button className="btn btn-primary btn-sm" onClick={() => { setShowPermitsModal(true); setActiveRenewalType(null); }}>
                    Update Licenses
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2FA Toggle */}
        <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
          <div className="card-body">
            <h2 className="card-title text-xl"><KeyRoundIcon className="w-5 h-5" />Two-Factor Authentication</h2>
            <p className="text-sm opacity-70 mt-1">
              When enabled, each login requires a 6-digit code sent to your email.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={twoFAEnabled}
                disabled={isTogglingTwoFA}
                onChange={() => doToggle2FA()}
              />
              <span className="text-sm font-medium">
                {twoFAEnabled ? "Enabled" : "Disabled"}
              </span>
              {isTogglingTwoFA && <span className="loading loading-spinner loading-xs" />}
            </div>
          </div>
        </div>

        {/* Email Notifications */}
        <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
          <div className="card-body">
            <h2 className="card-title text-xl"><MailIcon className="w-5 h-5" />Email Notifications</h2>
            <p className="text-sm opacity-70 mt-1">
              Receive email updates for appointment events, account changes, and platform alerts. Verification and security codes are always sent.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={emailNotifsEnabled}
                disabled={isTogglingEmailNotifs}
                onChange={() => doToggleEmailNotifs()}
              />
              <span className="text-sm font-medium">
                {emailNotifsEnabled ? "Enabled" : "Disabled"}
              </span>
              {isTogglingEmailNotifs && <span className="loading loading-spinner loading-xs" />}
            </div>
          </div>
        </div>

        {/* Help & Support */}
        <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-1">Help & Support</h2>
            <p className="text-sm opacity-60 mb-4">Find answers or let us know about an issue.</p>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-outline gap-2" onClick={() => setShowFAQ(true)}>
                <HelpCircleIcon className="size-4" />FAQ
              </button>
              <button className="btn btn-outline gap-2" onClick={() => setShowReportModal(true)}>
                <FlagIcon className="size-4" />Report an Issue
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-base-300 flex flex-wrap gap-4">
              <NavLink to="/terms-of-service" className="text-sm text-primary hover:underline flex items-center gap-1">
                <FileTextIcon className="size-3" />Terms of Service
              </NavLink>
              <NavLink to="/privacy-policy" className="text-sm text-primary hover:underline flex items-center gap-1">
                <FileTextIcon className="size-3" />Privacy Policy
              </NavLink>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card bg-base-100 shadow-[0_0_0_1px_rgba(239,68,68,0.20),0_8px_26px_rgba(15,23,42,0.20)] border-2 border-error">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-2 text-error"><AlertTriangleIcon className="w-6 h-6" />Danger Zone</h2>
            <p className="text-sm opacity-70 mb-4">
              Your account will be automatically deleted after 30 days, or sooner by admin action. Logging in again before then will cancel the deletion.
            </p>
            <button onClick={() => { setShowDeleteModal(true); setConfirmText(""); }} className="btn btn-error gap-2" disabled={isDeleting}>
              <Trash2Icon className="w-5 h-5" />Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Licenses Modal — list step */}
      {showPermitsModal && !activeRenewalType && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <button onClick={() => setShowPermitsModal(false)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><XIcon className="w-4 h-4" /></button>
            <h3 className="font-bold text-lg mb-4">Licenses & Permits</h3>
            <div className="space-y-3">
              {licenseItems().map((item) => {
                const isPendingAccount = authUser?.status === "pending";
                const status = isPendingAccount
                  ? { label: "Pending Review", cls: "badge-warning" }
                  : getLicenseStatus(item.expiration, pendingRenewalTypes.has(item.type));
                return (
                  <div key={item.type} className="flex items-center justify-between gap-2 p-3 bg-base-100 rounded-lg border border-base-300">
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs opacity-60">{item.expiration ? dayjs(item.expiration).format("MMM D, YYYY") : "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${status.cls} badge-sm`}>{status.label}</span>
                      {!isPendingAccount && !pendingRenewalTypes.has(item.type) && (
                        <button
                          className="btn btn-xs btn-outline"
                          onClick={() => { setActiveRenewalType(item); setRenewalError(""); setRenewalSuccess(""); }}
                        >
                          Renew
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowPermitsModal(false)} />
        </div>
      )}

      {/* Permit Renewal Modal — renewal form step */}
      {showPermitsModal && activeRenewalType && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <button onClick={() => setActiveRenewalType(null)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><XIcon className="w-4 h-4" /></button>
            <h3 className="font-bold text-lg mb-4">Renew {activeRenewalType.label}</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setRenewalError("");
              submitRenewal({
                type: activeRenewalType.type,
                newLicenseNumber: renewalForm.newLicenseNumber,
                licenseCode: renewalForm.licenseCode,
                newExpiration: renewalForm.newExpiration,
                file: renewalForm.newImageFile,
              });
            }} className="space-y-4">
              <div className="form-control">
                <label className="label"><span className="label-text">New Expiration Date *</span></label>
                <input type="date" min={minRenewalExp} className="input input-bordered w-full" required value={renewalForm.newExpiration} onChange={(e) => setRenewalForm(p => ({ ...p, newExpiration: e.target.value }))} />
              </div>
              {activeRenewalType.hasLicenseNumber && (
                <div className="form-control">
                  <label className="label"><span className="label-text">New License Number (optional)</span></label>
                  <input type="text" className="input input-bordered w-full" placeholder="e.g. MD-12345" value={renewalForm.newLicenseNumber} onChange={(e) => setRenewalForm(p => ({ ...p, newLicenseNumber: e.target.value }))} />
                </div>
              )}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">License Code (optional)</span>
                  <span className="label-text-alt opacity-50">Permanent — for verification only</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. PRC-0012345"
                  value={renewalForm.licenseCode}
                  onChange={(e) => setRenewalForm(p => ({ ...p, licenseCode: e.target.value }))}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Upload New Document</span></label>
                <div
                  className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5"
                  onClick={() => renewFileRef.current?.click()}
                >
                  {renewalForm.newImageFile ? (
                    <p className="text-sm text-success font-medium">{renewalForm.newImageFile.name}</p>
                  ) : (
                    <div>
                      <UploadCloudIcon className="size-7 text-base-content/40 mx-auto mb-1" />
                      <p className="text-sm opacity-60">Click to upload</p>
                    </div>
                  )}
                </div>
                <input ref={renewFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setRenewalForm(p => ({ ...p, newImageFile: e.target.files[0] || null }))} />
              </div>
              {renewalError && <p className="text-error text-sm">{renewalError}</p>}
              {renewalSuccess && <p className="text-success text-sm">{renewalSuccess}</p>}
              <div className="modal-action mt-2">
                <button type="button" className="btn btn-ghost" onClick={() => setActiveRenewalType(null)}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingRenewal || !renewalForm.newExpiration}>
                  {isSubmittingRenewal ? <><span className="loading loading-spinner loading-xs" />Submitting...</> : "Submit Renewal"}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => setShowPermitsModal(false)} />
        </div>
      )}

      {/* Credentials Modal */}
      {showCredModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <button
              onClick={() => { setShowCredModal(false); resetCred(); setPhoneChangeMockCode(null); }}
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-lg mb-1">Update Account Credentials</h3>
            <p className="text-xs text-warning mb-3">Credential updates are limited to once per month.</p>

            {credStep === "form" && (
              <form onSubmit={handleCredSubmit} className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  {["password", "email", "phone"].map((m) => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" className="radio radio-primary radio-sm" checked={credMode === m} onChange={() => { setCredMode(m); setCredError(""); }} />
                      <span className="text-sm capitalize">Change {m === "phone" ? "Phone Number" : m}</span>
                    </label>
                  ))}
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Current Password</span></label>
                  <input type="password" className="input input-bordered w-full" placeholder="••••••••" value={credForm.currentPassword} required onChange={(e) => setCredForm(p => ({ ...p, currentPassword: e.target.value }))} />
                </div>
                {credMode === "email" ? (
                  <div className="form-control">
                    <label className="label"><span className="label-text">New Email</span></label>
                    <input type="email" className="input input-bordered w-full" placeholder="new@email.com" value={credForm.newEmail} required onChange={(e) => setCredForm(p => ({ ...p, newEmail: e.target.value }))} />
                  </div>
                ) : credMode === "phone" ? (
                  <div className="form-control">
                    <label className="label"><span className="label-text">New Phone Number</span></label>
                    <div className="flex gap-2">
                      <select className="select select-bordered w-32 flex-shrink-0" value={credForm.newPhoneType} onChange={(e) => setCredForm(p => ({ ...p, newPhoneType: e.target.value }))}>
                        <option value="mobile">Mobile</option>
                        <option value="telephone">Telephone</option>
                      </select>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60 pointer-events-none">+63</span>
                        <input
                          type="tel"
                          className="input input-bordered w-full pl-12"
                          placeholder="9171234567"
                          value={credForm.newPhone.replace(/^0/, "")}
                          required
                          maxLength={10}
                          onChange={(e) => setCredForm(p => ({ ...p, newPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                        />
                      </div>
                    </div>
                    <p className="text-xs opacity-50 mt-1">A verification code will be sent to confirm your new number.</p>
                  </div>
                ) : (
                  <>
                    <div className="form-control">
                      <label className="label"><span className="label-text">New Password</span></label>
                      <input ref={newPasswordRef} type="password" className="input input-bordered w-full" placeholder="••••••••" value={credForm.newPassword} required
                        onChange={(e) => { setCredForm(p => ({ ...p, newPassword: e.target.value })); e.target.setCustomValidity(""); confirmPasswordRef.current?.setCustomValidity(""); }}
                        onBlur={(e) => e.target.setCustomValidity(getPasswordValidity(e.target.value))} />
                      {!credForm.newPassword && <p className="text-xs opacity-70 mt-1">8+ chars with uppercase, lowercase, number, symbol</p>}
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text">Confirm New Password</span></label>
                      <input ref={confirmPasswordRef} type="password" className="input input-bordered w-full" placeholder="••••••••" value={credForm.confirmPassword} required
                        onChange={(e) => { setCredForm(p => ({ ...p, confirmPassword: e.target.value })); e.target.setCustomValidity(""); }}
                        onBlur={(e) => { if (e.target.value && e.target.value !== credForm.newPassword) e.target.setCustomValidity("Passwords do not match"); else e.target.setCustomValidity(""); }} />
                    </div>
                  </>
                )}
                {isAdmin && (
                  <div className="form-control">
                    <label className="label"><span className="label-text">Admin Code</span></label>
                    <input type="text" className="input input-bordered w-full" placeholder="Enter admin code" value={credForm.adminCode} required onChange={(e) => setCredForm(p => ({ ...p, adminCode: e.target.value }))} />
                  </div>
                )}
                {credError && <p className="text-error text-sm">{credError}</p>}
                <div className="modal-action mt-2">
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowCredModal(false); resetCred(); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={isCredPending}>
                    {isCredPending ? <><span className="loading loading-spinner loading-xs" />Sending...</> : "Send Verification Code"}
                  </button>
                </div>
              </form>
            )}

            {credStep === "otp1" && (
              <form onSubmit={handleOtp1Submit} className="space-y-4">
                {credMode === "phone" && phoneChangeMockCode ? (
                  <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm">
                    <AlertTriangleIcon className="size-4 text-warning mt-0.5 shrink-0" />
                    <p className="text-xs opacity-80">
                      <strong>⚠ Demo mode</strong> — No SMS was sent. Your code is:{" "}
                      <strong className="font-mono text-base">{phoneChangeMockCode}</strong>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm opacity-70">Enter the 6-digit code sent to <span className="font-medium text-primary">{authUser?.email}</span>.</p>
                )}
                <OtpInput code={otp1} setCode={setOtp1} invalid={otp1Invalid} setInvalid={setOtp1Invalid} error={otp1Error} setError={setOtp1Error} />
                {otp1Error && <p className="text-error text-xs text-center">{otp1Error}</p>}
                <button type="submit" className="btn btn-primary w-full" disabled={isCredPending || otp1.join("").length !== 6}>
                  {isCredPending ? <><span className="loading loading-spinner loading-xs" />Verifying...</> : credMode === "email" ? "Verify & Continue" : credMode === "phone" ? "Confirm & Update Phone" : "Update Password"}
                </button>
                {credMode !== "phone" && (
                  <div className="text-center text-sm text-base-content/70">
                    <button type="button" onClick={handleResend} disabled={resendCooldown > 0 || isCredPending} className="text-primary hover:underline disabled:opacity-50 font-medium">
                      {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend Code"}
                    </button>
                  </div>
                )}
                <button type="button" className="btn btn-ghost btn-sm w-full" onClick={resetCred}>Cancel</button>
              </form>
            )}

            {credStep === "otp2" && credMode === "email" && (
              <form onSubmit={handleOtp2Submit} className="space-y-4">
                <p className="text-sm opacity-70">Enter the code sent to your <span className="font-medium text-primary">new email</span>.</p>
                <OtpInput code={otp2} setCode={setOtp2} invalid={otp2Invalid} setInvalid={setOtp2Invalid} error={otp2Error} setError={setOtp2Error} />
                {otp2Error && <p className="text-error text-xs text-center">{otp2Error}</p>}
                <button type="submit" className="btn btn-primary w-full" disabled={isCredPending || otp2.join("").length !== 6}>
                  {isCredPending ? <><span className="loading loading-spinner loading-xs" />Updating...</> : "Confirm New Email"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm w-full" onClick={resetCred}>Cancel</button>
              </form>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => { if (credStep === "form") { setShowCredModal(false); resetCred(); setPhoneChangeMockCode(null); } }} />
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <button onClick={() => setShowDeleteModal(false)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" disabled={isDeleting}><XIcon className="w-4 h-4" /></button>
            <h3 className="font-bold text-xl mb-4 text-error">Schedule Account Deletion?</h3>
            <div className="alert alert-error mb-4"><AlertTriangleIcon className="w-5 h-5" /><span className="text-sm">Account will be permanently deleted after 30 days unless you log in again.</span></div>
            <div className="space-y-4">
              <div>
                <p className="text-sm mb-2">Type <strong>DELETE</strong> to confirm:</p>
                <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="input input-bordered w-full" placeholder="Type DELETE" autoFocus disabled={isDeleting} />
              </div>
              <div className="modal-action">
                <button onClick={() => setShowDeleteModal(false)} className="btn btn-ghost" disabled={isDeleting}>Cancel</button>
                <button onClick={() => { if (confirmText === "DELETE") { deleteAccount(); setShowDeleteModal(false); } else toast.error('Please type "DELETE" to confirm'); }} className="btn btn-error" disabled={isDeleting || confirmText !== "DELETE"}>
                  {isDeleting ? <><span className="loading loading-spinner loading-sm" />Processing...</> : <><Trash2Icon className="w-4 h-4" />Schedule Deletion</>}
                </button>
              </div>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !isDeleting && setShowDeleteModal(false)} />
        </div>
      )}

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="modal modal-open">
          <div className="modal-box text-base-content">
            <h3 className="font-bold text-lg mb-2">Confirm Logout</h3>
            <p className="text-sm opacity-70 mb-4">Are you sure you want to log out?</p>
            <div className="modal-action">
              <button onClick={() => setShowLogoutModal(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => { logoutMutation(); setShowLogoutModal(false); }} className="btn btn-error" disabled={isLoggingOut}>
                {isLoggingOut ? <><span className="loading loading-spinner loading-xs" />Logging out...</> : "Logout"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowLogoutModal(false)} />
        </div>
      )}

      {/* Phone Verification Modal */}
      {showPhoneModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <button onClick={() => setShowPhoneModal(false)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"><XIcon className="w-4 h-4" /></button>
            <h3 className="font-bold text-lg mb-1">Verify Phone Number</h3>
            <p className="text-xs opacity-60 mb-4">Verified phone enables login with phone number and 2FA via SMS.</p>

            {phoneDone ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircleIcon className="size-12 text-success mx-auto" />
                <p className="font-medium text-success">Phone verified successfully!</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowPhoneModal(false)}>Done</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <select
                    className="select select-bordered w-32 flex-shrink-0"
                    value={phoneTypeInput}
                    onChange={e => { setPhoneTypeInput(e.target.value); setPhoneMockCode(null); }}
                    disabled={!!phoneMockCode}
                  >
                    <option value="mobile">Mobile</option>
                    <option value="telephone">Telephone</option>
                  </select>
                  <div className="relative flex-1">
                    {phoneTypeInput === "mobile" && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60 pointer-events-none">+63</span>
                    )}
                    <input
                      type="tel"
                      className={`input input-bordered w-full ${phoneTypeInput === "mobile" ? "pl-12" : ""}`}
                      placeholder={phoneTypeInput === "mobile" ? "9171234567" : "028123456"}
                      value={phoneInput}
                      onChange={e => { setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10)); setPhoneMockCode(null); setPhoneError(""); }}
                      maxLength={10}
                      disabled={!!phoneMockCode}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm h-12"
                    disabled={phoneInput.length !== 10 || phoneTypeInput !== "mobile" || isRequestingPhone}
                    onClick={() => doRequestPhone()}
                  >
                    {isRequestingPhone ? <span className="loading loading-spinner loading-xs" /> : phoneMockCode ? "Resend" : "Send Code"}
                  </button>
                </div>

                {phoneMockCode && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm">
                      <AlertTriangleIcon className="size-4 text-warning mt-0.5 shrink-0" />
                      <p className="text-xs opacity-80">
                        <strong>⚠ Demo mode</strong> — No SMS was sent. Your code is: <strong className="font-mono text-base">{phoneMockCode}</strong>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input input-bordered flex-1 text-center font-mono tracking-widest"
                        placeholder="Enter 6-digit code"
                        value={phoneOtpInput}
                        onChange={e => { setPhoneOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setPhoneError(""); }}
                        maxLength={6}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={phoneOtpInput.length !== 6 || isConfirmingPhone}
                        onClick={() => doConfirmPhone()}
                      >
                        {isConfirmingPhone ? <span className="loading loading-spinner loading-xs" /> : "Verify"}
                      </button>
                    </div>
                  </div>
                )}

                {phoneError && <p className="text-error text-sm">{phoneError}</p>}
              </div>
            )}
          </div>
          <div className="modal-backdrop" onClick={() => setShowPhoneModal(false)} />
        </div>
      )}

      {showFAQ && <FAQModal onClose={() => setShowFAQ(false)} />}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-base-100 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Report an Issue</h2>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowReportModal(false)}><XIcon className="size-4" /></button>
            </div>

            <div>
              <label className="label label-text text-xs">Category</label>
              <select className="select select-bordered select-sm w-full" value={reportCategory} onChange={e => setReportCategory(e.target.value)}>
                {REPORT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label label-text text-xs">Subject</label>
              <input
                className="input input-bordered input-sm w-full"
                placeholder="Brief title"
                maxLength={120}
                value={reportSubject}
                onChange={e => setReportSubject(e.target.value)}
              />
            </div>

            <div>
              <label className="label label-text text-xs">Description</label>
              <textarea
                className="textarea textarea-bordered w-full text-sm"
                rows={4}
                placeholder="Describe the issue in detail..."
                maxLength={2000}
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReportModal(false)} disabled={isSubmittingReport}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                disabled={isSubmittingReport || !reportSubject.trim() || !reportDescription.trim()}
                onClick={() => submitReport()}
              >
                {isSubmittingReport ? <span className="loading loading-spinner loading-xs" /> : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <button onClick={() => setShowEditProfile(false)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
              <XIcon className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-lg mb-4">Edit Profile</h3>
            <div className="space-y-4">
              {/* Profile picture — available to all roles */}
              <ImageUploadField
                label="Profile Picture"
                field="profilePic"
                value={editProfilePic}
                onChange={(val) => setEditProfilePic(val)}
                onUploadingChange={(v) => setUploadingProfilePic(v)}
              />

              {canEditBio && (
                <div className="form-control">
                  <label className="label"><span className="label-text">Bio</span></label>
                  <textarea
                    className="textarea textarea-bordered w-full text-sm"
                    rows={4}
                    placeholder="Tell patients a bit about yourself…"
                    maxLength={500}
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    disabled={isSavingProfile}
                  />
                  <label className="label"><span className="label-text-alt opacity-50">{editBio.length}/500</span></label>
                </div>
              )}

              {canEditLanguages && (
                <div className="form-control">
                  <label className="label"><span className="label-text">Languages Spoken</span></label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editLanguages.map(lang => (
                      <span key={lang} className="badge badge-primary gap-1">
                        {lang}
                        <button className="text-xs" onClick={() => removeLanguage(lang)} disabled={isSavingProfile}>
                          <XIcon className="size-3" />
                        </button>
                      </span>
                    ))}
                    {editLanguages.length === 0 && <span className="text-xs opacity-50">No languages added</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="input input-bordered input-sm flex-1"
                      placeholder="e.g. English, Filipino"
                      value={editLangInput}
                      onChange={e => setEditLangInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLanguage(); } }}
                      disabled={isSavingProfile}
                    />
                    <button className="btn btn-sm btn-outline gap-1" onClick={addLanguage} disabled={isSavingProfile || !editLangInput.trim()}>
                      <PlusIcon className="size-3" />Add
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={() => setShowEditProfile(false)} disabled={isSavingProfile}>Cancel</button>
              <button className="btn btn-primary" onClick={() => saveProfile()} disabled={isSavingProfile || uploadingProfilePic}>
                {isSavingProfile ? <><span className="loading loading-spinner loading-xs" />Saving...</> : "Save Changes"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => !isSavingProfile && setShowEditProfile(false)} />
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
