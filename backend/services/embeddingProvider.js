let cachedApiKey;

const getApiKey = () => process.env.OPENAI_API_KEY?.trim();

export const getEmbeddingVectors = async (texts) => {
    const apiKey = getApiKey();
    if (!apiKey) return { available: false, reason: "Semantic matching is unavailable because OPENAI_API_KEY is not configured." };
    try {
        if (cachedApiKey !== apiKey) cachedApiKey = apiKey;
        const response = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: { Authorization: `Bearer ${cachedApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small", input: texts.slice(0, 32) }),
            signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) return { available: false, reason: response.status === 429 ? "Semantic matching is temporarily rate limited." : "Semantic matching provider is temporarily unavailable." };
        const payload = await response.json();
        if (!Array.isArray(payload.data) || payload.data.length !== texts.slice(0, 32).length || payload.data.some((item) => !Array.isArray(item.embedding) || !item.embedding.length)) {
            return { available: false, reason: "Semantic matching provider returned an invalid response." };
        }
        return { available: true, vectors: payload.data.sort((a, b) => a.index - b.index).map((item) => item.embedding) };
    } catch {
        return { available: false, reason: "Semantic matching timed out or could not reach its provider." };
    }
};

export const cosineSimilarity = (left, right) => {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) return null;
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
