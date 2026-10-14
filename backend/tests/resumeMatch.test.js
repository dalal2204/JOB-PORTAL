import test from "node:test";
import assert from "node:assert/strict";
import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { User } from "../models/user.model.js";
import { createApplyJobHandler, getRankedApplicants, retryApplicationAnalysis, updateStatus } from "../controllers/application.controller.js";
import authorizeRoles from "../middlewares/authorize.js";
import { analyzeResumeMatch, SCORE_WEIGHTS, scoreResumeMatch } from "../services/resumeMatch.js";
import { cosineSimilarity, getEmbeddingVectors, setEmbeddingClientFactory } from "../services/embeddingProvider.js";
import { extractResumeSections, parseResumeBuffer } from "../services/resumeParser.js";
import { getJobFingerprint, processApplicationAnalysis } from "../services/applicationAnalysis.js";
import { getApplicationRejection, canRetryAnalysis, recruiterOwnsJob } from "../utils/applicationRules.js";
import { rankApplications } from "../utils/applicationRanking.js";
import { findSkills } from "../utils/skillTaxonomy.js";
import { selectTopCandidates } from "../../frontend/src/utils/ranking.js";

const responseMock = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

const makeTextPdf = (content) => {
    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf);
};

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

test("Python, Docker, and Kubernetes are credited only when their names occur in extracted resume text", () => {
    assert.deepEqual(findSkills("Built a Python service, packaged with Docker, and deployed to Kubernetes."), ["Python", "Docker", "Kubernetes"]);
    assert.deepEqual(findSkills("Built a backend service and deployed cloud workloads."), []);
});

test("resume parser recognizes Skills, Technical Skills, Projects, and Experience headings", () => {
    const text = [
        "Skills:",
        "Python and Docker",
        "Technical Skills:",
        "Kubernetes",
        "Projects:",
        "Built a scheduling service using Python and Docker.",
        "Experience:",
        "Maintained Kubernetes deployments for production services.",
    ].join("\n");
    const sections = extractResumeSections(text);
    assert.match(sections.skills, /Python and Docker/);
    assert.match(sections.skills, /Kubernetes/);
    assert.match(sections.projects, /scheduling service/);
    assert.match(sections.experience, /Kubernetes deployments/);
});

test("resume parser captures evidence under common project and work experience heading formats", () => {
    const resumes = [
        ["PROJECTS", "Built an incident dashboard with Python and Docker.", "EXPERIENCE", "Operated Kubernetes services for production."],
        ["PROJECT EXPERIENCE", "Created an SRE alerting project using Python.", "WORK EXPERIENCE", "Maintained Docker and Kubernetes deployments."],
        ["ACADEMIC PROJECTS", "Implemented a Python monitoring tool for cloud systems.", "EXPERIENCE", "Supported Kubernetes-based services."],
    ];

    for (const [projectHeading, projectText, experienceHeading, experienceText] of resumes) {
        const sections = extractResumeSections([projectHeading, projectText, experienceHeading, experienceText].join("\n"));
        assert.match(sections.projects, new RegExp(projectText.split(" ")[0]));
        assert.match(sections.experience, new RegExp(experienceText.split(" ")[0]));
    }
});

test("PDF extraction feeds Project Experience content into evidence matching", async () => {
    const content = "BT /F1 12 Tf 50 760 Td (PROJECT EXPERIENCE) Tj 0 -18 Td (Built a Python service deployed with Docker and Kubernetes.) Tj 0 -30 Td (WORK EXPERIENCE) Tj 0 -18 Td (Operated production Kubernetes services.) Tj ET";
    const resume = await parseResumeBuffer(makeTextPdf(content));
    assert.match(resume.sections.projects, /Built a Python service/);
    assert.match(resume.sections.experience, /Operated production Kubernetes services/);
    assert.match(resume.evidenceText, /Built a Python service/);

    const result = scoreResumeMatch({
        job: { title: "SRE", description: "Operate cloud platforms", requirements: ["Python", "Docker", "Kubernetes"], experienceLevel: 0 },
        resume,
        semanticScore: 77,
    });
    assert.notEqual(result.breakdown.evidenceRelevance.score, null);
    assert.ok(result.evidence.some((item) => item.section === "projects"));

    const unsectioned = await parseResumeBuffer(makeTextPdf("BT /F1 12 Tf 50 700 Td (Python Docker Kubernetes reliability engineer building and operating highly available production services for a cloud platform.) Tj ET"));
    const unsectionedResult = scoreResumeMatch({
        job: { title: "SRE", description: "Operate cloud platforms", requirements: ["Python", "Docker", "Kubernetes"], experienceLevel: 0 },
        resume: unsectioned,
        semanticScore: 77,
    });
    assert.equal(unsectionedResult.breakdown.evidenceRelevance.score, null);
    assert.equal(unsectionedResult.evidence.length, 0);
});

test("extractable PDF text containing Python, Docker, and Kubernetes reaches resume skill matching", async (t) => {
    const parseLogs = [];
    t.mock.method(console, "info", (...args) => parseLogs.push(args));
    const content = "BT /F1 12 Tf 50 700 Td (Python Docker Kubernetes experience building services and deploying reliable container platforms) Tj ET";
    const resume = await parseResumeBuffer(makeTextPdf(content));
    assert.deepEqual(resume.skills, ["Python", "Docker", "Kubernetes"]);
    assert.deepEqual(resume.detectedSections, []);
    assert.deepEqual(parseLogs[0][1].detectedSkills, ["Python", "Docker", "Kubernetes"]);
    assert.equal(JSON.stringify(parseLogs).includes("experience building"), false);
});

test("empty job criteria and missing or empty resume text do not generate a score", () => {
    const job = { title: "", description: "", requirements: [], experienceLevel: 0 };
    for (const resume of [null, { text: "", skills: [] }]) {
        const result = scoreResumeMatch({ job, resume });
        assert.equal(result.score, null);
        assert.equal(result.status, "failed");
    }
});

test("missing Gemini credentials leaves semantic unavailable and renormalizes remaining criteria", async () => {
    const original = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "";
    try {
        const result = await analyzeResumeMatch({
            job: { title: "React engineer", description: "Build interfaces", requirements: ["React"], experienceLevel: 0 },
            resume: { text: "React developer", chunks: ["React developer"], skills: ["React"], evidenceText: "" },
        });
        assert.equal(result.score, 100);
        assert.equal(result.breakdown.semanticRelevance.score, null);
        assert.match(result.breakdown.semanticRelevance.reason, /GEMINI_API_KEY/);
        assert.equal(result.breakdown.requiredSkills.weightedPoints, 100);
    } finally {
        if (original === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = original;
    }
});

test("Gemini embedding generation validates vectors and uses the configured model", async (t) => {
    const oldKey = process.env.GEMINI_API_KEY;
    const oldModel = process.env.GEMINI_EMBEDDING_MODEL;
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_EMBEDDING_MODEL = "test-embedding-model";
    t.after(() => {
        if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
        if (oldModel === undefined) delete process.env.GEMINI_EMBEDDING_MODEL; else process.env.GEMINI_EMBEDDING_MODEL = oldModel;
        setEmbeddingClientFactory();
    });
    let calledWith;
    setEmbeddingClientFactory(() => ({ models: { async embedContent(params) {
        calledWith = params;
        return { embeddings: [{ values: [1, 0] }, { values: [0, 1] }] };
    } } }));
    const result = await getEmbeddingVectors(["job", "resume"]);
    assert.equal(result.available, true);
    assert.deepEqual(result.vectors, [[1, 0], [0, 1]]);
    assert.equal(result.model, "test-embedding-model");
    assert.deepEqual(calledWith.contents, ["job", "resume"]);
    assert.equal(calledWith.model, "test-embedding-model");
});

test("provider errors, timeouts, empty responses, and incompatible vector dimensions are unavailable", async (t) => {
    const oldKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    const logged = [];
    t.mock.method(console, "error", (...args) => logged.push(args));
    t.after(() => { if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; setEmbeddingClientFactory(); });
    for (const error of [Object.assign(new Error("quota"), { status: 429 }), Object.assign(new Error("timeout"), { name: "TimeoutError" })]) {
        setEmbeddingClientFactory(() => ({ models: { async embedContent() { throw error; } } }));
        const result = await getEmbeddingVectors(["text"]);
        assert.equal(result.available, false);
        assert.match(result.reason, /rate limited|timed out/);
    }
    for (const embeddings of [[], [{ values: [] }], [{ values: [1, NaN] }], [{ values: [1] }, { values: [1, 2] }]]) {
        setEmbeddingClientFactory(() => ({ models: { async embedContent() { return { embeddings }; } } }));
        assert.equal((await getEmbeddingVectors(embeddings.length === 2 ? ["a", "b"] : ["a"])).available, false);
    }
    assert.equal((await getEmbeddingVectors([" "])).available, false);
    assert.ok(logged.length > 0);
    assert.equal(JSON.stringify(logged).includes("test-key"), false);
});

test("cosine similarity validates dimensions and computes normalized similarity", () => {
    assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
    assert.equal(cosineSimilarity([1], [1, 0]), null);
    assert.equal(cosineSimilarity([0, 0], [1, 0]), null);
});

test("semantic score uses Gemini embeddings and records provider/model metadata", async (t) => {
    const oldKey = process.env.GEMINI_API_KEY;
    const oldModel = process.env.GEMINI_EMBEDDING_MODEL;
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_EMBEDDING_MODEL = "gemini-test-model";
    setEmbeddingClientFactory(() => ({ models: { async embedContent({ contents }) { return { embeddings: contents.map((_, index) => ({ values: index === 0 ? [1, 0] : [1, 0] })) }; } } }));
    t.after(() => {
        if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
        if (oldModel === undefined) delete process.env.GEMINI_EMBEDDING_MODEL; else process.env.GEMINI_EMBEDDING_MODEL = oldModel;
        setEmbeddingClientFactory();
    });
    const result = await analyzeResumeMatch({
        job: { title: "React engineer", description: "Build interfaces", requirements: ["React"], experienceLevel: 0 },
        resume: { text: "React developer", chunks: ["React developer"], skills: ["React"], evidenceText: "React project" },
    });
    assert.equal(result.breakdown.semanticRelevance.score, 100);
    assert.equal(result.breakdown.semanticRelevance.weight, 30);
    assert.equal(result.breakdown.semanticRelevance.effectiveWeight, 33.3);
    assert.equal(result.modelVersion, "Google Gemini / gemini-test-model");
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

test("Retry analysis endpoint downloads the current PDF, reparses it, recomputes evidence, and returns the saved result", async (t) => {
    const oldCloud = process.env.CLOUD_NAME;
    const oldApiKey = process.env.GEMINI_API_KEY;
    process.env.CLOUD_NAME = "example";
    process.env.GEMINI_API_KEY = "";
    t.after(() => {
        if (oldCloud === undefined) delete process.env.CLOUD_NAME; else process.env.CLOUD_NAME = oldCloud;
        if (oldApiKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldApiKey;
    });
    const logs = [];
    t.mock.method(console, "info", (...args) => logs.push(args));
    const resumeUrl = "https://res.cloudinary.com/example/raw/upload/current-resume.pdf";
    const pdf = makeTextPdf("BT /F1 12 Tf 50 760 Td (Skills) Tj 0 -18 Td (Python Docker Kubernetes) Tj 0 -18 Td (Projects) Tj 0 -18 Td (Built a Python API with Docker and Kubernetes for production.) Tj 0 -18 Td (Experience) Tj 0 -18 Td (Maintained Python services and Kubernetes deployments.) Tj ET");
    let savedAnalysis;
    let downloadCount = 0;
    let filter;
    const applicationId = "507f1f77bcf86cd799439011";
    const existingApplication = {
        _id: applicationId,
        job: { _id: "job-1", created_by: "recruiter-1" },
        analysis: { status: "completed", availability: { semanticRelevance: "unavailable" } },
    };
    t.mock.method(Application, "findOneAndUpdate", async (query) => {
        filter = query;
        return { _id: "application-1", job: "job-1", applicant: "user-1" };
    });
    t.mock.method(Job, "findById", async () => ({ _id: "job-1", title: "Engineer", description: "Build systems", requirements: ["Python", "Docker", "Kubernetes"], experienceLevel: 0 }));
    t.mock.method(User, "findById", () => ({ select: async () => ({ profile: { resume: resumeUrl } }) }));
    t.mock.method(globalThis, "fetch", async (url) => {
        downloadCount += 1;
        assert.equal(url, resumeUrl);
        return new Response(pdf, { status: 200, headers: { "content-type": "application/pdf" } });
    });
    t.mock.method(Application, "updateOne", async (_query, update) => {
        savedAnalysis = update.$set;
        return { matchedCount: 1, modifiedCount: 1 };
    });
    let findByIdCalls = 0;
    t.mock.method(Application, "findById", () => {
        findByIdCalls += 1;
        if (findByIdCalls === 1) return { populate: async () => existingApplication };
        return Promise.resolve({ analysis: {
            status: savedAnalysis["analysis.status"],
            matchedSkills: savedAnalysis["analysis.matchedSkills"],
            evidence: savedAnalysis["analysis.evidence"],
        } });
    });

    const res = responseMock();
    await retryApplicationAnalysis({ params: { id: applicationId }, id: "recruiter-1" }, res);
    assert.equal(downloadCount, 1);
    assert.equal(filter.$or.some((branch) => branch["analysis.availability.semanticRelevance"] === "unavailable"), true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.analysis.status, "completed");
    assert.deepEqual(savedAnalysis["analysis.matchedSkills"], ["Python", "Docker", "Kubernetes"]);
    assert.ok(savedAnalysis["analysis.evidence"].length > 0);
    assert.equal(savedAnalysis["analysis.resumeUrl"], resumeUrl);
    assert.equal(savedAnalysis["analysis.scoringVersion"], "resume-match-v3");
    assert.ok(logs.some(([message, data]) => message === "Cloudinary resume response" && data.httpStatus === 200 && data.contentType === "application/pdf"));
    assert.ok(logs.some(([message, data]) => message === "Resume analysis saved" && data.updated === true && data.status === "completed"));
    assert.equal(JSON.stringify(logs).includes("Built a Python API"), false);
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
    assert.equal(canRetryAnalysis("completed", null, Date.now(), { availability: { semanticRelevance: "unavailable" } }), true);
    assert.equal(canRetryAnalysis("completed", null, Date.now(), { availability: { semanticRelevance: "available" } }), false);
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

test("ranking marks completed analyses from older parser pipelines pending for a fresh retry", async (t) => {
    const job = { _id: "job-1", title: "Engineer", company: "Example", created_by: "recruiter-a", description: "Build systems", requirements: ["Python", "Docker", "Kubernetes"], experienceLevel: 0 };
    let saveCount = 0;
    const resumeUrl = "https://res.cloudinary.com/example/raw/upload/resume.pdf";
    const application = {
        _id: "application-old-analysis",
        applicant: { profile: { resume: resumeUrl } },
        analysis: { status: "completed", score: 0, resumeUrl, jobFingerprint: getJobFingerprint(job), scoringVersion: "resume-match-v2" },
        async save() { saveCount += 1; },
    };
    t.mock.method(Job, "findOne", async () => job);
    t.mock.method(Application, "find", () => ({ populate: async () => [application] }));
    const res = responseMock();
    await getRankedApplicants({ params: { jobId: "507f1f77bcf86cd799439011" }, id: "recruiter-a" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(application.analysis.status, "pending");
    assert.equal(saveCount, 1);
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
