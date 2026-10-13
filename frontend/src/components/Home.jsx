import Navbar from './shared/Navbar'
import HeroSection from './HeroSection'
import CategoryCarousel from './CategoryCarousel'
import LatestJobs from './LatestJobs'
import Footer from './shared/Footer'
import useGetAllJobs from '@/hooks/useGetAllJobs'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

const Home = () => {
  useGetAllJobs();
  const { user } = useSelector(store => store.auth);
  const navigate = useNavigate();
  useEffect(() => { if (user?.role === 'recruiter') navigate("/admin/jobs"); }, [navigate, user?.role]);
  return <div className="min-h-screen bg-[#f8faf9]"><Navbar /><main><HeroSection /><section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-700">Explore by focus</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Find your kind of work</h2></div><CategoryCarousel /></section><LatestJobs /></main><Footer /></div>
}
export default Home
