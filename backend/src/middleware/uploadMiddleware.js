import multer from "multer";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Memory storage — the file lands in req.file.buffer so a controller can
// stream it straight to Azure Blob Storage without ever touching disk.
// disk meaning the local filesystem of the server.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"));
        }
        cb(null, true);
    },
});

// parseImage("image") -> expects a multipart/form-data request with a single
// file field named "image" (use a different fieldName per form as needed,
// e.g. "logo" for organizations).
export const parseImage = (fieldName) => (req, res, next) => {
    upload.single(fieldName)(req, res, (error) => {
        if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    error: `Image must be smaller than ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
                });
            }
            return res.status(400).json({ error: error.message });
        }
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        next();
    });
};
