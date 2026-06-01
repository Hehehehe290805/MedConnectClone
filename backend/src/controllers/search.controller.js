import mongoose from "mongoose";
import User from "../models/User.js";
import Doctor_Specialty from "../models/DoctorSpecialty.js";
import Subspecialty from "../models/Subspecialty.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const searchDoctors = asyncHandler(async (req, res) => {
    const { type, query } = req.body;

    if (!type || !query) return sendError(res, 400, "Missing search type or query");

    let subspecialtyDoctorIds = [];
    let specialtyDoctorIds = [];
    let nameDoctorIds = [];

    if (type === "subspecialty" && mongoose.Types.ObjectId.isValid(query)) {
        const subDocs = await Doctor_Specialty.find({ subspecialtyId: query, status: "verified" });
        subspecialtyDoctorIds = subDocs.map((d) => d.doctorId.toString());

        const subspecialty = await Subspecialty.findById(query).populate("rootSpecialty");
        if (subspecialty?.rootSpecialty) {
            const rootSpecDocs = await Doctor_Specialty.find({
                specialtyId: subspecialty.rootSpecialty._id,
                status: "verified",
                doctorId: { $nin: subspecialtyDoctorIds },
            });
            specialtyDoctorIds = rootSpecDocs.map((d) => d.doctorId.toString());
        }
    }

    if (type === "specialty" && mongoose.Types.ObjectId.isValid(query)) {
        const specDocs = await Doctor_Specialty.find({ specialtyId: query, status: "verified" });
        specialtyDoctorIds = specDocs.map((d) => d.doctorId.toString());

        const subSpecDocs = await Doctor_Specialty.aggregate([
            {
                $lookup: {
                    from: "subspecialties",
                    localField: "subspecialtyId",
                    foreignField: "_id",
                    as: "subspecialty",
                },
            },
            {
                $match: {
                    "subspecialty.rootSpecialty": new mongoose.Types.ObjectId(query),
                    status: "verified",
                    doctorId: { $nin: specialtyDoctorIds },
                },
            },
        ]);
        subspecialtyDoctorIds = subSpecDocs.map((d) => d.doctorId.toString());
    }

    if (type === "name") {
        const regex = new RegExp(query.trim(), "i");
        const nameDocs = await User.find({
            role: "doctor",
            $or: [{ firstName: regex }, { lastName: regex }],
        }).select("_id");
        nameDoctorIds = nameDocs.map((d) => d._id.toString());
    }

    const allDoctorIds = [...subspecialtyDoctorIds, ...specialtyDoctorIds, ...nameDoctorIds];

    const doctors = await User.find({ _id: { $in: allDoctorIds } })
        .select("firstName lastName profilePic profession")
        .lean();

    const doctorSpecialties = await Doctor_Specialty.find({
        doctorId: { $in: allDoctorIds },
        status: "verified",
    })
        .populate("specialtyId", "name")
        .populate("subspecialtyId", "name")
        .lean();

    const doctorsWithSpecialties = doctors.map((doctor) => {
        const specs = doctorSpecialties.filter((ds) => ds.doctorId.toString() === doctor._id.toString());
        return {
            ...doctor,
            specialties: specs.map((s) => s.specialtyId?.name).filter(Boolean),
            subspecialties: specs.map((s) => s.subspecialtyId?.name).filter(Boolean),
        };
    });

    const doctorsOrdered = allDoctorIds
        .map((id) => doctorsWithSpecialties.find((d) => d._id.toString() === id))
        .filter(Boolean);

    return sendSuccess(res, 200, "Doctors fetched", { doctors: doctorsOrdered });
});

export const getDoctorDetails = asyncHandler(async (req, res) => {
    const { doctorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) return sendError(res, 400, "Invalid doctor ID");

    const doctor = await User.findById(doctorId)
        .populate("specialties", "name")
        .populate("subspecialties", "name")
        .select("-password");

    if (!doctor) return sendError(res, 404, "User not found");

    return sendSuccess(res, 200, "Doctor details fetched", { doctor });
});