export const normalizeCompanyName = (company) => {
    if (typeof company === "string") {
        return company.trim();
    }

    if (company && typeof company === "object") {
        if (typeof company.name === "string") {
            return company.name.trim();
        }

        if (company._id) {
            return String(company._id);
        }

        if (typeof company.toHexString === "function") {
            return company.toHexString();
        }
    }

    return "";
};

export const serializeJob = (job) => {
    if (!job) {
        return job;
    }

    const plainJob = typeof job.toObject === "function" ? job.toObject() : job;
    return {
        ...plainJob,
        company: normalizeCompanyName(plainJob.company),
        applicantCount: job.applicantCount ?? plainJob.applicantCount ?? plainJob.applications?.length ?? 0,
    };
};

export const serializeApplication = (application) => {
    if (!application) {
        return application;
    }

    const plainApplication = typeof application.toObject === "function"
        ? application.toObject()
        : application;
    const populatedJob = plainApplication.job;

    if (populatedJob && typeof populatedJob === "object" && "company" in populatedJob) {
        return {
            ...plainApplication,
            job: serializeJob(populatedJob),
        };
    }

    return plainApplication;
};
