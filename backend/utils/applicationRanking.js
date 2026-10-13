export const rankApplications = (applications) => [...applications].sort((left, right) => {
    const leftComplete = left.analysis?.status === "completed" && Number.isFinite(left.analysis.score);
    const rightComplete = right.analysis?.status === "completed" && Number.isFinite(right.analysis.score);
    if (leftComplete !== rightComplete) return leftComplete ? -1 : 1;
    if (leftComplete && left.analysis.score !== right.analysis.score) return right.analysis.score - left.analysis.score;
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
});
