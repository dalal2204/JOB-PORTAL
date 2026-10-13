import mongoose from "mongoose";

export const migrateLegacyCompanyRefs = async () => {
    try {
        const collections = await mongoose.connection.db.listCollections({ name: "companies" }).toArray();
        const hasCompaniesCollection = collections.length > 0;

        const jobs = await mongoose.connection.collection("jobs").find({
            $or: [
                { company: { $type: "objectId" } },
                { company: { $type: "string", $regex: /^[0-9a-fA-F]{24}$/ } },
                { company: { $type: "object" } },
            ],
        }).toArray();

        if (!jobs.length) {
            console.log("No legacy job company references found; migration skipped.");
            return;
        }

        let migrated = 0;
        let unresolved = 0;
        for (const job of jobs) {
            const companyValue = job.company;
            if (companyValue && typeof companyValue === "object" && typeof companyValue.name === "string" && companyValue.name.trim()) {
                await mongoose.connection.collection("jobs").updateOne(
                    { _id: job._id },
                    { $set: { company: companyValue.name.trim() } }
                );
                migrated += 1;
                continue;
            }

            const companyId = typeof companyValue === "string"
                ? companyValue
                : companyValue?._id?.toString() || companyValue?.toString();
            if (!companyId || !mongoose.isValidObjectId(companyId)) {
                unresolved += 1;
                continue;
            }

            if (!hasCompaniesCollection) {
                unresolved += 1;
                continue;
            }

            const companyDoc = await mongoose.connection.collection("companies").findOne({ _id: new mongoose.Types.ObjectId(companyId) });
            if (!companyDoc?.name) {
                unresolved += 1;
                continue;
            }

            await mongoose.connection.collection("jobs").updateOne(
                { _id: job._id },
                { $set: { company: companyDoc.name } }
            );
            migrated += 1;
        }

        console.log(`Legacy job company references migrated: ${migrated}`);
        if (unresolved) {
            console.warn(`Legacy job company references unresolved: ${unresolved}`);
        }
    } catch (error) {
        console.error("Legacy company migration failed:", error.message);
    }
};
