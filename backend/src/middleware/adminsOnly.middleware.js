export const adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized - User not found" });
    }

    if (req.user.role !== "admin" || req.user.status !== "onBoarded") {
        return res.status(403).json({ message: "Access denied: Admins only" });
    }

    next();
};
