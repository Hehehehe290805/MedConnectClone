import Doctor_Specialty from "../models/Doctor_Specialty.js";
import Institute_Service from "../models/Institute_Service.js";
import Specialty from "../models/Specialty.js";
import Subspecialty from "../models/Subspecialty.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import Report from "../models/Report.js";
import Appointment from "../models/Appointment.js";

// User Management
export async function getPendingUsers(req, res) {
  try {
    const pendingUsers = await User.find({ status: "pending" }).select(
      "_id firstName lastName profession birthDate licenseNumber facilityName adminCode role location"
    );

    // Format users with role-specific information
    const formattedUsers = pendingUsers.map(user => {
      const userObj = { 
        _id: user._id, 
        role: user.role, // Include the requested role
        firstName: user.firstName, 
        lastName: user.lastName 
      };

      // Add role-specific fields
      switch (user.role) {
        case "doctor":
          if (user.profession) userObj.profession = user.profession;
          if (user.birthDate) userObj.birthDate = user.birthDate.toISOString().split("T")[0];
          if (user.licenseNumber) userObj.licenseNumber = user.licenseNumber;
          break;
          
        case "institute":
          if (user.facilityName) userObj.facilityName = user.facilityName;
          if (user.location) userObj.location = user.location;
          break;
          
        case "admin":
          if (user.adminCode) userObj.adminCode = user.adminCode;
          if (user.birthDate) userObj.birthDate = user.birthDate.toISOString().split("T")[0];
          break;
      }

      return userObj;
    });

    res.status(200).json({
      success: true,
      users: formattedUsers,
    });

  } catch (error) {
    console.error("Error fetching pending users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function getAdmins(req, res) {
  try {
    const admins = await User.find({
      status: "onBoarded",
      role: "admin",
    }).select("firstName lastName birthDate");

    const formatted = admins.map(user => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: user.birthDate ? user.birthDate.toISOString().split("T")[0] : null,
    }));

    res.status(200).json({ success: true, users: formatted });
  } catch (error) {
    console.error("Error fetching admins:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function approveRole(req, res) {
  try {
    const { userId } = req.body; // the ObjectId of the user to approve

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // Find the user first
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user is pending
    if (user.status !== "pending") {
      return res.status(400).json({
        message: `User is not pending approval (current status: ${user.status})`
      });
    }

    // Update the status to onBoarded
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { status: "onBoarded", approvedBy: req.user._id },
      { new: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      message: `${updatedUser.firstName} ${updatedUser.lastName} has been approved`,
      user: updatedUser,
    });

  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Specialty and Service Management
export async function getPendingSuggestions(req, res) {
  try {
    // Fetch pending specialties
    const pendingSpecialties = await Specialty.find({ status: "pending" }).select("_id name suggestedBy");
    const formattedSpecialties = pendingSpecialties.map(item => ({
      _id: item._id,
      name: item.name,
      type: "specialty",
      suggestedBy: item.suggestedBy
    }));

    // Fetch pending subspecialties
    const pendingSubspecialties = await Subspecialty.find({ status: "pending" }).select("_id name rootSpecialty suggestedBy");
    const formattedSubspecialties = pendingSubspecialties.map(item => ({
      _id: item._id,
      name: item.name,
      rootSpecialty: item.rootSpecialty,
      type: "subspecialty",
      suggestedBy: item.suggestedBy
    }));

    // Fetch pending services
    const pendingServices = await Service.find({ status: "pending" }).select("_id name suggestedBy");
    const formattedServices = pendingServices.map(item => ({
      _id: item._id,
      name: item.name,
      type: "service",
      suggestedBy: item.suggestedBy
    }));

    // Combine all
    const allPending = [
      ...formattedSpecialties,
      ...formattedSubspecialties,
      ...formattedServices
    ];

    res.status(200).json({ success: true, pendingSuggestions: allPending });
  } catch (error) {
    console.error("Error fetching pending suggestions:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function approveSuggestion(req, res) {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "ID is required"
      });
    }

    // Try to find the item in each collection
    let item = await Specialty.findById(id);
    let type = "specialty";

    if (!item) {
      item = await Subspecialty.findById(id);
      type = "subspecialty";
    }

    if (!item) {
      item = await Service.findById(id);
      type = "service";
    }

    // If still not found, return error
    if (!item) {
      return res.status(404).json({ message: "Item not found in any category" });
    }

    // Check if already verified
    if (item.status === "verified") {
      return res.status(400).json({ message: `${type} is already verified` });
    }

    // Update with admin approval
    item.status = "verified";
    item.approvedBy = req.user._id; // Current admin's ID
    await item.save();

    return res.status(200).json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} approved successfully`,
      item,
      type
    });
  } catch (error) {
    console.error("Error approving item:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getLicenseNumber(req, res) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("licenseNumber") // Only include licenseNumber
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ licenseNumber: user.licenseNumber });
  } catch (error) {
    console.error("Error fetching user license number:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function getPendingClaims(req, res) {
  try {
    // Use claimType field to distinguish between specialty and subspecialty
    const specialtyClaims = await Doctor_Specialty.find({
      status: "pending",
      claimType: "specialty" // 🆕 Use claimType instead of field existence
    })
      .populate("doctorId", "firstName lastName email")
      .populate("specialtyId", "name");

    const subspecialtyClaims = await Doctor_Specialty.find({
      status: "pending",
      claimType: "subspecialty" // 🆕 Use claimType instead of field existence
    })
      .populate("doctorId", "firstName lastName email")
      .populate("subspecialtyId", "name");

    // Service claims (institutes)
    const serviceClaims = await Institute_Service.find({
      status: "pending",
      claimType: "service" // 🆕 Add claimType for consistency
    })
      .populate("instituteId", "facilityName email")
      .populate("serviceId", "name");

    res.status(200).json({
      success: true,
      claims: {
        specialties: specialtyClaims,
        subspecialties: subspecialtyClaims,
        services: serviceClaims,
      },
    });
  } catch (error) {
    console.error("Error fetching claims:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
export async function approveClaim(req, res) {
  try {
    const { claimId } = req.body;
    const adminId = req.user._id;

    if (!claimId) {
      return res.status(400).json({ message: "claimId is required" });
    }

    // Try to find the claim in each model
    let claim = await Doctor_Specialty.findById(claimId);
    let collectionType = "doctor_specialty";

    if (!claim) {
      claim = await Institute_Service.findById(claimId);
      collectionType = "institute_service";
    }

    // If still not found, return error
    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    // 🆕 NOW WE CAN USE THE claimType FIELD!
    const type = claim.claimType;

    // Check if already approved
    if (claim.status === "verified") {
      return res.status(400).json({ message: "Claim is already approved" });
    }

    // Approve the claim
    claim.status = "verified";
    claim.approvedBy = adminId;
    await claim.save();

    res.status(200).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} claim approved successfully`,
      claim,
      type
    });
  } catch (error) {
    console.error("Error approving claim:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Reports
export const viewAllComplaints = async (req, res) => {
  try {
    const complaints = await Report.find()
      .sort({ createdAt: 1 })
      .populate({
        path: "appointmentId",
        select: "doctorId patientId start end status"
      })
      .populate({
        path: "filedBy",
        select: "firstName lastName email" // Adjust based on your User model
      })
      .populate({
        path: "filedAgainst",
        select: "firstName lastName email" // Adjust based on your User model
      });

    res.status(200).json({ success: true, complaints });
  } catch (err) {
    console.error("Error fetching all complaints:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const viewComplaintByComplaintId = async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await Report.findById(id)
      .populate("appointmentId", "doctorId patientId start end status")
      .populate("filedBy", "name email")
      .populate("filedAgainst", "name email");

    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    res.status(200).json({ success: true, complaint });
  } catch (err) {
    console.error("Error fetching complaint:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
export const resolveComplaint = async (req, res) => {
  try {
    const { complaintId, outcome, adminNote } = req.body;
    const adminId = req.user._id; // Assuming this is admin user

    if (!outcome || !adminNote) {
      return res.status(400).json({ message: "Outcome and admin note are required" });
    }

    const complaint = await Report.findById(complaintId);
    if (!complaint) return res.status(404).json({ message: "Complaint not found" });

    // Update the complaint
    complaint.status = "resolved";
    complaint.outcome = outcome;
    complaint.adminNote = adminNote;
    complaint.resolvedBy = adminId;
    await complaint.save();

    // Optional: Update appointment status if frozen
    const appointment = await Appointment.findById(complaint.appointmentId);
    if (appointment && appointment.status === "freeze") {
      appointment.status = "booked"; // Or another logic depending on outcome
      await appointment.save();
    }

    res.status(200).json({ success: true, message: "Complaint resolved", complaint });
  } catch (err) {
    console.error("Error resolving complaint:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};