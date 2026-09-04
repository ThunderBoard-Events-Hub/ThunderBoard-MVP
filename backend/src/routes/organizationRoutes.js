import { Router } from "express";
import * as organizationController from "../controllers/organizationController.js";

const router = Router();

router.post("/", organizationController.createOrganization);
router.get("/", organizationController.getAllOrganizations);
router.get("/search", organizationController.searchOrganizationsByName);
router.get("/:id", organizationController.getOrganizationById);
router.put("/:id", organizationController.updateOrganization);
router.post("/:id/follow", organizationController.incrementFollowersCount);
router.delete("/:id", organizationController.deleteOrganization);

export default router;
