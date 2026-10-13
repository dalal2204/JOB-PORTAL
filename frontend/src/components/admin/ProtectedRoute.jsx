import { useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
    const { user } = useSelector((store) => store.auth);
    const navigate = useNavigate();

    useEffect(() => {
        if (user === null) {
            navigate("/login", { replace: true });
            return;
        }

        if (user.role !== "recruiter") {
            navigate("/", { replace: true });
        }
    }, [navigate, user]);

    if (!user || user.role !== "recruiter") {
        return null;
    }

    return <>{children}</>;
};

export default ProtectedRoute;