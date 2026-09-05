import { Router } from "express";
import * as tagController from "../controllers/tagController.js";
import { checkJwt, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.post("/", checkJwt, requireAdmin, tagController.createTag);
router.get("/", tagController.getAllTags);
router.get("/:id", tagController.getTagById);
router.delete("/:id", checkJwt, requireAdmin, tagController.deleteTag);

export default router;
