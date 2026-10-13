const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.id) {
        return res.status(401).json({
            message: "User not authenticated.",
            success: false,
        });
    }

    const userRole = req.userRole;
    if (!userRole || !roles.includes(userRole)) {
        return res.status(403).json({
            message: "You are not authorized to perform this action.",
            success: false,
        });
    }

    next();
};


export default authorizeRoles;
