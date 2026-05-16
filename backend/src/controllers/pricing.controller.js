import Doctor_Specialty from "../models/Doctor_Specialty.js"
import Institute_Service from "../models/Institute_Service.js";
import Pricing from "../models/Pricing.js";
import Service from "../models/Service.js";
import User from "../models/User.js"

// Set or Update Pricing
export async function setOrUpdatePricing(req, res) {
    const providerId = req.user._id;
    const { price, serviceId } = req.body;

    try {
        // Validate price
        if (price === undefined || price === null) {
            return res.status(400).json({ message: "Price is required" });
        }

        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({ message: "Price must be a positive number" });
        }

        // Get user role and verify they exist
        const user = await User.findById(providerId).select("role");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let targetServiceId = null;

        if (user.role === "doctor") {
            // 🚫 DOCTORS: IGNORE any serviceId they pass and force Consultation service
            const consultationService = await Service.findOne({ name: "Appointment" });
            if (!consultationService) {
                return res.status(500).json({
                    message: "Appointment service not found in system"
                });
            }
            targetServiceId = consultationService._id;

            // Check if doctor has at least one verified specialty or subspecialty
            const verifiedClaims = await Doctor_Specialty.findOne({
                doctorId: providerId,
                status: "verified"
            });

            if (!verifiedClaims) {
                return res.status(403).json({
                    message: "You need at least one verified specialty or subspecialty to set pricing"
                });
            }

        } else if (user.role === "institute") {
            // INSTITUTES: Require serviceId
            if (!serviceId) {
                return res.status(400).json({
                    message: "serviceId is required for institutes"
                });
            }
            targetServiceId = serviceId;

            // Institutes can only price services they have verified claims for
            const verifiedServiceClaim = await Institute_Service.findOne({
                instituteId: providerId,
                serviceId: targetServiceId,
                status: "verified"
            });

            if (!verifiedServiceClaim) {
                return res.status(403).json({
                    message: "You can only set pricing for services you have verified claims for"
                });
            }

        } else {
            return res.status(403).json({
                message: "Only doctors and institutes can set pricing"
            });
        }

        // Find or create pricing
        let pricing = await Pricing.findOne({ providerId, serviceId: targetServiceId });

        if (pricing) {
            // Update existing pricing
            pricing.price = price;
        } else {
            // Create new pricing
            pricing = new Pricing({
                providerId,
                serviceId: targetServiceId,
                price
            });
        }

        await pricing.save();

        return res.status(200).json({
            message: "Pricing set/updated successfully",
            pricing
        });

    } catch (error) {
        console.error("Error setting/updating pricing:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

// Get pricing for specific specialty, subspecialty, and service from all providers
export async function getPricing(req, res) {
    const { providerId, serviceId } = req.query;

    try {
        const filter = {};
        if (providerId) filter.providerId = providerId;
        if (serviceId) filter.serviceId = serviceId;

        const pricingList = await Pricing.find(filter)
            .populate('providerId', 'firstName lastName profession facilityName role')
            .populate('serviceId', 'name');

        return res.status(200).json({ pricing: pricingList });
    } catch (error) {
        console.error("Error fetching pricing:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function getDoctorAppointmentPrice(req, res) {
    try {
        const doctorId = req.user._id; // assume user is authenticated and req.user is populated

        const appointmentService = await Service.findOne({ name: "Appointment" });
        if (!appointmentService) {
            return res.status(500).json({ message: "Appointment service not found" });
        }

        const pricing = await Pricing.findOne({
            providerId: doctorId,
            serviceId: appointmentService._id
        });

        if (pricing) {
            return res.status(200).json({ pricing: [pricing] });
        } else {
            return res.status(200).json({ pricing: [] }); // no price set yet
        }
    } catch (error) {
        console.error("Error fetching doctor appointment price:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}