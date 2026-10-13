// utils is usually a folder used to store reusable utility/helper functions that are needed in different parts of your project
import mongoose from "mongoose"; 

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error(error);
    }
}
export default connectDB;    