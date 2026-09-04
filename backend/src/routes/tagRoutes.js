import { Router } from "express";
import * as tagController from "../controllers/tagController.js";

const router = Router();

router.post("/", tagController.createTag);
router.get("/", tagController.getAllTags);
router.get("/:id", tagController.getTagById);
router.delete("/:id", tagController.deleteTag);

export default router;
