import test from "node:test";
import assert from "node:assert/strict";
import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { createApplyJobHandler, getRankedApplicants, updateStatus } from "../controllers/application.controller.js";
import authorizeRoles from "../middlewares/authorize.js";
import { analyzeResumeMatch, SCORE_WEIGHTS, scoreResumeMatch } from "../services/resumeMatch.js";
import { parseResumeBuffer } from "../services/resumeParser.js";
import { getApplicationRejection, canRetryAnalysis, recruiterOwnsJob } from "../utils/applicationRules.js";
import { rankApplications } from "../utils/applicationRanking.js";
import { selectTopCandidates } from "../../frontend/src/utils/ranking.js";

const responseMock = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("configured scoring weights total exactly 100", () => {
    assert.equal(Object.values(SCORE_WEIGHTS).reduce((total, weight) => total + weight, 0), 100);
});

test("skill matching recognizes aliases and separates skills not found in resume text", () => {
    const result = scoreResumeMatch({
        job: { title: "Web Developer", description: "Build APIs", requirements: ["React", "Node.js", "Python"], experienceLevel: 0 },
        resume: { text: "Built a React dashboard with NodeJS.", skills: ["React", "Node.js"], evidenceText: "React dashboard built with NodeJS." },
    });
    assert.deepEqual(result.matchedSkills, ["React", "Node.js"]);
    assert.deepEqual(result.missingSkills, ["Python"]);
    assert.equal(result.breakdown.requiredSkills.score, 66.7);
    assert.match(result.gaps[0], /does not establish that the candidate lacks/);
});

test("empty job criteria and missing or empty resume text do not generate a score", () => {
    const job = { title: "", description: "", requirements: [], experienceLevel: 0 };
    for (const resume of [null, { text: "", skills: [] }]) {
        const result = scoreResumeMatch({ job, resume });
        assert.equal(result.score, null);
        assert.equal(result.status, "failed");
    }
});

test("semantic unavailability is explicit and remaining assessable criteria are renormalized", async () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";
    try {
        const result = await analyzeResumeMatch({
            job: { title: "React engineer", description: "Build interfaces", requirements: ["React"], experienceLevel: 0 },
            resume: { text: "React developer", chunks: ["React developer"], skills: ["React"], evidenceText: "" },
        });
        assert.equal(result.score, 100);
        assert.equal(result.breakdown.semanticRelevance.score, null);
        assert.match(result.breakdown.semanticRelevance.reason, /OPENAI_API_KEY/);
        assert.equal(result.breakdown.requiredSkills.weightedPoints, 100);
    } finally {
        if (original === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = original;
    }
});

test("unreadable and scanned or empty-text PDFs fail with concise extraction errors", async () => {
    await assert.rejects(parseResumeBuffer(Buffer.from("not a pdf")), /valid PDF/i);
    await assert.rejects(parseResumeBuffer(Buffer.from("%PDF-1.4\nmalformed")), /could not be read|extractable text/i);
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>",
        "<< /Length 0 >>\nstream\n\nendstream",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    await assert.rejects(parseResumeBuffer(Buffer.from(pdf)), /too little extractable text/i);
});

test("application rules reject duplicates and closed jobs while preserving pending, accepted, and rejected statuses", () => {
    assert.equal(getApplicationRejection({ duplicate: true, jobExists: true, jobStatus: "active" }).status, 409);
    assert.equal(getApplicationRejection({ duplicate: false, jobExists: false, jobStatus: null }).status, 404);
    assert.equal(getApplicationRejection({ duplicate: false, jobExists: true, jobStatus: "closed" }).status, 400);
    assert.equal(getApplicationRejection({ duplicate: false, jobExists: true, jobStatus: "active" }), null);
    assert.deepEqual(Application.schema.path("status").enumValues, ["pending", "accepted", "rejected"]);
});

test("application handler creates one pending application, rejects duplicates, and blocks closed jobs", async () => {
    const jobId = "507f1f77bcf86cd799439011";
    const applicant = "507f1f77bcf86cd799439012";
    let createCount = 0;
    const job = { status: "active", applications: [], async save() {} };
    const applicationModel = {
        async findOne() { return null; },
        async create(document) { createCount += 1; return { _id: "application-1", ...document }; },
    };
    const jobModel = { async findById() { return job; } };
    const handler = createApplyJobHandler({ ApplicationModel: applicationModel, JobModel: jobModel, analysisProcessor: async () => ({ analysis: { status: "failed" } }) });
    const res = responseMock();
    await handler({ id: applicant, params: { id: jobId } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.analysisStatus, "failed");
    assert.equal(job.applications.length, 1);
    assert.equal(createCount, 1);

    applicationModel.findOne = async () => ({ _id: "application-1" });
    const duplicateRes = responseMock();
    await handler({ id: applicant, params: { id: jobId } }, duplicateRes);
    assert.equal(duplicateRes.statusCode, 409);
    assert.equal(createCount, 1);

    applicationModel.findOne = async () => null;
    job.status = "closed";
    const closedRes = responseMock();
    await handler({ id: applicant, params: { id: jobId } }, closedRes);
    assert.equal(closedRes.statusCode, 400);
    assert.equal(createCount, 1);
});

test("recruiter ownership and persisted analysis retry states are checked", () => {
    assert.equal(recruiterOwnsJob({ created_by: "recruiter-a" }, "recruiter-a"), true);
    assert.equal(recruiterOwnsJob({ created_by: { _id: "recruiter-b" } }, "recruiter-a"), false);
    assert.equal(canRetryAnalysis("pending", null), true);
    assert.equal(canRetryAnalysis("failed", null), true);
    assert.equal(canRetryAnalysis("completed", null), false);
    assert.equal(canRetryAnalysis("processing", new Date(1000), 1000 + 14 * 60 * 1000), false);
    assert.equal(canRetryAnalysis("processing", new Date(1000), 1000 + 15 * 60 * 1000), true);
});

test("ranked endpoint returns only owned jobs and status updates preserve application status values", async (t) => {
    const job = { _id: "job-1", title: "Engineer", company: "Example", created_by: "recruiter-a" };
    t.mock.method(Job, "findOne", async (query) => query.created_by === "recruiter-a" ? job : null);
    t.mock.method(Application, "find", () => ({ populate: async () => [] }));
    const ownResponse = responseMock();
    await getRankedApplicants({ params: { jobId: "507f1f77bcf86cd799439011" }, id: "recruiter-a" }, ownResponse);
    assert.equal(ownResponse.statusCode, 200);
    const otherResponse = responseMock();
    await getRankedApplicants({ params: { jobId: "507f1f77bcf86cd799439011" }, id: "recruiter-b" }, otherResponse);
    assert.equal(otherResponse.statusCode, 404);

    const application = { job: { created_by: "recruiter-a" }, status: "pending", async save() {} };
    t.mock.method(Application, "findById", () => ({ populate: async () => application }));
    const statusResponse = responseMock();
    await updateStatus({ params: { id: "507f1f77bcf86cd799439013" }, body: { status: "accepted" }, id: "recruiter-a" }, statusResponse);
    assert.equal(statusResponse.statusCode, 200);
    assert.equal(application.status, "accepted");
});

test("recruiter route role middleware blocks student access", () => {
    let nextCalled = false;
    const res = responseMock();
    authorizeRoles("recruiter")({ id: "student-1", userRole: "student" }, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
});

test("ranking sorts completed scores first and top-N only limits visible rows", () => {
    const ranked = rankApplications([
        { _id: "failed", analysis: { status: "failed" }, createdAt: "2025-01-01" },
        { _id: "low", analysis: { status: "completed", score: 36 }, createdAt: "2025-01-02" },
        { _id: "high", analysis: { status: "completed", score: 94 }, createdAt: "2025-01-01" },
        { _id: "pending", analysis: { status: "pending" }, createdAt: "2025-02-01" },
    ]);
    assert.deepEqual(ranked.map(item => item._id), ["high", "low", "pending", "failed"]);
    assert.deepEqual(selectTopCandidates(ranked.slice(0, 2), 1).map(item => item._id), ["high"]);
    assert.equal(ranked.length, 4);
    assert.equal(selectTopCandidates(ranked.slice(0, 2), "all").length, 2);
});
