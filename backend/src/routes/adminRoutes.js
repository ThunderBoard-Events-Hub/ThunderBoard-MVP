import { Router } from "express";
import * as adminController from "../controllers/adminController.js";
import { checkJwt } from "../middleware/auth.js";

const router = Router();

// Deliberately checkJwt only, not requireAdmin — see adminController.getAdminStatus.
router.get("/me", checkJwt, adminController.getAdminStatus);

export default router;
