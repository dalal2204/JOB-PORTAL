import express from "express";
import { applyJob, getApplicants, getAppliedJobs, getRankedApplicants, getApplicationAnalysis, retryApplicationAnalysis, updateStatus } from "../controllers/application.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import authorizeRoles from "../middlewares/authorize.js";

const router = express.Router();

router.route("/apply/:id").post(isAuthenticated, authorizeRoles("student"), applyJob);
router.route("/get").get(isAuthenticated, authorizeRoles("student"), getAppliedJobs);
router.route("/jobs/:jobId/ranked").get(isAuthenticated, authorizeRoles("recruiter"), getRankedApplicants);
router.route("/analysis/:id").get(isAuthenticated, authorizeRoles("recruiter"), getApplicationAnalysis);
router.route("/analysis/:id/retry").post(isAuthenticated, authorizeRoles("recruiter"), retryApplicationAnalysis);
router.route("/:id/applicants").get(isAuthenticated, authorizeRoles("recruiter"), getApplicants);
router.route("/status/:id/update").post(isAuthenticated, authorizeRoles("recruiter"), updateStatus);

export default router;
