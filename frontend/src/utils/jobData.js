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
    }

    return "";
};

export const normalizeJob = (job) => {
    if (!job || typeof job !== "object") {
        return job;
    }

    return {
        ...job,
        company: normalizeCompanyName(job.company),
    };
};

export const normalizeAppliedJob = (application) => {
    if (!application || typeof application !== "object") {
        return application;
    }

    return {
        ...application,
        job: normalizeJob(application.job),
    };
};
