import mongoose from "mongoose";
import { Job } from "../models/job.model.js";
import { normalizeCompanyName, serializeJob } from "../utils/jobSerialization.js";
import { Application } from "../models/application.model.js";

const normalizeRequirements = (requirements) => {
    if (Array.isArray(requirements)) {
        return requirements.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof requirements === "string") {
        return requirements
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
};

export const postJob = async (req, res) => {
    try {
        const { title, description, requirements, salary, location, jobType, experience, position, company } = req.body;
        const userId = req.id;

        const normalizedCompany = normalizeCompanyName(company);
        if (!title || !description || !salary || !location || !jobType || !position || !normalizedCompany) {
            return res.status(400).json({
                message: "All required fields must be provided.",
                success: false,
            });
        }

        const normalizedRequirements = normalizeRequirements(requirements);
        if (!normalizedRequirements.length) {
            return res.status(400).json({
                message: "Job requirements are required.",
                success: false,
            });
        }

        const job = await Job.create({
            title: String(title).trim(),
            description: String(description).trim(),
            requirements: normalizedRequirements,
            salary: Number(salary),
            location: String(location).trim(),
            jobType: String(jobType).trim(),
            experienceLevel: Number(experience || 0),
            position: Number(position),
            company: normalizedCompany,
            created_by: userId,
            status: "active",
        });

        return res.status(201).json({
            message: "Job created successfully.",
            job: serializeJob(job),
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to create job.",
            success: false,
        });
    }
};

export const getAllJobs = async (req, res) => {
    try {
        const keyword = req.query.keyword || "";
        const query = {
            status: "active",
            ...(keyword
                ? {
                    $or: [
                        { title: { $regex: keyword, $options: "i" } },
                        { description: { $regex: keyword, $options: "i" } },
                        { company: { $regex: keyword, $options: "i" } },
                        { location: { $regex: keyword, $options: "i" } },
                    ],
                }
                : {}),
        };

        const jobs = await Job.find(query).sort({ createdAt: -1 });
        return res.status(200).json({
            jobs: jobs.map(serializeJob),
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to fetch jobs.",
            success: false,
        });
    }
};

export const getJobById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid job id.",
                success: false,
            });
        }

        const job = await Job.findById(id);

        if (!job) {
            return res.status(404).json({
                message: "Job not found.",
                success: false,
            });
        }

        const applicantCount = job.applications.length;
        if (job.created_by.toString() === req.id) {
            await job.populate({
                path: "applications",
                populate: { path: "applicant", select: "fullname email phoneNumber profile" },
                options: { sort: { createdAt: -1 } },
            });
        } else {
            // Applicants remain private; a student only receives their own application reference.
            const ownApplication = await Application.findOne({ job: id, applicant: req.id }).select("_id applicant");
            job.applications = ownApplication ? [ownApplication] : [];
        }
        job.applicantCount = applicantCount;

        return res.status(200).json({
            job: serializeJob(job),
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to fetch job details.",
            success: false,
        });
    }
};

export const getAdminJobs = async (req, res) => {
    try {
        const adminId = req.id;
        const jobs = await Job.find({ created_by: adminId }).sort({ createdAt: -1 });
        return res.status(200).json({
            jobs: jobs.map(serializeJob),
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to fetch recruiter jobs.",
            success: false,
        });
    }
};

export const updateJob = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid job id.",
                success: false,
            });
        }

        const job = await Job.findById(id);
        if (!job) {
            return res.status(404).json({
                message: "Job not found.",
                success: false,
            });
        }

        if (job.created_by.toString() !== req.id) {
            return res.status(403).json({
                message: "You can only edit your own jobs.",
                success: false,
            });
        }

        const { title, description, requirements, salary, location, jobType, experience, position, company } = req.body;
        const normalizedCompany = normalizeCompanyName(company);
        if (title) job.title = String(title).trim();
        if (description) job.description = String(description).trim();
        if (requirements) job.requirements = normalizeRequirements(requirements);
        if (salary) job.salary = Number(salary);
        if (location) job.location = String(location).trim();
        if (jobType) job.jobType = String(jobType).trim();
        if (experience !== undefined) job.experienceLevel = Number(experience || 0);
        if (position) job.position = Number(position);
        if (normalizedCompany) job.company = normalizedCompany;

        await job.save();

        return res.status(200).json({
            message: "Job updated successfully.",
            job: serializeJob(job),
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to update job.",
            success: false,
        });
    }
};

export const toggleJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid job id.",
                success: false,
            });
        }

        const job = await Job.findOne({ _id: id, created_by: req.id });
        if (!job) {
            return res.status(404).json({
                message: "Job not found or you do not own this job.",
                success: false,
            });
        }

        const nextStatus = String(status || job.status).toLowerCase();
        if (!['active', 'closed'].includes(nextStatus)) {
            return res.status(400).json({
                message: "Status must be active or closed.",
                success: false,
            });
        }

        job.status = nextStatus;
        await job.save();

        return res.status(200).json({
            message: `Job marked as ${job.status}.`,
            job: serializeJob(job),
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Unable to update job status.",
            success: false,
        });
    }
};
