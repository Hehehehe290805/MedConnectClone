import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const getRecommendedUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const currentUser = req.user;

  const recommendedUsers = await User.find({
    $and: [
      { _id: { $ne: currentUserId } },
      { _id: { $nin: currentUser.friends } },
      { isOnboarded: true },
    ],
  });

  return sendSuccess(res, 200, "Recommended users fetched", recommendedUsers);
});

export const getMyFriends = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("friends")
    .populate("friends", "firstName lastName profilePic nativeLanguage learningLanguage");

  return sendSuccess(res, 200, "Friends fetched", user.friends);
});

export const sendFriendRequest = asyncHandler(async (req, res) => {
  const myId = req.user._id;
  const { id: recipientId } = req.params;

  if (myId === recipientId) return sendError(res, 400, "Cannot send friend request to oneself");

  const recipient = await User.findById(recipientId);
  if (!recipient) return sendError(res, 404, "Recipient user not found");

  if (recipient.friends.includes(myId)) return sendError(res, 400, "You are already friends with this user");

  const existingRequest = await FriendRequest.findOne({
    $or: [
      { sender: myId, recipient: recipientId },
      { sender: recipientId, recipient: myId },
    ],
  });
  if (existingRequest) return sendError(res, 400, "A friend request already exists between you and this user");

  const friendRequest = await FriendRequest.create({ sender: myId, recipient: recipientId });
  return sendSuccess(res, 201, "Friend request sent", friendRequest);
});

export const acceptFriendRequest = asyncHandler(async (req, res) => {
  const { id: requestId } = req.params;

  const friendRequest = await FriendRequest.findById(requestId);
  if (!friendRequest) return sendError(res, 404, "Friend request not found");
  if (friendRequest.recipient.toString() !== req.user._id) return sendError(res, 403, "You are not authorized to accept this friend request");

  friendRequest.status = "accepted";
  await friendRequest.save();

  await User.findByIdAndUpdate(friendRequest.sender, { $addToSet: { friends: friendRequest.recipient } });
  await User.findByIdAndUpdate(friendRequest.recipient, { $addToSet: { friends: friendRequest.sender } });

  return sendSuccess(res, 200, "Friend request accepted");
});

export const getFriendRequests = asyncHandler(async (req, res) => {
  const [incomingReqs, acceptedReqs] = await Promise.all([
    FriendRequest.find({ recipient: req.user._id, status: "pending" })
      .populate("sender", "firstName lastName profilePic nativeLanguage learningLanguage"),
    FriendRequest.find({ recipient: req.user._id, status: "accepted" })
      .populate("recipient", "firstName lastName profilePic"),
  ]);

  return sendSuccess(res, 200, "Friend requests fetched", { incomingReqs, acceptedReqs });
});

export const getOutgoingFriendRequests = asyncHandler(async (req, res) => {
  const outgoingRequests = await FriendRequest.find({ sender: req.user._id, status: "pending" })
    .populate("recipient", "firstName lastName profilePic nativeLanguage learningLanguage");

  return sendSuccess(res, 200, "Outgoing friend requests fetched", outgoingRequests);
});

export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ status: "onBoarded", role: "user" }).select("firstName lastName profession birthDate");
  const formatted = users.map((user) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate ? user.birthDate.toISOString().split("T")[0] : null,
  }));
  return sendSuccess(res, 200, "Users fetched", { users: formatted });
});

export const getDoctors = asyncHandler(async (req, res) => {
  const doctors = await User.find({ status: "onBoarded", role: "doctor" }).select("-password -licenseNumber -gcash.accountNumber");
  return sendSuccess(res, 200, "Doctors fetched", { data: doctors });
});

export const getPharmacies = asyncHandler(async (req, res) => {
  const pharmacies = await User.find({ status: "onBoarded", role: "pharmacist" })
    .select("firstName lastName profession birthDate facilityName");
  const formatted = pharmacies.map((user) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    profession: user.profession,
    birthDate: user.birthDate ? user.birthDate.toISOString().split("T")[0] : null,
    facilityName: user.facilityName,
  }));
  return sendSuccess(res, 200, "Pharmacies fetched", { users: formatted });
});

export const getInstitutes = asyncHandler(async (req, res) => {
  const institutes = await User.find({ status: "onBoarded", role: "institute" }).select("-password -licenseNumber -gcash.accountNumber");
  return sendSuccess(res, 200, "Institutes fetched", { data: institutes });
});

export const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId).select("-password -licenseNumber").lean();
  if (!user) return sendError(res, 404, "User not found");
  return sendSuccess(res, 200, "User fetched", { data: user });
});