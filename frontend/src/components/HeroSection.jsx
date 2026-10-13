import { useState } from 'react'
import { Button } from './ui/button'
import { Search, ArrowUpRight, Sparkles } from 'lucide-react'
import { useDispatch } from 'react-redux';
import { setSearchedQuery } from '@/redux/jobSlice';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
    const [query, setQuery] = useState("");
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const searchJobHandler = () => { dispatch(setSearchedQuery(query)); navigate("/browse"); }

    return <section className="relative isolate overflow-hidden bg-[#eff7f3]">
        <div className="pointer-events-none absolute -right-20 -top-40 h-[28rem] w-[28rem] rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-[-5rem] h-[24rem] w-[24rem] rounded-full bg-teal-100/80 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pb-24 sm:pt-20">
            <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[.12em] text-emerald-800 shadow-sm"><Sparkles className="h-3.5 w-3.5" />Find work that moves you forward</span>
            <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-[-.045em] text-slate-900 sm:text-6xl">Your next chapter<br className="hidden sm:block" /> starts with <span className="text-emerald-700">the right role.</span></h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Explore opportunities that fit your skills, ambition, and the way you want to work.</p>
            <form onSubmit={event => { event.preventDefault(); searchJobHandler(); }} className="mx-auto mt-8 flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-emerald-900/10 bg-white p-2 shadow-[0_18px_55px_-25px_rgba(15,70,55,.35)]">
                <Search className="ml-3 h-5 w-5 shrink-0 text-emerald-700" />
                <input aria-label="Search jobs" type="search" placeholder="Job title, company, or location" value={query} onChange={event => setQuery(event.target.value)} className="h-12 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0" />
                <Button type="submit" className="h-12 rounded-xl bg-emerald-800 px-5 text-white hover:bg-emerald-900">Search <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
            </form>
            <p className="mt-4 text-xs text-slate-500">A thoughtful place to find your next opportunity.</p>
        </div>
    </section>
}
export default HeroSection
