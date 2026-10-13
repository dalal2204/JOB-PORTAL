import { createHash } from "node:crypto";
import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { User } from "../models/user.model.js";
import { parseResumeBuffer } from "./resumeParser.js";
import { analyzeResumeMatch, buildJobText } from "./resumeMatch.js";

const fingerprint = (value) => createHash("sha256").update(value).digest("hex");
const publicError = (error) => {
    const message = String(error?.message || "Resume analysis could not be completed.");
    return message.slice(0, 220);
};

const fetchResume = async (resumeUrl) => {
    if (!resumeUrl) throw new Error("No resume is on the applicant profile.");
    const parsed = new URL(resumeUrl);
    const configuredCloud = process.env.CLOUD_NAME?.trim();
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || parsed.username || parsed.password || !configuredCloud || segments[0] !== configuredCloud || !["raw", "image"].includes(segments[1]) || segments[2] !== "upload") {
        throw new Error("The stored resume URL is not from the configured Cloudinary account.");
    }
    const response = await fetch(resumeUrl, { redirect: "error", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("The stored resume could not be downloaded from Cloudinary.");
    const declaredLength = Number(response.headers.get("content-length"));
    if (declaredLength > 8 * 1024 * 1024) throw new Error("The stored resume exceeds the 8 MB processing limit.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The stored resume response was empty.");
    const chunks = [];
    let byteLength = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > 8 * 1024 * 1024) {
            await reader.cancel();
            throw new Error("The stored resume exceeds the 8 MB processing limit.");
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, byteLength);
};

export const processApplicationAnalysis = async (applicationId, { retry = false } = {}) => {
    const states = retry ? ["pending", "failed"] : ["pending"];
    const application = await Application.findOneAndUpdate(
        { _id: applicationId, "analysis.status": { $in: states } },
        { $set: { "analysis.status": "processing", "analysis.processingAt": new Date(), "analysis.error": null } },
        { new: true },
    );
    if (!application) return Application.findById(applicationId);

    try {
        const [job, applicant] = await Promise.all([
            Job.findById(application.job),
            User.findById(application.applicant).select("profile.resume profile.resumeOriginalName"),
        ]);
        if (!job) throw new Error("The job is no longer available for analysis.");
        const resumeUrl = applicant?.profile?.resume;
        const buffer = await fetchResume(resumeUrl);
        const resume = await parseResumeBuffer(buffer);
        const result = await analyzeResumeMatch({ job, resume });
        if (result.status !== "completed") throw new Error("No scoring criteria could be assessed for this resume and job.");
        await Application.updateOne({ _id: applicationId, "analysis.status": "processing" }, {
            $set: {
                "analysis.status": "completed",
                "analysis.score": result.score,
                "analysis.breakdown": result.breakdown,
                "analysis.matchedSkills": result.matchedSkills,
                "analysis.missingSkills": result.missingSkills,
                "analysis.evidence": result.evidence,
                "analysis.strengths": result.strengths,
                "analysis.gaps": result.gaps,
                "analysis.limitations": result.limitations,
                "analysis.availability": result.availability,
                "analysis.error": null,
                "analysis.analyzedAt": new Date(),
                "analysis.resumeUrl": resumeUrl,
                "analysis.jobFingerprint": fingerprint(buildJobText(job)),
                "analysis.scoringVersion": result.scoringVersion,
                "analysis.modelVersion": result.modelVersion || null,
            },
        });
    } catch (error) {
        await Application.updateOne({ _id: applicationId, "analysis.status": "processing" }, {
            $set: {
                "analysis.status": "failed",
                "analysis.score": null,
                "analysis.error": publicError(error),
                "analysis.analyzedAt": new Date(),
            },
        });
    }
    return Application.findById(applicationId);
};

export const getJobFingerprint = (job) => fingerprint(buildJobText(job));
