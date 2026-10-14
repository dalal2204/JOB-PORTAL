import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertCircle, BriefcaseBusiness, CheckCircle2, ExternalLink, FileText, GraduationCap, Loader2, RotateCw, Sparkles } from 'lucide-react';
import { APPLICATION_API_END_POINT } from '@/utils/constant';
import { isAnalysisRetryable } from '@/utils/analysisRetry';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

const scoreTone = (score) => score >= 75 ? 'text-emerald-700 bg-emerald-50' : score >= 50 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50';

const SkillChips = ({ values = [], tone = 'match' }) => values.length ? <div className="flex flex-wrap gap-2">{values.map(skill => <span key={skill} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone === 'match' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{skill}</span>)}</div> : <p className="text-sm text-slate-500">{tone === 'match' ? 'No matching skills were found in the resume text.' : 'No additional skills were identified as not found.'}</p>;

function Breakdown({ breakdown }) {
    if (!breakdown) return <p className="text-sm text-slate-500">No score breakdown is available yet.</p>;
    return <div className="space-y-4">{Object.entries(breakdown).map(([key, criterion]) => <div key={key}>
        <div className="mb-1.5 flex items-center justify-between gap-4 text-sm"><span className="font-medium text-slate-700">{criterion.label}</span><span className="text-right text-xs tabular-nums text-slate-500">{criterion.score === null ? 'Unavailable' : `${criterion.score.toFixed(0)}%`}<span className="ml-2 block text-[10px] text-slate-400">{criterion.score === null ? 'Excluded from this score' : `Effective weight ${criterion.effectiveWeight ?? criterion.weight}% · base ${criterion.weight}%`}</span></span></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${criterion.score === null ? 0 : Math.max(0, Math.min(100, criterion.score))}%` }} /></div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{criterion.reason}</p>
    </div>)}</div>;
}

const Section = ({ title, icon: Icon, children }) => <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"><h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900"><Icon className="h-4 w-4 text-emerald-700" aria-hidden="true" />{title}</h3>{children}</section>;

export default function MatchAnalysisDialog({ applicationId, open, onOpenChange, onRetry, retrying }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [retryError, setRetryError] = useState('');

    useEffect(() => {
        if (!open || !applicationId) return;
        let active = true;
        setLoading(true);
        setError('');
        axios.get(`${APPLICATION_API_END_POINT}/analysis/${applicationId}`, { withCredentials: true, headers: { 'Cache-Control': 'no-cache' } })
            .then(response => { if (active) setData(response.data.application); })
            .catch(requestError => { if (active) setError(requestError?.response?.data?.message || 'Unable to load analysis details.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [applicationId, open]);

    const application = data;
    const analysis = application?.analysis;
    const candidate = application?.applicant;
    const job = application?.job;
    const score = analysis?.score;
    const canRetry = isAnalysisRetryable(analysis);

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-0 bg-slate-50 p-0 shadow-2xl" aria-describedby="analysis-dialog-description">
            <div className="bg-[#123d36] px-5 py-6 text-white sm:px-8">
                <DialogHeader>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200"><Sparkles className="h-4 w-4" />Resume match analysis</div>
                    <DialogTitle className="text-xl font-semibold text-white sm:text-2xl">{candidate?.fullname || 'Candidate analysis'}</DialogTitle>
                    <DialogDescription id="analysis-dialog-description" className="text-slate-300">{job?.title || 'Job'}{job?.company ? ` · ${job.company}` : ''} · Applied {application?.createdAt ? new Date(application.createdAt).toLocaleDateString() : 'date unavailable'}</DialogDescription>
                </DialogHeader>
                {candidate?.email && <p className="mt-2 text-sm text-slate-400">{candidate.email}</p>}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <div className={`flex h-16 min-w-16 flex-col items-center justify-center rounded-2xl px-3 ${score === null || score === undefined ? 'bg-white/10 text-slate-300' : scoreTone(score)}`}>
                        {score === null || score === undefined ? <span className="text-xs font-semibold">—</span> : <span className="text-2xl font-bold tabular-nums">{score.toFixed(0)}<span className="text-xs">%</span></span>}
                        <span className="text-[9px] font-semibold uppercase tracking-wider">match</span>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${analysis?.status === 'completed' ? 'bg-emerald-400/15 text-emerald-200' : analysis?.status === 'failed' ? 'bg-rose-400/15 text-rose-200' : 'bg-emerald-400/15 text-emerald-100'}`}>{analysis?.status || 'pending'}</span>
                    {candidate?.profile?.resume && <a className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10" href={candidate.profile.resume} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" />{candidate.profile.resumeOriginalName || 'Open resume'}<ExternalLink className="h-3 w-3" /></a>}
                </div>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
                {loading && <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading saved analysis…</div>}
                {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
                {!loading && !error && analysis?.status === 'failed' && <div role="status" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Analysis could not be completed</p><p className="mt-1">{analysis.error || 'No detailed error was stored.'} Resume text is not available for a reliable score.</p></div></div>}
                {!loading && !error && analysis?.status === 'processing' && <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><Loader2 className="h-4 w-4 animate-spin" />Resume analysis is in progress.</div>}
                {!loading && !error && analysis?.status === 'completed' && <>
                    {analysis.availability?.semanticRelevance === 'unavailable' && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><span className="font-semibold">Semantic analysis unavailable.</span> The result uses other assessable criteria and their weights were renormalized. Review each criterion below.</div>}
                    <Section title="Score breakdown" icon={CheckCircle2}><Breakdown breakdown={analysis.breakdown} /></Section>
                    <div className="grid gap-4 sm:grid-cols-2"><Section title="Skills found in resume" icon={CheckCircle2}><SkillChips values={analysis.matchedSkills} /></Section><Section title="Not found in resume" icon={AlertCircle}><SkillChips values={analysis.missingSkills} tone="missing" /><p className="mt-3 text-xs leading-5 text-slate-500">Not found in resume text does not mean the candidate lacks that skill.</p></Section></div>
                    <Section title="Project and experience evidence" icon={BriefcaseBusiness}>{analysis.evidence?.length ? <div className="space-y-3">{analysis.evidence.map((item, index) => <blockquote key={`${item.section}-${index}`} className="rounded-xl border-l-2 border-emerald-400 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.section || 'resume'}</span>“{item.text}”</blockquote>)}</div> : <p className="text-sm text-slate-500">No relevant project or experience excerpts were extracted.</p>}</Section>
                    <div className="grid gap-4 sm:grid-cols-2"><Section title="Strengths" icon={CheckCircle2}>{analysis.strengths?.length ? <ul className="space-y-2 text-sm leading-6 text-slate-700">{analysis.strengths.map((item, index) => <li key={index} className="flex gap-2"><span className="text-emerald-600">•</span>{item}</li>)}</ul> : <p className="text-sm text-slate-500">No specific strengths were identified.</p>}</Section><Section title="Potential gaps" icon={GraduationCap}>{analysis.gaps?.length ? <ul className="space-y-2 text-sm leading-6 text-slate-700">{analysis.gaps.map((item, index) => <li key={index} className="flex gap-2"><span className="text-emerald-700">•</span>{item}</li>)}</ul> : <p className="text-sm text-slate-500">No specific gaps were identified.</p>}</Section></div>
                    {analysis.limitations?.length > 0 && <p className="px-1 text-xs leading-5 text-slate-500">{analysis.limitations.join(' ')}</p>}
                </>}
                {!loading && !error && canRetry && onRetry && <Button type="button" onClick={async () => {
                    setRetryError('');
                    try {
                        const response = await onRetry(application?._id);
                        if (response?.analysis && application) setData({ ...application, analysis: response.analysis });
                    } catch (requestError) {
                        setRetryError(requestError?.response?.data?.message || 'Unable to retry analysis.');
                    }
                }} disabled={retrying} className="w-full sm:w-auto"><RotateCw className={`mr-2 h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />{retrying ? 'Retrying analysis…' : 'Retry analysis'}</Button>}
                {retryError && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{retryError}</div>}
            </div>
        </DialogContent>
    </Dialog>;
}

