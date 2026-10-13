import { cosineSimilarity, getEmbeddingVectors } from "./embeddingProvider.js";
import { findSkills } from "../utils/skillTaxonomy.js";
import { chunkText, normalizeResumeText } from "./resumeParser.js";

export const SCORING_VERSION = "resume-match-v1";
export const SCORE_WEIGHTS = Object.freeze({ requiredSkills: 35, semanticRelevance: 30, evidenceRelevance: 25, experienceFit: 10 });

const bounded = (value) => Math.min(100, Math.max(0, Math.round(value * 10) / 10));
const unique = (values) => [...new Set(values)];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsTerm = (text, term) => new RegExp(`(^|[^a-z0-9+#.])${escapeRegex(term.toLowerCase())}($|[^a-z0-9+#.])`, "i").test(text);

export const cosineScore = (similarities) => {
    const valid = similarities.filter(Number.isFinite);
    return valid.length ? bounded(Math.max(...valid) * 100) : null;
};

export const buildJobText = (job) => [job.title, job.description, ...(Array.isArray(job.requirements) ? job.requirements : []), job.experienceLevel ? `${job.experienceLevel} years experience` : ""].filter(Boolean).join("\n");

export const scoreResumeMatch = ({ job, resume, semanticScore = null, semanticUnavailableReason = "Semantic analysis is unavailable; the remaining available criteria were renormalized.", providerModel = null }) => {
    const jobText = normalizeResumeText(buildJobText(job));
    const resumeText = normalizeResumeText(resume?.text);
    const requirementsText = normalizeResumeText(Array.isArray(job.requirements) ? job.requirements.join(" ") : "");
    const requiredSkills = findSkills(requirementsText);
    const resumeSkills = resume?.skills || findSkills(resumeText);
    const matchedSkills = requiredSkills.filter((skill) => resumeSkills.includes(skill));
    const missingSkills = requiredSkills.filter((skill) => !resumeSkills.includes(skill));
    const evidenceText = normalizeResumeText(resume?.evidenceText || [resume?.sections?.projects, resume?.sections?.experience].filter(Boolean).join(" "));
    const educationText = normalizeResumeText(resume?.educationText || resume?.sections?.education);
    const evidenceTerms = unique([...findSkills(jobText), ...requiredSkills]);
    const evidenceMatches = evidenceTerms.filter((term) => containsTerm(evidenceText, term));
    const relevantEvidence = evidenceText.split(/(?<=[.!?])\s+/).filter((sentence) => evidenceMatches.some((term) => containsTerm(sentence, term))).slice(0, 5).map((text) => ({ section: (resume?.sections?.projects || "").includes(text) ? "projects" : "experience", text: text.slice(0, 320) }));
    const relevantEducation = educationText.split(/(?<=[.!?])\s+/).filter((sentence) => evidenceTerms.some((term) => containsTerm(sentence, term))).slice(0, 2).map((text) => ({ section: "education", text: text.slice(0, 320) }));

    const criteria = {
        requiredSkills: { label: "Required skill evidence", weight: SCORE_WEIGHTS.requiredSkills, score: requiredSkills.length ? bounded(matchedSkills.length / requiredSkills.length * 100) : null, reason: requiredSkills.length ? `${matchedSkills.length} of ${requiredSkills.length} skills found in the resume text.` : "No recognizable skill requirements were listed for this job." },
        semanticRelevance: { label: "Semantic relevance", weight: SCORE_WEIGHTS.semanticRelevance, score: semanticScore === null ? null : semanticScore, reason: semanticScore === null ? semanticUnavailableReason : "Resume and job description meaning compared using text embeddings." },
        evidenceRelevance: { label: "Project and experience evidence", weight: SCORE_WEIGHTS.evidenceRelevance, score: evidenceTerms.length && evidenceText ? bounded(evidenceMatches.length / evidenceTerms.length * 100) : null, reason: evidenceText && evidenceTerms.length ? `${evidenceMatches.length} job-related terms appear in project or experience text.` : "Project or experience evidence could not be assessed from the extracted resume sections." },
        experienceFit: { label: "Experience level fit", weight: SCORE_WEIGHTS.experienceFit, score: Number(job.experienceLevel) > 0 && Number.isFinite(resume?.yearsExperience) ? bounded(resume.yearsExperience >= Number(job.experienceLevel) ? 100 : resume.yearsExperience / Number(job.experienceLevel) * 100) : null, reason: Number(job.experienceLevel) > 0 && Number.isFinite(resume?.yearsExperience) ? `The job lists ${job.experienceLevel} years; the resume explicitly states ${resume.yearsExperience} years.` : "A numeric job experience level and explicit resume duration were not both available." },
    };
    const available = Object.values(criteria).filter((criterion) => criterion.score !== null);
    const availableWeight = available.reduce((sum, criterion) => sum + criterion.weight, 0);
    const score = availableWeight ? bounded(available.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0) / availableWeight) : null;
    for (const criterion of Object.values(criteria)) {
        criterion.effectiveWeight = criterion.score === null || !availableWeight ? 0 : bounded(criterion.weight / availableWeight * 100);
        criterion.weightedPoints = criterion.score === null || !availableWeight ? null : bounded(criterion.score * criterion.weight / availableWeight);
    }

    const strengths = [];
    if (matchedSkills.length) strengths.push(`Resume text includes ${matchedSkills.slice(0, 5).join(", ")}.`);
    if (relevantEvidence.length) strengths.push(`Project or experience evidence mentions ${evidenceMatches.slice(0, 5).join(", ")}.`);
    const gaps = [];
    if (missingSkills.length) gaps.push(`Not found in the resume text: ${missingSkills.join(", ")}. This does not establish that the candidate lacks these skills.`);
    if (!resume?.sections?.projects && !resume?.sections?.experience) gaps.push("No recognizable project or experience section was extracted from this PDF.");
    if (!requiredSkills.length) gaps.push("No required skills could be identified from the job requirements using the current taxonomy.");

    return {
        status: score === null ? "failed" : "completed",
        score,
        breakdown: criteria,
        matchedSkills,
        missingSkills,
        evidence: [...relevantEvidence, ...relevantEducation],
        strengths,
        gaps,
        limitations: [semanticScore === null ? semanticUnavailableReason : null, "A missing keyword means it was not found in extracted text, not that the candidate lacks the ability.", "This heuristic estimates job relevance; it is not a hiring probability or a guarantee of candidate quality."].filter(Boolean),
        ...(providerModel ? { modelVersion: providerModel } : {}),
        scoringVersion: SCORING_VERSION,
        availability: { semanticRelevance: semanticScore === null ? "unavailable" : "available", resumeEvidence: resumeText ? "available" : "unavailable" },
    };
};

export const analyzeResumeMatch = async ({ job, resume }) => {
    const jobChunks = chunkText(buildJobText(job), 2200, 0).slice(0, 12);
    const resumeChunks = (resume?.chunks?.length ? resume.chunks : chunkText(resume?.text || "", 2200, 0)).slice(0, 20);
    let semanticScore = null;
    let reason = "Semantic matching requires a configured embedding provider.";
    if (jobChunks.length && resumeChunks.length) {
        const result = await getEmbeddingVectors([...jobChunks, ...resumeChunks]);
        if (result.available) {
            const jobVectors = result.vectors.slice(0, jobChunks.length);
            const resumeVectors = result.vectors.slice(jobChunks.length);
            const similarities = resumeVectors.map((resumeVector) => Math.max(...jobVectors.map((jobVector) => cosineSimilarity(jobVector, resumeVector)).filter(Number.isFinite)));
            semanticScore = similarities.length ? Math.max(0, cosineScore(similarities)) : null;
        } else reason = result.reason;
    } else reason = "The job description or resume has no extractable text for semantic comparison.";
    return scoreResumeMatch({ job, resume, semanticScore, semanticUnavailableReason: reason, providerModel: semanticScore === null ? null : process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small" });
};
