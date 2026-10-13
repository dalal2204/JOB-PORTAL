import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    requirements: [{
        type: String,
        trim: true,
    }],
    salary: {
        type: Number,
        required: true,
    },
    experienceLevel: {
        type: Number,
        default: 0,
    },
    location: {
        type: String,
        required: true,
        trim: true,
    },
    jobType: {
        type: String,
        required: true,
        trim: true,
    },
    position: {
        type: Number,
        required: true,
        min: 1,
    },
    company: {
        type: String,
        required: true,
        trim: true,
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active',
    },
    applications: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Application',
        }
    ]
},{timestamps:true});

export const Job = mongoose.model("Job", jobSchema);