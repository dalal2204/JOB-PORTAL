import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
    job:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Job',
        required:true
    },
    applicant:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    dedupeKey: { type: String, select: false },
    status:{
        type:String,
        enum:['pending', 'accepted', 'rejected'],
        default:'pending'
    },
    analysis: {
        status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
        score: { type: Number, min: 0, max: 100, default: null },
        breakdown: { type: mongoose.Schema.Types.Mixed, default: null },
        matchedSkills: { type: [String], default: [] },
        missingSkills: { type: [String], default: [] },
        evidence: { type: [mongoose.Schema.Types.Mixed], default: [] },
        strengths: { type: [String], default: [] },
        gaps: { type: [String], default: [] },
        limitations: { type: [String], default: [] },
        availability: { type: mongoose.Schema.Types.Mixed, default: null },
        error: { type: String, default: null },
        analyzedAt: { type: Date, default: null },
        processingAt: { type: Date, default: null },
        resumeUrl: { type: String, default: null },
        jobFingerprint: { type: String, default: null },
        scoringVersion: { type: String, default: null },
        modelVersion: { type: String, default: null },
    },
},{timestamps:true});

applicationSchema.index({ job: 1, 'analysis.status': 1, 'analysis.score': -1 });
applicationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } }, name: "uniq_application_dedupe_key" });
export const Application  = mongoose.model("Application", applicationSchema);
