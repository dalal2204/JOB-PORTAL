import mongoose from "mongoose";
import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { serializeApplication } from "../utils/jobSerialization.js";

export const applyJob = async (req, res) => {
    try {
        const userId = req.id;
        const jobId = req.params.id;

        if (!jobId || !mongoose.isValidObjectId(jobId)) {
            return res.status(400).json({
                message: "A valid job id is required.",
                success: false,
            });
        }

        const existingApplication = await Application.findOne({ job: jobId, applicant: userId });
        if (existingApplication) {
            return res.status(400).json({
                message: "You have already applied for this job.",
                success: false,
            });
        }

        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                message: "Job not found.",
                success: false,
            });
        }

        if (job.status !== "active") {
            return res.status(400).json({
                message: "This job is closed and cannot accept new applications.",
                success: false,
            });
        }

        const newApplication = await Application.create({
            job: jobId,
            applicant: userId,
            status: "pending",
        });

        job.applications.push(newApplication._id);
        await job.save();

        return res.status(201).json({
            message: "Job applied successfully.",
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to apply for the job.",
            success: false,
        });
    }
};

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

export const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const applicationId = req.params.id;
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

        if (application.job.created_by.toString() !== req.id) {
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