import { useEffect } from 'react'
import Navbar from './shared/Navbar'
import Job from './Job';
import { useDispatch, useSelector } from 'react-redux';
import { setSearchedQuery } from '@/redux/jobSlice';
import useGetAllJobs from '@/hooks/useGetAllJobs';

// const randomJobs = [1, 2,45];

const Browse = () => {
    useGetAllJobs();
    const {allJobs} = useSelector(store=>store.job);
    const dispatch = useDispatch();
    useEffect(()=>{
        return ()=>{
            dispatch(setSearchedQuery(""));
        }
    },[])
    return (
        <div>
            <Navbar />
            <main className='mx-auto my-9 max-w-7xl px-4 sm:px-6'>
                <div className='mb-7'><p className='text-xs font-bold uppercase tracking-[.15em] text-emerald-700'>Explore opportunities</p><h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-900'>Search results <span className='text-lg font-medium text-slate-500'>({allJobs.length})</span></h1></div>
                <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                    {
                        allJobs.map((job) => {
                            return (
                                <Job key={job._id} job={job}/>
                            )
                        })
                    }
                </div>

            </main>
        </div>
    )
}

export default Browse
