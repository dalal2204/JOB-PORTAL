export const getApplicationRejection = ({ duplicate, jobExists, jobStatus }) => {
    if (duplicate) return { status: 409, message: "You have already applied for this job." };
    if (!jobExists) return { status: 404, message: "Job not found." };
    if (jobStatus !== "active") return { status: 400, message: "This job is closed and cannot accept new applications." };
    return null;
};

export const recruiterOwnsJob = (job, recruiterId) => Boolean(job && recruiterId && String(job.created_by?._id || job.created_by) === String(recruiterId));

export const canRetryAnalysis = (status, processingAt, now = Date.now()) => status === "pending" || status === "failed"
    || (status === "processing" && now - new Date(processingAt || 0).getTime() >= 15 * 60 * 1000);
