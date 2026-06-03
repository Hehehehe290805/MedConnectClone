import { axiosInstance } from "./axios.js";

// --- AUTH ---
export const signup = async (data) => {
  const response = await axiosInstance.post("/auth/signup", data);
  return response.data;
};

export const verifySignupCode = async (data) => {
  const response = await axiosInstance.post("/auth/signup/verify", data);
  return response.data;
};

export const resendSignupCode = async (data) => {
  const response = await axiosInstance.post("/auth/signup/resend", data);
  return response.data;
};

export const login = async (data) => {
  const response = await axiosInstance.post("/auth/login", data);
  return response.data;
};

export const adminLogin = async (data) => {
  const response = await axiosInstance.post("/auth/admin-login", data);
  return response.data;
};

export const verify2FA = async (data) => {
  const response = await axiosInstance.post("/auth/verify-2fa", data);
  return response.data;
};

export const toggle2FA = async () => {
  const response = await axiosInstance.patch("/auth/toggle-2fa");
  return response.data;
};

export const logout = async () => {
  const response = await axiosInstance.post("/auth/logout");
  return response.data;
};

export const getAuthUser = async () => {
  try {
    const res = await axiosInstance.get("/auth/me");
    return res.data;
  } catch {
    return null;
  }
};

export const deleteMe = async () => {
  const response = await axiosInstance.delete("/auth/delete-me");
  return response.data;
};

export const updateProfile = async (data) => {
  const response = await axiosInstance.patch("/auth/update-profile", data);
  return response.data;
};

export const requestEmailUpdate = async (data) => {
  const response = await axiosInstance.post("/auth/update-email/request", data);
  return response.data;
};

export const verifyCurrentEmailUpdate = async (data) => {
  const response = await axiosInstance.post("/auth/update-email/verify-current", data);
  return response.data;
};

export const verifyNewEmailUpdate = async (data) => {
  const response = await axiosInstance.post("/auth/update-email/verify-new", data);
  return response.data;
};

export const requestPasswordUpdate = async (data) => {
  const response = await axiosInstance.post("/auth/update-password/request", data);
  return response.data;
};

export const verifyPasswordUpdate = async (data) => {
  const response = await axiosInstance.post("/auth/update-password/verify", data);
  return response.data;
};

export const forgotPassword = async (data) => {
  const response = await axiosInstance.post("/auth/forgot-password", data);
  return response.data;
};

export const verifyForgotPassword = async (data) => {
  const response = await axiosInstance.post("/auth/forgot-password/verify", data);
  return response.data;
};

export const resetForgotPassword = async (data) => {
  const response = await axiosInstance.post("/auth/forgot-password/reset", data);
  return response.data;
};

// --- ONBOARDING ---
export const completeOnboarding = async (userData) => {
  const roleEndpointMap = {
    patient: "/onboarding/patient",
    doctor: "/onboarding/doctor",
    pharmacy: "/onboarding/pharmacy",
    institute: "/onboarding/institute",
    admin: "/onboarding/admin",
  };
  const endpoint = roleEndpointMap[userData.role];
  if (!endpoint) throw new Error(`Unknown role: ${userData.role}`);
  const response = await axiosInstance.post(endpoint, userData);
  return response.data;
};

export const createDepartmentAccount = async (data) => {
  const response = await axiosInstance.post("/onboarding/department", data);
  return response.data;
};

export const convertToAdmin = async (data) => {
  const response = await axiosInstance.post("/onboarding/admin/convert", data);
  return response.data;
};

// --- ADMIN ---
export const rejectRole = (data) => axiosInstance.patch("/admin/reject-role", data).then(r => r.data);
export const rejectSuggestion = (data) => axiosInstance.patch("/admin/reject-suggestion", data).then(r => r.data);
export const rejectClaim = (data) => axiosInstance.patch("/admin/reject-claim", data).then(r => r.data);
export const editSuggestion = (data) => axiosInstance.patch("/admin/edit-suggestion", data).then(r => r.data);
export const approveRoleWithItems = (data) => axiosInstance.patch("/admin/approve-role-with-items", data).then(r => r.data);
export const bulkApprove = (data) => axiosInstance.patch("/admin/bulk-approve", data).then(r => r.data);
export const bulkReject = (data) => axiosInstance.patch("/admin/bulk-reject", data).then(r => r.data);
export const getPendingRenewals = () => axiosInstance.get("/admin/pending-renewals").then(r => r.data);
export const approveRenewal = (data) => axiosInstance.patch("/admin/approve-renewal", data).then(r => r.data);
export const rejectRenewal = (data) => axiosInstance.patch("/admin/reject-renewal", data).then(r => r.data);
export const getAllUsers = () => axiosInstance.get("/admin/all-users").then(r => r.data);
export const adminDeleteUser = (userId) => axiosInstance.delete(`/admin/users/${userId}`).then(r => r.data);

// --- PERMIT RENEWALS ---
export const requestPermitRenewal = (data) => axiosInstance.post("/permits/renewal/request", data).then(r => r.data);
export const getMyRenewals = () => axiosInstance.get("/permits/renewal/my-renewals").then(r => r.data);

// --- FILE UPLOAD ---
export const uploadFile = async (file, field) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("field", field);
  const response = await axiosInstance.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getSignedUrl = async (key) => {
  const response = await axiosInstance.get(`/upload/signed-url?key=${encodeURIComponent(key)}`);
  return response.data;
};

// --- PERMITS ---
export const requestDoctorLicenseRenewal = async (data) => {
  const response = await axiosInstance.post("/permits/doctor/license/request", data);
  return response.data;
};

export const requestPharmacistLicenseRenewal = async (data) => {
  const response = await axiosInstance.post("/permits/pharmacy/pharmacist-license/request", data);
  return response.data;
};

export const requestBusinessPermitRenewal = async (data) => {
  const response = await axiosInstance.post("/permits/pharmacy/business-permit/request", data);
  return response.data;
};

export const requestFdaLicenseRenewal = async (data) => {
  const response = await axiosInstance.post("/permits/pharmacy/fda-license/request", data);
  return response.data;
};

export const verifyPermitRenewal = async (data) => {
  const response = await axiosInstance.post("/permits/verify", data);
  return response.data;
};

// --- USERS ---
export async function getUserById(userId) {
  const response = await axiosInstance.get(`/users/${userId}`);
  return response.data;
}

export async function getStreamToken() {
  const response = await axiosInstance.get("/chat/token");
  return response.data;
}

// --- NOTIFICATIONS ---
export const getNotifications = () =>
  axiosInstance.get("/notifications").then(r => r.data);

export const getUnreadNotificationCount = () =>
  axiosInstance.get("/notifications/unread-count").then(r => r.data);

export const markNotificationRead = (id) =>
  axiosInstance.patch(`/notifications/${id}/read`).then(r => r.data);

export const markAllNotificationsRead = () =>
  axiosInstance.patch("/notifications/read-all").then(r => r.data);

// --- APPOINTMENT FILES ---
export const listAppointmentFiles = (appointmentId) =>
  axiosInstance.get(`/appointment-files/${appointmentId}`).then(r => r.data);

export const uploadAppointmentFile = (appointmentId, formData) =>
  axiosInstance.post(`/appointment-files/${appointmentId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then(r => r.data);

export const getAppointmentFileSignedUrl = (fileId) =>
  axiosInstance.get(`/appointment-files/signed/${fileId}`).then(r => r.data);

export const deleteAppointmentFile = (fileId) =>
  axiosInstance.delete(`/appointment-files/file/${fileId}`).then(r => r.data);