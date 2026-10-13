import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
        const extension = file.originalname.split(".").pop()?.toLowerCase();
        const allowed = (file.mimetype === "application/pdf" && extension === "pdf")
            || (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) && ["jpg", "jpeg", "png", "webp"].includes(extension));
        callback(allowed ? null : new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"), allowed);
    },
}).single("file");

export const singleUpload = (req, res, next) => upload(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
    return res.status(400).json({ success: false, message: tooLarge ? "Files must be 8 MB or smaller." : "Upload a PDF resume or a JPEG, PNG, or WebP profile image." });
});
