import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { 
    getRecommendedUsers, 
    getMyFriends, 
    sendFriendRequest, 
    acceptFriendRequest,
    getFriendRequests,
    getOutgoingFriendRequests,
    getUsers, getDoctors, getPharmacies, getInstitutes, getUserById
} from "../controllers/user.controller.js";

const router = express.Router();

// apply auth middleware to all routes
router.use(protectRoute);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);
router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);
router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendRequests);

// get all users, doctors, pharmacies, institutes
router.get("/users", getUsers);
router.get("/doctors", getDoctors);
router.get("/institutes", getInstitutes);

router.get("/:userId", getUserById);

export default router;