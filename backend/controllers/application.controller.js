import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { serializeApplication } from "../utils/jobSerialization.js";
import { getJobFingerprint, processApplicationAnalysis } from "../services/applicationAnalysis.js";
import { canRetryAnalysis, getApplicationRejection, recruiterOwnsJob } from "../utils/applicationRules.js";
import { rankApplications } from "../utils/applicationRanking.js";

export const createApplyJobHandler = ({ ApplicationModel = Application, JobModel = Job, analysisProcessor = processApplicationAnalysis } = {}) => async (req, res) => {
    try {
        const userId = req.id;
        const jobId = req.params.id;

        if (!jobId || !mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({
                message: "A valid job id is required.",
                success: false,
            });
        }

        const existingApplication = await ApplicationModel.findOne({ job: jobId, applicant: userId });
        if (existingApplication) {
            const rejection = getApplicationRejection({ duplicate: true, jobExists: true, jobStatus: "active" });
            return res.status(rejection.status).json({ message: rejection.message, success: false });
        }

        const job = await JobModel.findById(jobId);
        const rejection = getApplicationRejection({ duplicate: false, jobExists: Boolean(job), jobStatus: job?.status });
        if (rejection) {
            return res.status(rejection.status).json({ message: rejection.message, success: false });
        }

        const newApplication = await ApplicationModel.create({
            job: jobId,
            applicant: userId,
            dedupeKey: createHash("sha256").update(`${jobId}:${userId}`).digest("hex"),
            status: "pending",
        });

        job.applications.push(newApplication._id);
        await job.save();

        // Persist the application before analysis; parser/provider failures never undo an application.
        let analysisStatus = "pending";
        try {
            const analysis = await analysisProcessor(newApplication._id);
            analysisStatus = analysis?.analysis?.status || analysisStatus;
        } catch (analysisError) {
            console.error("Application saved, but initial analysis could not be started:", analysisError);
        }

        return res.status(201).json({
            message: "Job applied successfully.",
            analysisStatus,
            success: true,
        });
    } catch (error) {
        console.log(error);
        if (error?.code === 11000) {
            return res.status(409).json({ message: "You have already applied for this job.", success: false });
        }
        return res.status(500).json({
            message: "Unable to apply for the job.",
            success: false,
        });
    }
};

export const applyJob = createApplyJobHandler();

export const getAppliedJobs = async (req, res) => {
    try {
        const userId = req.id;
        const applications = await Application.find({ applicant: userId }).sort({ createdAt: -1 }).populate({
            path: "job",
            options: { sort: { createdAt: -1 } },
        });

        return res.status(200).json({
            application: applications.map(serializeApplication),
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to fetch your applications.",
            success: false,
        });
    }
};

export const getApplicants = async (req, res) => {
    try {
        const jobId = req.params.id;
        if (!mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({
                message: "Invalid job id.",
                success: false,
            });
        }

        const job = await Job.findOne({ _id: jobId, created_by: req.id });
        if (!job) {
            return res.status(403).json({
                message: "You are not authorized to view applicants for this job.",
                success: false,
            });
        }

        const applications = await Application.find({ job: jobId }).sort({ createdAt: -1 }).populate({
            path: "applicant",
            select: "fullname email phoneNumber profile createdAt",
        });

        return res.status(200).json({
            job: { applications },
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to fetch applicants.",
            success: false,
        });
    }
};

export const getRankedApplicants = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!mongoose.isValidObjectId(jobId)) return res.status(400).json({ success: false, message: "Invalid job id." });
        const job = await Job.findOne({ _id: jobId, created_by: req.id });
        if (!job) return res.status(404).json({ success: false, message: "Job not found or you do not own this job." });
        const currentJobFingerprint = getJobFingerprint(job);
        const applications = await Application.find({ job: jobId }).populate({ path: "applicant", select: "fullname email phoneNumber profile createdAt" });
        for (const application of applications) {
            const resumeUrl = application.applicant?.profile?.resume || null;
            const previous = application.analysis;
            const outdated = previous?.status === "completed" && (previous.resumeUrl !== resumeUrl || previous.jobFingerprint !== currentJobFingerprint);
            if (outdated) {
                application.analysis = { status: "pending", score: null, error: null, matchedSkills: [], missingSkills: [], evidence: [], strengths: [], gaps: [], limitations: [], breakdown: null };
                await application.save();
            }
            if (!application.analysis?.status) {
                application.analysis = { status: "pending", score: null, matchedSkills: [], missingSkills: [], evidence: [], strengths: [], gaps: [], limitations: [] };
                await application.save();
            }
        }
        return res.status(200).json({ success: true, job: { _id: job._id, title: job.title, company: job.company }, applications: rankApplications(applications) });
    } catch (error) {
        console.error("Ranked applicant fetch failed:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch ranked applicants." });
    }
};

export const getApplicationAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid application id." });
        const application = await Application.findById(id).populate({ path: "job", select: "title company description requirements experienceLevel created_by" }).populate({ path: "applicant", select: "fullname email phoneNumber profile createdAt" });
        if (!application) return res.status(404).json({ success: false, message: "Application not found." });
        if (!recruiterOwnsJob(application.job, req.id)) return res.status(403).json({ success: false, message: "You are not authorized to view this analysis." });
        return res.status(200).json({ success: true, application });
    } catch (error) {
        console.error("Application analysis fetch failed:", error);
        return res.status(500).json({ success: false, message: "Unable to fetch match analysis." });
    }
};

export const retryApplicationAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid application id." });
        const application = await Application.findById(id).populate("job");
        if (!application) return res.status(404).json({ success: false, message: "Application not found." });
        if (!recruiterOwnsJob(application.job, req.id)) return res.status(403).json({ success: false, message: "You are not authorized to analyze this application." });
        if (!application.analysis?.status) {
            application.analysis = { status: "pending", score: null, matchedSkills: [], missingSkills: [], evidence: [], strengths: [], gaps: [], limitations: [] };
            await application.save();
        }
        if (!canRetryAnalysis(application.analysis?.status, application.analysis?.processingAt)) {
            return res.status(409).json({ success: false, message: "Only pending, failed, or stale analyses can be retried." });
        }
        if (!(["pending", "failed"].includes(application.analysis?.status) || application.analysis?.status === "processing")) {
            return res.status(409).json({ success: false, message: "Only pending or failed analyses can be retried." });
        }
        if (application.analysis?.status === "processing") {
            await Application.updateOne({ _id: id, "analysis.status": "processing" }, { $set: { "analysis.status": "pending" } });
        }
        const updated = await processApplicationAnalysis(id, { retry: true });
        return res.status(200).json({ success: true, message: "Analysis retry finished.", analysis: updated?.analysis });
    } catch (error) {
        console.error("Application analysis retry failed:", error);
        return res.status(500).json({ success: false, message: "Unable to retry match analysis." });
    }
};

export const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const applicationId = req.params.id;
        if (!mongoose.isValidObjectId(applicationId)) {
            return res.status(400).json({ message: "Invalid application id.", success: false });
        }
        if (!applicationId || !status) {
            return res.status(400).json({
                message: "Status is required.",
                success: false,
            });
        }

        const normalizedStatus = String(status).toLowerCase();
        if (!['pending', 'accepted', 'rejected'].includes(normalizedStatus)) {
            return res.status(400).json({
                message: "Status must be pending, accepted or rejected.",
                success: false,
            });
        }

        const application = await Application.findById(applicationId).populate("job");
        if (!application) {
            return res.status(404).json({
                message: "Application not found.",
                success: false,
            });
        }

        if (!recruiterOwnsJob(application.job, req.id)) {
            return res.status(403).json({
                message: "You can only update applications for your own jobs.",
                success: false,
            });
        }

        application.status = normalizedStatus;
        await application.save();

        return res.status(200).json({
            message: "Status updated successfully.",
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to update application status.",
            success: false,
        });
    }
};
