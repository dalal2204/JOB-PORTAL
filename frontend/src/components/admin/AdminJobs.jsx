import { useEffect, useState } from 'react'
import Navbar from '../shared/Navbar'
import { Input } from '../ui/input'
import { Button } from '../ui/button' 
import { useNavigate } from 'react-router-dom' 
import { useDispatch } from 'react-redux' 
import AdminJobsTable from './AdminJobsTable'
import useGetAllAdminJobs from '@/hooks/useGetAllAdminJobs'
import { setSearchJobByText } from '@/redux/jobSlice'

const AdminJobs = () => {
  useGetAllAdminJobs();
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setSearchJobByText(input));
  }, [input]);
  return (
    <div>
      <Navbar />
      <main className='mx-auto my-9 max-w-6xl px-4 sm:px-6'>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'><div><p className='text-xs font-bold uppercase tracking-[.15em] text-emerald-700'>Recruiter workspace</p><h1 className='mt-2 text-3xl font-bold tracking-tight text-slate-900'>Your job postings</h1><p className='mt-1 text-sm text-slate-500'>Manage openings and review applicants.</p></div>
          <Input
            className="w-full sm:max-w-xs"
            placeholder="Search roles or companies"
            onChange={(e) => setInput(e.target.value)}
          />
          <Button onClick={() => navigate("/admin/jobs/create")} className="bg-emerald-800 text-white hover:bg-emerald-900">Post a job</Button>
        </div>
        <AdminJobsTable />
      </main>
    </div>
  )
}

export default AdminJobs
