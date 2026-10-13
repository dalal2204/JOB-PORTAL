export const selectTopCandidates = (applications, limit = 'all') => limit === 'all'
    ? applications
    : applications.slice(0, Math.max(0, Number(limit) || 0));
