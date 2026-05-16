import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

export async function getRecommendedUsers(req, res) {
  try {
    const currentUserId = req.user.id;
    const currentUser = req.user;

    const recommendedUsers = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, //exclude current user
        { _id: { $nin: currentUser.friends } }, // exclude current user's friends
        { isOnboarded: true },
      ],
    });
    res.status(200).json(recommendedUsers);
  } catch (error) {
    console.error("Error in getRecommendedUsers controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function getMyFriends(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("friends")
      .populate("friends", "fullName profilePic nativeLanguage learningLanguage");

    res.status(200).json(user.friends);
  } catch (error) {
    console.error("Error in getMyFriends controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function sendFriendRequest(req, res) {
  try {
    const myId = req.user.id;
    const { id:recipientId }=req.params

    // prevent sending request to oneself
    if (myId === recipientId) {
      return res.status(400).json({ message: "Cannot send friend request to oneself" });
    }

    // check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient user not found" });
    }

    // check if already friends
    if(recipient.friends.includes(myId)){
      return res.status(400).json({ message: "You are already friends with this user" });
    }

    // check if a req already exists, if recipient is sender or vice versa
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: myId, recipient: recipientId },
        { sender: recipientId, recipient: myId },
      ],
    });

    if (existingRequest) {
      return res
        .status(400)
        .json({ message: "A friend request already exists between you and this user" });
    }

    const friendRequest = await FriendRequest.create({
      sender: myId,
      recipient: recipientId,
    });

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error("Error in sendFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function acceptFriendRequest(req, res) {
  try {
    const {id:requestId} = req.params

    const friendRequest = await FriendRequest.findById(requestId);

    if(!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    // ensure that only the recipient can accept the request
    if(friendRequest.recipient.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to accept this friend request" });
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

    // update both users' friends lists
    // $addToSet ensures no duplicates
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.recipient },
    });

    await User.findByIdAndUpdate(friendRequest.recipient, {
      $addToSet: { friends: friendRequest.sender },
    });

    res.status(200).json({ message: "Friend request accepted" });
  } catch(error) {
    console.error("Error in acceptFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getFriendRequests(req, res) {
  try {
    const incomingReqs = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    }).populate("sender", "fullName profilePic nativeLanguage learningLanguage");

    const acceptedReqs = await FriendRequest.find({
      recipient: req.user.id,
      status: "accepted",
    }).populate("recipient", "fullName profilePic");

    // ✅ send everything in ONE response object
    return res.status(200).json({
      incomingReqs,
      acceptedReqs,
    });
  } catch (error) {
    console.error("Error in getFriendRequests controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function getOutgoingFriendRequests(req, res) {
  try {
    const outgoingRequests = await FriendRequest.find({
      sender: req.user.id,
      status: "pending",
    }).populate("recipient", "fullName profilePic nativeLanguage learningLanguage");
    res.status(200).json(outgoingRequests);
  }catch (error) {
    console.error("Error in getOutgoingFriendRequests controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Get users by role
export async function getUsers(req, res) {
  try {
    const users = await User.find({
      status: "onBoarded",
      role: "user",
    }).select("firstName lastName profession birthDate");

    const formatted = users.map(user => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: user.birthDate ? user.birthDate.toISOString().split("T")[0] : null,
    }));

    res.status(200).json({ success: true, users: formatted });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getDoctors(req, res) {
  try {
    const doctors = await User.find({
      status: "onBoarded",
      role: "doctor",
    }).select("-password -licenseNumber -gcash.accountNumber"); // Don't expose sensitive data

    // Return data key to match frontend expectation
    res.status(200).json({ data: doctors });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getPharmacies(req, res) {
  try {
    const pharmacies = await User.find({
      status: "onBoarded",
      role: "pharmacist"
    }).select("firstName lastName profession birthDate facilityName");

    const formatted = pharmacies.map(user => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      profession: user.profession,
      birthDate: user.birthDate ? user.birthDate.toISOString().split("T")[0] : null,
      facilityName: user.facilityName,
    }));

    res.status(200).json({ success: true, users: formatted });
  } catch (error) {
    console.error("Error fetching pharmacies:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getInstitutes(req, res) {
  try {
    const institutes = await User.find({
      status: "onBoarded",
      role: "institute",
    }).select("-password -licenseNumber -gcash.accountNumber"); // Don't expose sensitive data

    // Return data key to match frontend expectation
    res.status(200).json({ data: institutes });
  } catch (error) {
    console.error("Error fetching institutes:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getUserById(req, res) {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select("-password -licenseNumber") // Don't expose sensitive data
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
