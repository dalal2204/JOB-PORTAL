import LatestJobCards from './LatestJobCards';
import { useSelector } from 'react-redux'; 

// const randomJobs = [1, 2, 3, 4, 5, 6, 7, 8];

const LatestJobs = () => {
    const {allJobs} = useSelector(store=>store.job);
   
    return (
        <section className='mx-auto my-16 max-w-7xl px-4 sm:px-6 lg:my-20'>
            <div className='mb-7 flex flex-wrap items-end justify-between gap-3'><div><p className='text-xs font-bold uppercase tracking-[.15em] text-emerald-700'>Fresh opportunities</p><h2 className='mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl'>Latest <span className='text-emerald-700'>open roles</span></h2></div><p className='max-w-xs text-sm text-slate-500'>A few places to make your next move.</p></div>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {
                    allJobs.length <= 0 ? <span>No Job Available</span> : allJobs?.slice(0,6).map((job) => <LatestJobCards key={job._id} job={job}/>)
                }
            </div>
        </section>
    )
}

export default LatestJobs
