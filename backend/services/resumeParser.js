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
    skills: /^(?:(?:technical|core|key)\s+)?skills?(?:\s*(?:&|\/|\|)\s*(?:technologies|tools))?$|^(?:core competencies|technologies|technical toolkit)$/i,
    projects: /^(?:(?:(?:personal|academic|selected|key)\s+)?projects?|project\s+experience)$/i,
    experience: /^(?:(?:professional|work|relevant)\s+)?experience$|^(?:employment|work)\s+history$|^internships?$/i,
    education: /^(?:education|academic background|qualifications?)$/i,
};

const normalizeHeading = (line) => line.trim()
    .replace(/^[\s•●▪◦*#-]+/u, "")
    .replace(/^\d+[.)-]\s*/, "")
    .replace(/[\s:|–—-]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

const collectResumeSections = (text) => {
    const normalized = normalizeResumeText(text);
    const lines = normalized.split("\n").filter(Boolean);
    const sections = { skills: [], projects: [], experience: [], education: [] };
    const detectedSections = [];
    let active = null;
    for (const line of lines) {
        const heading = Object.entries(SECTION_HEADINGS).find(([, pattern]) => pattern.test(normalizeHeading(line)));
        if (heading) {
            active = heading[0];
            detectedSections.push(active);
            continue;
        }
        if (active && line.trim()) sections[active].push(line.trim());
    }
    return {
        sections: Object.fromEntries(Object.entries(sections).map(([key, values]) => [key, values.join(" ").slice(0, 7000)])),
        detectedSections: [...new Set(detectedSections)],
    };
};

export const extractResumeSections = (text) => collectResumeSections(text).sections;

export const parseResumeBuffer = async (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.subarray(0, 5).toString() !== "%PDF-") {
        console.warn("Downloaded resume is not a PDF", { pdfByteLength: Buffer.isBuffer(buffer) ? buffer.length : null, pdfSignatureValid: false });
        throw new Error("The stored resume is not a valid PDF file.");
    }
    let parser;
    try {
        parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const text = normalizeResumeText(result.text);
        if (text.length < 80) {
            console.warn("Resume PDF has too little extractable text", { pdfHasExtractableText: false, pdfByteLength: buffer.length, extractedTextLength: text.length, likelyScannedOrImageOnly: true });
            throw new Error("This PDF has too little extractable text. It may be scanned or image-only; upload a text-based PDF instead.");
        }
        const { sections, detectedSections } = collectResumeSections(text);
        const skills = findSkills(text);
        console.info("Resume PDF extracted", { pdfHasExtractableText: true, extractedTextLength: text.length, detectedSections, detectedSkills: skills });
        return {
            text,
            chunks: chunkText(text),
            sections,
            detectedSections,
            skills,
            evidenceText: [sections.projects, sections.experience].filter(Boolean).join("\n"),
            educationText: sections.education,
            yearsExperience: [...text.matchAll(/\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/gi)].map((match) => Number(match[1])).filter((value) => value <= 60).sort((a, b) => b - a)[0] ?? null,
        };
    } catch (error) {
        if (error.message?.startsWith("This PDF has too little extractable text")) throw error;
        console.warn("Resume PDF extraction failed", { pdfByteLength: buffer.length, failureType: "unreadable_or_malformed_pdf" });
        throw new Error("The resume PDF could not be read. Upload a text-based PDF and try again.");
    } finally {
        try { await parser?.destroy(); } catch { /* Parser cleanup must not replace the useful extraction error. */ }
    }
};

