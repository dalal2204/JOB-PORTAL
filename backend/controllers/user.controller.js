// controller - logic for handling the request
//Controller = contains the logic that processes a request and sends the response

// instead of putting everything inside routes,
// we separate the logic
// routes/       → defines WHERE the request goes
// controllers/  → defines WHAT should happen
// models/       → defines HOW the data is structured


import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";

export const register = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, password, role } = req.body;
        const trimmedPhoneNumber = typeof phoneNumber === "string" ? phoneNumber.trim() : "";
         
        if (!fullname || !email || !trimmedPhoneNumber || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        };
        const file = req.file;
        if (file && (!file.mimetype.startsWith("image/") || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))) {
            return res.status(400).json({ message: "Upload a JPEG, PNG, or WebP profile image.", success: false });
        }

        const user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                message: 'User already exist with this email.',
                success: false,
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const cloudResponse = file ? await cloudinary.uploader.upload(getDataUri(file).content, { resource_type: "image" }) : null;
        await User.create({
            fullname,
            email,
            phoneNumber: trimmedPhoneNumber,
            password: hashedPassword,
            role,
            profile:{
                profilePhoto:cloudResponse?.secure_url || "",
            }
        });

        return res.status(201).json({
            message: "Account created successfully.",
            success: true
        });
    } catch (error) {
        console.error("Registration failed:", error);
        return res.status(500).json({ message: "Unable to create account. Please try again.", success: false });
    }
}
export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        };
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        };
        // check role is correct or not
        if (role !== user.role) {
            return res.status(400).json({
                message: "Account doesn't exist with current role.",
                success: false
            })
        };

        const tokenData = {
            userId: user._id,
            userRole: user.role
        }
        const token = jwt.sign(tokenData, process.env.SECRET_KEY, { expiresIn: '1d' });

        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        }

        return res.status(200).cookie("token", token, { maxAge: 1 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'strict' }).json({
            message: `Welcome back ${user.fullname}`,
            user,
            success: true
        })
    } catch (error) {
        console.error("Login failed:", error);
        return res.status(500).json({
            message: "Unable to log in. Please try again.",
            success: false
        });
    }
}
export const logout = async (req, res) => {
    try {
        return res.status(200).cookie("token", "", { maxAge: 0 }).json({
            message: "Logged out successfully.",
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
export const updateProfile = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, bio, skills } = req.body;
        
        const file = req.file;
        
        let skillsArray;
        if(skills){
            skillsArray = skills.split(",");
        }
        const userId = req.id; // middleware authentication
        let user = await User.findById(userId);

        if (!user) {
            return res.status(400).json({
                message: "User not found.",
                success: false
            })
        }
        let cloudResponse = null;
        if (file) {
            const isPdf = file.mimetype === "application/pdf"
                && file.originalname?.toLowerCase().endsWith(".pdf")
                && file.buffer?.subarray(0, 5).toString() === "%PDF-";
            if (!isPdf) return res.status(400).json({ message: "Upload a readable PDF resume.", success: false });
            cloudResponse = await cloudinary.uploader.upload(getDataUri(file).content, {
                resource_type: "raw",
                folder: "job-portal/resumes",
                use_filename: true,
                unique_filename: true,
            });
        }
        // updating data
        if(fullname) user.fullname = fullname
        if(email) user.email = email
        if(phoneNumber)  user.phoneNumber = phoneNumber
        if(bio) user.profile.bio = bio
        if(skills) user.profile.skills = skillsArray
      
        if(cloudResponse){
            user.profile.resume = cloudResponse.secure_url // save the cloudinary url
            user.profile.resumeOriginalName = file.originalname // Save the original file name
        }


        await user.save();

        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        }

        return res.status(200).json({
            message:"Profile updated successfully.",
            user,
            success:true
        })
    } catch (error) {
        console.error("Profile update failed:", error);
        return res.status(500).json({ message: "Unable to update profile. Please try again.", success: false });
    }
}
