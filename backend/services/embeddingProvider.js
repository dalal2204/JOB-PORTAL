import { GoogleGenAI } from "@google/genai";

export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
const MAX_EMBEDDING_INPUTS = 32;
const REQUEST_TIMEOUT_MS = 12000;
let clientFactory = (apiKey) => new GoogleGenAI({ apiKey });

// Kept injectable so provider behavior can be tested without network calls or credentials.
export const setEmbeddingClientFactory = (factory) => {
    clientFactory = factory || ((apiKey) => new GoogleGenAI({ apiKey }));
};

export const getEmbeddingModel = () => process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;

const isValidVector = (vector) => Array.isArray(vector) && vector.length > 0 && vector.every((value) => Number.isFinite(value));

const logProviderFailure = ({ model, reason, error, apiKey }) => {
    const rawMessage = String(error?.message || "").slice(0, 500);
    const message = apiKey ? rawMessage.split(apiKey).join("[redacted]") : rawMessage;
    console.error("Gemini embedding request failed", {
        model,
        reason,
        status: Number(error?.status || error?.code || error?.response?.status) || undefined,
        errorName: error?.name || "Error",
        message: message.replace(/([?&](?:key|api_key|x-goog-api-key)=)[^&\s]+/gi, "$1[redacted]"),
    });
};

const failed = (reason, details = {}) => {
    logProviderFailure({ reason, model: getEmbeddingModel(), ...details });
    return { available: false, reason };
};

const failureReason = (error) => {
    const status = Number(error?.status || error?.code || error?.response?.status);
    if (status === 429) return "Semantic matching is temporarily rate limited by Google.";
    if (error?.name === "TimeoutError" || error?.name === "AbortError") return "Semantic matching timed out while contacting Google.";
    if (status === 400 || status === 422) return "Google rejected the semantic matching input or model configuration.";
    return "Semantic matching provider is temporarily unavailable.";
};

export const getEmbeddingVectors = async (texts) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return { available: false, reason: "Semantic matching is unavailable because GEMINI_API_KEY is not configured." };
    if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_EMBEDDING_INPUTS || texts.some((text) => typeof text !== "string" || !text.trim())) {
        return { available: false, reason: "Semantic matching provider received empty or invalid text." };
    }

    try {
        const client = clientFactory(apiKey);
        const response = await client.models.embedContent({
            model: getEmbeddingModel(),
            contents: texts,
            config: { abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
        });
        const embeddings = response?.embeddings;
        if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
            return failed("Semantic matching provider returned an invalid response.", { apiKey });
        }
        const vectors = embeddings.map((embedding) => embedding?.values);
        if (!vectors.every(isValidVector) || vectors.some((vector) => vector.length !== vectors[0].length)) {
            return failed("Semantic matching provider returned empty, malformed, or incompatible vectors.", { apiKey });
        }
        return { available: true, vectors, provider: "Google Gemini", model: getEmbeddingModel() };
    } catch (error) {
        const reason = failureReason(error);
        logProviderFailure({ model: getEmbeddingModel(), reason, error, apiKey });
        return { available: false, reason };
    }
};

export const cosineSimilarity = (left, right) => {
    if (!isValidVector(left) || !isValidVector(right) || left.length !== right.length) return null;
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
        dot += left[index] * right[index];
        leftNorm += left[index] ** 2;
        rightNorm += right[index] ** 2;
    }
    return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : null;
};
