export const isAnalysisRetryable = (analysis, now = Date.now()) => {
    let retryable;
    if (!analysis?.status || ['pending', 'failed'].includes(analysis.status)) retryable = true;
    else if (analysis.status === 'completed') retryable = analysis.availability?.semanticRelevance === 'unavailable';
    else retryable = analysis.status === 'processing'
        && now - new Date(analysis.processingAt || 0).getTime() >= 15 * 60 * 1000;

    if (import.meta.env.DEV) {
        console.debug('[analysis retry eligibility]', {
            analysisStatus: analysis?.status ?? null,
            semanticCriterionStatus: analysis?.availability?.semanticRelevance ?? null,
            retryable,
        });
    }

    return retryable;
};
