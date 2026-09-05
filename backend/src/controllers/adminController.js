import { isAdminSub } from "../middleware/auth.js";

// Answers honestly for any authenticated caller — never 403s a non-admin, unlike
// every other /api/admin endpoint — so the frontend can decide whether to render
// admin-only UI (e.g. a nav link) without treating "not an admin" as an error.
export const getAdminStatus = (req, res) => {
    res.json({ isAdmin: isAdminSub(req.auth.payload.sub) });
};
