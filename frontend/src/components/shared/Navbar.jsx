import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { Avatar, AvatarImage } from '../ui/avatar'
import { LogOut, User2, BriefcaseBusiness } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'
import { USER_API_END_POINT } from '@/utils/constant'
import { setUser } from '@/redux/authSlice'
import { toast } from 'sonner'

const Navbar = () => {
    const { user } = useSelector(store => store.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const logoutHandler = async () => {
        try {
            const res = await axios.get(`${USER_API_END_POINT}/logout`, { withCredentials: true });
            if (res.data.success) {
                dispatch(setUser(null));
                navigate("/");
                toast.success(res.data.message);
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Logout failed.");
        }
    }

    return (
        <nav className="sticky top-0 z-30 border-b border-emerald-950/10 bg-white/90 backdrop-blur-xl">
            <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-6">
                <Link to="/" className="flex items-center gap-2.5" aria-label="CareerSpring home">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-800 text-white shadow-sm"><BriefcaseBusiness className="h-[18px] w-[18px]" /></span>
                    <span className="text-xl font-extrabold tracking-tight text-slate-900">career<span className="text-emerald-700">spring</span></span>
                </Link>
                <div className="flex items-center gap-3 sm:gap-7">
                    <ul className="flex items-center gap-3 text-sm font-semibold text-slate-600 sm:gap-7">
                        {user?.role === 'recruiter' ? <>
                            <li><Link className="transition hover:text-emerald-800" to="/admin/jobs">My jobs</Link></li>
                            <li><Link className="transition hover:text-emerald-800" to="/admin/jobs/create">Post a job</Link></li>
                        </> : <>
                            <li><Link className="transition hover:text-emerald-800" to="/">Home</Link></li>
                            <li><Link className="transition hover:text-emerald-800" to="/jobs">Jobs</Link></li>
                            <li><Link className="transition hover:text-emerald-800" to="/browse">Browse</Link></li>
                        </>}
                    </ul>
                    {!user ? <div className="flex items-center gap-2">
                        <Link to="/login"><Button variant="ghost" className="px-3">Log in</Button></Link>
                        <Link to="/signup"><Button className="bg-emerald-800 px-4 text-white hover:bg-emerald-900">Get started</Button></Link>
                    </div> : <Popover>
                        <PopoverTrigger asChild><button className="rounded-full ring-2 ring-emerald-100 transition hover:ring-emerald-300" aria-label="Open account menu"><Avatar className="h-10 w-10"><AvatarImage src={user?.profile?.profilePhoto} alt={user?.fullname || 'Profile'} /></Avatar></button></PopoverTrigger>
                        <PopoverContent align="end" className="w-72 rounded-2xl border-emerald-100 p-4 shadow-xl">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><Avatar className="h-11 w-11"><AvatarImage src={user?.profile?.profilePhoto} alt={user?.fullname || 'Profile'} /></Avatar><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{user?.fullname}</p><p className="truncate text-xs text-slate-500">{user?.profile?.bio || user?.email}</p></div></div>
                            <div className="flex flex-col gap-1 pt-2">
                                {user?.role === 'student' && <Link to="/profile" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-emerald-50"><User2 className="h-4 w-4" />View profile</Link>}
                                <button onClick={logoutHandler} className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-700"><LogOut className="h-4 w-4" />Log out</button>
                            </div>
                        </PopoverContent>
                    </Popover>}
                </div>
            </div>
        </nav>
    )
}

export default Navbar
