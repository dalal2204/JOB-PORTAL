import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertCircle, ArrowUpRight, Check, ChevronDown, FileText, Loader2, RotateCw, Search, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import { APPLICATION_API_END_POINT } from '@/utils/constant';
import { selectTopCandidates } from '@/utils/ranking';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import MatchAnalysisDialog from './MatchAnalysisDialog';

const LIMITS = [10, 25, 50, 100];
const statuses = ['pending', 'accepted', 'rejected'];

const statusStyle = {
    pending: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    accepted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rejected: 'border-rose-200 bg-rose-50 text-rose-800',
};
const scoreColor = (score) => score >= 75 ? '#059669' : score >= 50 ? '#d97706' : '#e11d48';

const Chip = ({ children, missing = false }) => <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${missing ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{children}</span>;

function ScoreRing({ score }) {
    const color = scoreColor(score);
    return <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-full border-[3px] bg-white" style={{ borderColor: color, color }} aria-label={`Match score ${score.toFixed(0)} percent`}>
        <span className="text-xl font-bold leading-none tabular-nums">{score.toFixed(0)}</span><span className="mt-1 text-[9px] font-semibold uppercase tracking-widest">match</span>
    </div>;
}

function AnalysisState({ analysis, onRetry, retrying, id }) {
    if (analysis?.status === 'completed') return <div className="flex flex-wrap gap-2">{analysis.availability?.semanticRelevance === 'unavailable' && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800"><AlertCircle className="h-3 w-3" />Partial analysis</span>}</div>;
    const staleProcessing = analysis?.status === 'processing' && Date.now() - new Date(analysis.processingAt || 0).getTime() >= 15 * 60 * 1000;
    if (analysis?.status === 'processing' && !staleProcessing) return <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800"><Loader2 className="h-3 w-3 animate-spin" />Analysis processing</span>;
    const retryable = ['pending', 'failed'].includes(analysis?.status) || staleProcessing;
    return <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${analysis?.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-100 text-slate-700'}`}><AlertCircle className="h-3 w-3" />{analysis?.status === 'failed' ? 'Analysis failed' : staleProcessing ? 'Analysis stalled' : 'Analysis pending'}</span>
        {analysis?.error && <span className="max-w-xs truncate text-xs text-rose-700" title={analysis.error}>{analysis.error}</span>}
        {retryable && <button type="button" onClick={() => onRetry(id)} disabled={retrying} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-emerald-800 disabled:opacity-50"><RotateCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />{retrying ? 'Retrying' : 'Retry'}</button>}
    </div>;
}

function ApplicantCard({ application, rank, onOpen, onRetry, retrying, onStatus }) {
    const candidate = application.applicant || {};
    const analysis = application.analysis || { status: 'pending' };
    const score = analysis.score;
    const isScored = analysis.status === 'completed' && Number.isFinite(score);
    return <article className={`rounded-2xl border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/5 sm:p-5 ${rank && rank <= 3 ? 'border-emerald-200/90' : 'border-slate-200'}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${rank && rank <= 3 ? 'bg-teal-100 text-emerald-900' : 'bg-slate-100 text-slate-600'}`} aria-label={rank ? `Rank ${rank}` : 'Not ranked'}>{rank ? `#${rank}` : '—'}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <button type="button" onClick={() => onOpen(application._id)} className="truncate text-left text-base font-semibold text-slate-950 decoration-emerald-500 underline-offset-4 hover:underline">{candidate.fullname || 'Unknown applicant'}</button>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize ${statusStyle[application.status] || statusStyle.pending}`}>{application.status || 'pending'}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500"><span className="truncate">{candidate.email || 'Email unavailable'}</span>{candidate.phoneNumber && <span>{candidate.phoneNumber}</span>}<span>Applied {application.createdAt ? new Date(application.createdAt).toLocaleDateString() : 'date unavailable'}</span></div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <AnalysisState analysis={analysis} id={application._id} onRetry={onRetry} retrying={retrying} />
                    </div>
                    {(analysis.matchedSkills?.length > 0 || analysis.missingSkills?.length > 0) && <div className="mt-3 flex flex-wrap gap-1.5">{analysis.matchedSkills.slice(0, 4).map(skill => <Chip key={`m-${skill}`}>{skill}</Chip>)}{analysis.missingSkills.slice(0, 3).map(skill => <Chip key={`x-${skill}`} missing>{skill} · not found</Chip>)}{analysis.matchedSkills.length + analysis.missingSkills.length > 7 && <span className="self-center text-xs text-slate-400">+{analysis.matchedSkills.length + analysis.missingSkills.length - 7}</span>}</div>}
                </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                {isScored ? <ScoreRing score={score} /> : <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-slate-400"><span className="text-lg font-semibold">—</span><span className="text-[8px] font-semibold uppercase tracking-wide">no score</span></div>}
                <button type="button" onClick={() => onOpen(application._id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950">View analysis<ArrowUpRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex items-center justify-end gap-2 sm:self-start sm:pl-2">
                {candidate.profile?.resume && <a href={candidate.profile.resume} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"><FileText className="h-3.5 w-3.5" /><span className="max-w-[100px] truncate">{candidate.profile.resumeOriginalName || 'Resume'}</span></a>}
                <Popover>
                    <PopoverTrigger render={<Button variant="outline" size="sm" aria-label={`Update status for ${candidate.fullname || 'applicant'}`} />}><span className="hidden sm:inline">Status</span><ChevronDown className="h-3.5 w-3.5" /></PopoverTrigger>
                    <PopoverContent className="w-40 p-1.5">{statuses.map(status => <button key={status} type="button" onClick={() => onStatus(status, application._id)} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs capitalize text-slate-700 hover:bg-slate-100"><span>{status}</span>{application.status === status && <Check className="h-3.5 w-3.5 text-emerald-600" />}</button>)}</PopoverContent>
                </Popover>
            </div>
        </div>
    </article>;
}

const ApplicantsTable = ({ applications = [], loading, error, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [minScore, setMinScore] = useState(0);
    const [topN, setTopN] = useState('25');
    const [analysisId, setAnalysisId] = useState(null);
    const [retryingId, setRetryingId] = useState(null);

    const ranked = useMemo(() => applications.filter(item => item.analysis?.status === 'completed' && Number.isFinite(item.analysis.score)), [applications]);
    const queue = useMemo(() => applications.filter(item => item.analysis?.status !== 'completed' || !Number.isFinite(item.analysis?.score)), [applications]);
    const matchesFilter = useCallback((item) => {
        const query = search.trim().toLowerCase();
        return (status === 'all' || item.status === status)
            && (!query || `${item.applicant?.fullname || ''} ${item.applicant?.email || ''} ${item.applicant?.phoneNumber || ''}`.toLowerCase().includes(query));
    }, [search, status]);
    const visibleRanked = useMemo(() => {
        const filtered = ranked.filter(item => matchesFilter(item) && item.analysis.score >= minScore);
        return selectTopCandidates(filtered, topN);
    }, [ranked, matchesFilter, minScore, topN]);
    const visibleQueue = useMemo(() => queue.filter(matchesFilter), [queue, matchesFilter]);
    const rankMap = useMemo(() => new Map(ranked.map((item, index) => [item._id, index + 1])), [ranked]);

    const statusHandler = async (nextStatus, applicationId) => {
        try {
            const response = await axios.post(`${APPLICATION_API_END_POINT}/status/${applicationId}/update`, { status: nextStatus }, { withCredentials: true });
            if (response.data.success) {
                toast.success(`Application marked ${nextStatus}.`);
                onRefresh();
            }
        } catch (requestError) {
            toast.error(requestError?.response?.data?.message || 'Unable to update application status.');
        }
    };

    const retryAnalysis = async (applicationId) => {
        setRetryingId(applicationId);
        try {
            const response = await axios.post(`${APPLICATION_API_END_POINT}/analysis/${applicationId}/retry`, {}, { withCredentials: true });
            toast.success(response.data.message || 'Analysis retry finished.');
            await onRefresh();
            return response.data;
        } catch (requestError) {
            toast.error(requestError?.response?.data?.message || 'Unable to retry analysis.');
            throw requestError;
        } finally {
            setRetryingId(null);
        }
    };

    return <div>
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Sparkles className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold text-slate-950">Find the strongest fit</h2><p className="text-xs text-slate-500">Ranked matches and processing applications stay separate.</p></div></div><button type="button" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"><RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_160px_minmax(190px,240px)_155px]">
                <label className="relative block"><span className="sr-only">Search applicants</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email or phone" className="h-10 border-slate-200 pl-9 text-sm focus-visible:ring-emerald-500/40" /></label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-500"><span>Status</span><select aria-label="Filter by application status" value={status} onChange={event => setStatus(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none"><option value="all">All</option>{statuses.map(item => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
                <label className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 px-3"><span className="shrink-0 text-xs font-medium text-slate-500">Min score</span><input type="range" aria-label="Minimum match score" min="0" max="100" step="5" value={minScore} onChange={event => setMinScore(Number(event.target.value))} className="min-w-0 flex-1 accent-emerald-700" /><span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-800">{minScore}%</span></label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-500"><span>Show</span><select aria-label="Number of ranked candidates to display" value={topN} onChange={event => setTopN(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none">{LIMITS.map(limit => <option key={limit} value={limit}>Top {limit}</option>)}<option value="all">All ranked</option></select></label>
            </div>
            <p className="mt-3 text-xs text-slate-500">Showing <span className="font-semibold text-slate-700">{visibleRanked.length}</span> of {ranked.length} scored applicants{visibleQueue.length ? ` · ${visibleQueue.length} still processing or needing attention` : ''}.</p>
        </div>

        {loading && !applications.length && <div aria-label="Loading applicants" className="space-y-3">{[0, 1, 2].map(item => <div key={item} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>}
        {!loading && error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"><div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" />Rankings could not be loaded</div><p className="mt-2">{error}</p><Button variant="outline" className="mt-4 border-rose-200 bg-white" onClick={onRefresh}>Try again</Button></div>}
        {!loading && !error && applications.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Users className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-4 text-base font-semibold text-slate-900">No applicants yet</h2><p className="mt-1 text-sm text-slate-500">Candidates will appear here after applying to this role.</p></div>}
        {!loading && !error && applications.length > 0 && visibleRanked.length + visibleQueue.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center"><Search className="mx-auto h-8 w-8 text-slate-300" /><h2 className="mt-3 text-sm font-semibold text-slate-900">No applicants match these filters</h2><p className="mt-1 text-sm text-slate-500">Adjust the search, status, or minimum score to see more applicants.</p><button type="button" onClick={() => { setSearch(''); setStatus('all'); setMinScore(0); }} className="mt-4 text-xs font-semibold text-emerald-800 underline underline-offset-4">Clear filters</button></div>}

        {!error && visibleRanked.length > 0 && <section aria-labelledby="ranked-heading" className="mb-7"><div className="mb-3 flex items-end justify-between"><div><h2 id="ranked-heading" className="text-sm font-semibold text-slate-900">Ranked candidates</h2><p className="mt-0.5 text-xs text-slate-500">Sorted by saved match score, highest first</p></div><span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{visibleRanked.length} shown</span></div><div className="space-y-3">{visibleRanked.map(application => <ApplicantCard key={application._id} application={application} rank={rankMap.get(application._id)} onOpen={setAnalysisId} onRetry={retryAnalysis} retrying={retryingId === application._id} onStatus={statusHandler} />)}</div></section>}

        {!error && visibleQueue.length > 0 && <section aria-labelledby="queue-heading"><div className="mb-3 flex items-end justify-between"><div><h2 id="queue-heading" className="text-sm font-semibold text-slate-900">Needs attention</h2><p className="mt-0.5 text-xs text-slate-500">These applications stay visible without receiving an artificial zero score.</p></div><span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{visibleQueue.length}</span></div><div className="space-y-3">{visibleQueue.map(application => <ApplicantCard key={application._id} application={application} onOpen={setAnalysisId} onRetry={retryAnalysis} retrying={retryingId === application._id} onStatus={statusHandler} />)}</div></section>}

        {analysisId && <MatchAnalysisDialog key={analysisId} applicationId={analysisId} open={Boolean(analysisId)} onOpenChange={open => { if (!open) setAnalysisId(null); }} onRetry={retryAnalysis} retrying={retryingId === analysisId} />}
    </div>;
};

export default ApplicantsTable;
