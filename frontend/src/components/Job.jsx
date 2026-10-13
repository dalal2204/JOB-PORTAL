import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useNavigate } from 'react-router-dom'

const Job = ({ job }) => {
    const navigate = useNavigate();

    const daysAgoFunction = (mongodbTime) => {
        if (!mongodbTime) return 'Today';
        const createdAt = new Date(mongodbTime);
        const currentTime = new Date();
        const timeDifference = currentTime - createdAt;
        return Math.floor(timeDifference / (1000 * 24 * 60 * 60));
    };

    return (
        <div className='group rounded-2xl border border-emerald-950/[.08] bg-white p-5 shadow-[0_8px_30px_-20px_rgba(12,60,48,.35)] transition duration-200 hover:-translate-y-1 hover:border-emerald-700/25 hover:shadow-[0_18px_36px_-20px_rgba(12,60,48,.28)]'>
            <div className='flex items-center justify-between'>
                <p className='text-sm text-gray-500'>{daysAgoFunction(job?.createdAt) === 0 ? "Today" : `${daysAgoFunction(job?.createdAt)} days ago`}</p>
            </div>

            <div className='flex items-center gap-2 my-2'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-800'>
                    {job?.company?.slice(0, 2)?.toUpperCase() || 'JP'}
                </div>
                <div>
                    <h1 className='font-medium text-lg'>{job?.company}</h1>
                    <p className='text-sm text-gray-500'>{job?.location}</p>
                </div>
            </div>

            <div>
                <h1 className='my-2 text-lg font-bold tracking-tight text-slate-900'>{job?.title}</h1>
                <p className='line-clamp-3 text-sm leading-6 text-slate-600'>{job?.description}</p>
            </div>
            <div className='flex items-center gap-2 mt-4 flex-wrap'>
                <Badge className={'font-bold text-emerald-800'} variant="ghost">{job?.position} Positions</Badge>
                <Badge className={'font-bold text-teal-700'} variant="ghost">{job?.jobType}</Badge>
                <Badge className={'font-bold text-slate-700'} variant="ghost">{job?.salary} LPA</Badge>
            </div>
            <div className='flex items-center gap-4 mt-4'>
                <Button onClick={() => navigate(`/description/${job?._id}`)} variant="outline">Details</Button>
            </div>
        </div>
    )
}

export default Job
