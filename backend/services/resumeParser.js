import { PDFParse } from "pdf-parse";
import { findSkills } from "../utils/skillTaxonomy.js";

export const normalizeResumeText = (text) => String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const chunkText = (text, size = 1400, overlap = 180) => {
    const normalized = normalizeResumeText(text);
    if (!normalized) return [];
    const chunks = [];
    let start = 0;
    while (start < normalized.length) {
        let end = Math.min(start + size, normalized.length);
        if (end < normalized.length) {
            const boundary = normalized.lastIndexOf(" ", end);
            if (boundary > start + size * 0.65) end = boundary;
        }
        chunks.push(normalized.slice(start, end).trim());
        if (end >= normalized.length) break;
        start = Math.max(start + 1, end - overlap);
    }
    return chunks;
};

const SECTION_HEADINGS = {
    projects: /\b(projects?|personal projects?)\b/i,
    experience: /\b(experience|employment|work history|internships?)\b/i,
    education: /\b(education|academic background|qualifications?)\b/i,
};

export const extractResumeSections = (text) => {
    const normalized = normalizeResumeText(text);
    const lines = normalized.split("\n").filter(Boolean);
    const sections = { projects: [], experience: [], education: [] };
    let active = null;
    for (const line of lines) {
        const heading = Object.entries(SECTION_HEADINGS).find(([, pattern]) => pattern.test(line.trim()));
        if (heading && line.trim().length < 80) {
            active = heading[0];
            continue;
        }
        if (active && line.trim()) sections[active].push(line.trim());
    }
    return Object.fromEntries(Object.entries(sections).map(([key, values]) => [key, values.join(" ").slice(0, 7000)]));
};

export const parseResumeBuffer = async (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.subarray(0, 5).toString() !== "%PDF-") {
        throw new Error("The stored resume is not a valid PDF file.");
    }
    let parser;
    try {
        parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const text = normalizeResumeText(result.text);
        if (text.length < 80) throw new Error("This PDF has too little extractable text. Scanned or image-only resumes are not supported yet.");
        const sections = extractResumeSections(text);
        return {
            text,
            chunks: chunkText(text),
            sections,
            skills: findSkills(text),
            evidenceText: [sections.projects, sections.experience].filter(Boolean).join("\n"),
            educationText: sections.education,
            yearsExperience: [...text.matchAll(/\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi)].map((match) => Number(match[1])).filter((value) => value <= 60).sort((a, b) => b - a)[0] ?? null,
        };
    } catch (error) {
        if (error.message?.startsWith("This PDF has too little extractable text")) throw error;
        throw new Error("The resume PDF could not be read. Upload a text-based PDF and try again.");
    } finally {
        try { await parser?.destroy(); } catch { /* Parser cleanup must not replace the useful extraction error. */ }
    }
};

