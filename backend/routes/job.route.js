import express from "express";
import { getAdminJobs, getAllJobs, getJobById, postJob, toggleJobStatus, updateJob } from "../controllers/job.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import authorizeRoles from "../middlewares/authorize.js";

const router = express.Router();

router.route("/post").post(isAuthenticated, authorizeRoles("recruiter"), postJob);
router.route("/get").get(isAuthenticated, getAllJobs);
router.route("/getadminjobs").get(isAuthenticated, authorizeRoles("recruiter"), getAdminJobs);
router.route("/get/:id").get(isAuthenticated, getJobById);
router.route("/:id").put(isAuthenticated, authorizeRoles("recruiter"), updateJob);
router.route("/:id/status").patch(isAuthenticated, authorizeRoles("recruiter"), toggleJobStatus);

export default router;
