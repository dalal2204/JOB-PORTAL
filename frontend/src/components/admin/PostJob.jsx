import { useEffect, useState } from 'react'
import Navbar from '../shared/Navbar'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import axios from 'axios'
import { JOB_API_END_POINT } from '@/utils/constant'
import { toast } from 'sonner'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

const initialState = {
    title: "",
    description: "",
    requirements: "",
    salary: "",
    location: "",
    jobType: "",
    experience: "",
    position: 1,
    company: "",
};

const PostJob = ({ mode = 'create' }) => {
    const [input, setInput] = useState(initialState);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { id } = useParams();

    useEffect(() => {
        const fetchJobForEdit = async () => {
            if (mode !== 'edit' || !id) return;
            try {
                const res = await axios.get(`${JOB_API_END_POINT}/get/${id}`, { withCredentials: true });
                if (res.data.success) {
                    const job = res.data.job;
                    setInput({
                        title: job.title || '',
                        description: job.description || '',
                        requirements: (job.requirements || []).join(', '),
                        salary: job.salary || '',
                        location: job.location || '',
                        jobType: job.jobType || '',
                        experience: job.experienceLevel || '',
                        position: job.position || 1,
                        company: job.company || '',
                    });
                }
            } catch (error) {
                toast.error(error?.response?.data?.message || 'Unable to load job details.');
            }
        };

        fetchJobForEdit();
    }, [id, mode]);

    const changeEventHandler = (e) => {
        setInput({ ...input, [e.target.name]: e.target.value });
    };

    const submitHandler = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                ...input,
                salary: Number(input.salary),
                position: Number(input.position),
                requirements: input.requirements,
            };

            if (mode === 'edit' && id) {
                const res = await axios.put(`${JOB_API_END_POINT}/${id}`, payload, { withCredentials: true });
                if (res.data.success) {
                    toast.success(res.data.message);
                    navigate('/admin/jobs');
                }
                return;
            }

            const res = await axios.post(`${JOB_API_END_POINT}/post`, payload, { withCredentials: true });
            if (res.data.success) {
                toast.success(res.data.message);
                navigate('/admin/jobs');
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Navbar />
            <main className='mx-auto max-w-4xl px-4 py-8 sm:px-6'>
                <form onSubmit={submitHandler} className='w-full rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-8'>
                    <div className='mb-7'><p className='text-xs font-bold uppercase tracking-[.15em] text-emerald-700'>Recruiter workspace</p><h1 className='mt-2 text-2xl font-bold tracking-tight text-slate-900'>{mode === 'edit' ? 'Edit job posting' : 'Create a job posting'}</h1><p className='mt-1 text-sm text-slate-500'>Share the details candidates need to find the right fit.</p></div>
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                        <div>
                            <Label>Title</Label>
                            <Input
                                type="text"
                                name="title"
                                value={input.title}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                        <div>
                            <Label>Company Name</Label>
                            <Input
                                type="text"
                                name="company"
                                value={input.company}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                        <div className='sm:col-span-2'>
                            <Label>Description</Label>
                            <Input
                                type="text"
                                name="description"
                                value={input.description}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                        <div className='sm:col-span-2'>
                            <Label>Requirements</Label>
                            <Input
                                type="text"
                                name="requirements"
                                value={input.requirements}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                        <div>
                            <Label>Salary (LPA)</Label>
                            <Input
                                type="number"
                                name="salary"
                                value={input.salary}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                        <div>
                            <Label>Location</Label>
                            <Input
                                type="text"
                                name="location"
                                value={input.location}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                        <div>
                            <Label>Job Type</Label>
                            <Input
                                type="text"
                                name="jobType"
                                value={input.jobType}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                        <div>
                            <Label>Experience Level (years)</Label>
                            <Input
                                type="number"
                                name="experience"
                                value={input.experience}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                        <div>
                            <Label>No of Positions</Label>
                            <Input
                                type="number"
                                name="position"
                                value={input.position}
                                onChange={changeEventHandler}
                                className="focus-visible:ring-offset-0 focus-visible:ring-0 my-1"
                            />
                        </div>
                    </div>
                    {
                        loading ? <Button className="w-full my-4"> <Loader2 className='mr-2 h-4 w-4 animate-spin' /> Please wait </Button> : <Button type="submit" className="w-full my-4">{mode === 'edit' ? 'Update Job' : 'Post New Job'}</Button>
                    }
                </form>
            </main>
        </div>
    )
}

export default PostJob
