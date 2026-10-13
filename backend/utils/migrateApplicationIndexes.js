import { Application } from "../models/application.model.js";

export const ensureApplicationIndexes = async () => {
    await Application.collection.createIndex(
        { dedupeKey: 1 },
        { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } }, name: "uniq_application_dedupe_key" },
    );
    const duplicate = await Application.aggregate([
        { $group: { _id: { job: "$job", applicant: "$applicant" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 },
    ]);
    if (duplicate.length) {
        console.warn("Legacy duplicate applications found; keeping records and skipping the unique job/applicant index.");
        return false;
    }
    await Application.collection.createIndex({ job: 1, applicant: 1 }, { unique: true, name: "uniq_application_job_applicant" });
    return true;
};
