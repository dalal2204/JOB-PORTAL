import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel';
import { Button } from './ui/button';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setSearchedQuery } from '@/redux/jobSlice';

const category = [
    "Frontend Developer",
    "Backend Developer",
    "Data Science",
    "Graphic Designer",
    "FullStack Developer"
]

const CategoryCarousel = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const searchJobHandler = (query) => {
        dispatch(setSearchedQuery(query));
        navigate("/browse");
    }

    return (
        <div className="pb-2">
            <Carousel className="mx-auto my-7 w-full max-w-3xl">
                <CarouselContent>
                    {
                        category.map((cat) => (
                            <CarouselItem key={cat} className="md:basis-1/2 lg:basis-1/3">
                                <Button onClick={()=>searchJobHandler(cat)} variant="outline" className="h-auto w-full rounded-xl border-emerald-900/10 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm hover:border-emerald-600/40 hover:bg-emerald-50 hover:text-emerald-900">{cat}</Button>
                            </CarouselItem>
                        ))
                    }
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
            </Carousel>
        </div>
    )
}

export default CategoryCarousel
