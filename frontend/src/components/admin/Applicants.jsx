import { useCallback, useEffect, useState } from 'react'
import Navbar from '../shared/Navbar'
import ApplicantsTable from './ApplicantsTable'
import axios from 'axios';
import { APPLICATION_API_END_POINT } from '@/utils/constant';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setAllApplicants } from '@/redux/applicationSlice';

const Applicants = () => {
    const params = useParams();
    const dispatch = useDispatch();
    const { applicants } = useSelector(store => store.application);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchAllApplicants = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${APPLICATION_API_END_POINT}/jobs/${params.id}/ranked`, { withCredentials: true, headers: { 'Cache-Control': 'no-cache' } });
            dispatch(setAllApplicants({ applications: res.data.applications || [], job: res.data.job }));
        } catch (requestError) {
            dispatch(setAllApplicants({ applications: [], job: null }));
            setError(requestError?.response?.data?.message || 'Unable to load ranked applicants.');
        } finally {
            setLoading(false);
        }
    }, [dispatch, params.id]);

    useEffect(() => { fetchAllApplicants(); }, [fetchAllApplicants]);
    const applications = applicants?.applications || [];
    const job = applicants?.job;

    return (
        <div className="min-h-screen bg-[#f5f8f6]">
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-7 overflow-hidden rounded-3xl bg-[#123d36] px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8">
                    <div className="flex flex-wrap items-end justify-between gap-5">
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Recruiter workspace · candidate intelligence</p>
                            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Applicant rankings</h1>
                            <p className="mt-2 text-sm text-slate-300">Review fit signals and resume evidence for your applicants.</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-right">
                            <p className="text-2xl font-semibold tabular-nums">{applications.length}</p>
                            <p className="text-xs text-slate-300">total applicants</p>
                        </div>
                    </div>
                    {job && <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 text-sm"><span className="font-medium text-teal-100">{job.title}</span><span className="text-slate-500">at</span><span className="text-slate-300">{job.company}</span></div>}
                </div>
                <ApplicantsTable applications={applications} loading={loading} error={error} onRefresh={fetchAllApplicants} />
            </main>
        </div>
    )
}

export default Applicants
