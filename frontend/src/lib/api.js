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

export const verifyCurrentEmail = async (data) => {
  const response = await axiosInstance.post("/auth/update-email/verify-current", data);
  return response.data;
};

export const verifyNewEmail = async (data) => {
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

// --- ONBOARDING ---
export const completeOnboarding = async (userData) => {
  const roleEndpointMap = {
    patient: "/onboarding/patient",
    doctor: "/onboarding/doctor",
    pharmacy: "/onboarding/pharmacy",
    admin: "/onboarding/admin",
  };
  const endpoint = roleEndpointMap[userData.role];
  if (!endpoint) throw new Error(`Unknown role: ${userData.role}`);
  const response = await axiosInstance.post(endpoint, userData);
  return response.data;
};

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
export async function getUserFriends() {
  const response = await axiosInstance.get("/users/friends");
  return response.data;
}

export async function getRecommendedUsers() {
  const response = await axiosInstance.get("/users");
  return response.data;
}

export async function getOutgoingFriendReqs() {
  const response = await axiosInstance.get("/users/outgoing-friend-requests");
  return response.data;
}

export async function sendFriendRequest(userId) {
  const response = await axiosInstance.post(`/users/friend-request/${userId}`);
  return response.data;
}

export async function getFriendRequests() {
  const response = await axiosInstance.get("/users/friend-requests");
  return response.data;
}

export async function acceptFriendRequest(requestId) {
  const response = await axiosInstance.put(`/users/friend-request/${requestId}/accept`);
  return response.data;
}

export async function getStreamToken() {
  const response = await axiosInstance.get("/chat/token");
  return response.data;
}

export async function getUserById(userId) {
  const response = await axiosInstance.get(`/users/${userId}`);
  return response.data;
}