import * as organizationModel from "../models/organizationModel.js";
import { organizationContainerClient } from "../config/storage.js";
import { uploadImage, deleteImage } from "../services/imageUploadService.js";

export const createOrganization = async (req, res) => {
    const { name, email, description } = req.body;
    let { image_url } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: "name and email are required" });
    }
    try {
        const auth0_id = req.auth.payload.sub;
        const existing = await organizationModel.getOrganizationByAuth0Id(auth0_id);
        if (existing) {
            return res.status(409).json({ error: "An organization profile already exists for this account" });
        }

        if (req.file) {
            image_url = await uploadImage(organizationContainerClient, req.file);
        }
        const organization = await organizationModel.createOrganization({
            name,
            email,
            auth0_id,
            description,
            image_url,
        });
        res.status(201).json(organization);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "An organization with that name or email already exists" });
        }
        console.error("Error creating organization:", error);
        res.status(500).json({ error: "Failed to create organization" });
    }
};

export const getAllOrganizations = async (req, res) => {
    try {
        const organizations = await organizationModel.getAllOrganizations();
        res.json(organizations);
    } catch (error) {
        console.error("Error fetching organizations:", error);
        res.status(500).json({ error: "Failed to fetch organizations" });
    }
};

export const searchOrganizationsByName = async (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ error: "Query param 'name' is required" });
    }
    try {
        const organizations = await organizationModel.searchOrganizationsByName(name);
        res.json(organizations);
    } catch (error) {
        console.error("Error searching organizations:", error);
        res.status(500).json({ error: "Failed to search organizations" });
    }
};

export const getOrganizationById = async (req, res) => {
    try {
        const organization = await organizationModel.getOrganizationById(req.params.id);
        if (!organization) {
            return res.status(404).json({ error: "Organization not found" });
        }
        res.json(organization);
    } catch (error) {
        console.error("Error fetching organization:", error);
        res.status(500).json({ error: "Failed to fetch organization" });
    }
};

export const updateOrganization = async (req, res) => {
    const { name, description } = req.body;
    let { image_url } = req.body;
    try {
        // requireOwnOrganization middleware already verified this org exists and is owned by the caller
        const existing = req.organization;

        if (req.file) {
            image_url = await uploadImage(organizationContainerClient, req.file);
        }

        const organization = await organizationModel.updateOrganization(req.params.id, {
            name,
            description,
            image_url,
        });

        //once update is sucessfull, delete the old image from azure blob storage.
        if (req.file && existing.image_url) {
            try {
                await deleteImage(organizationContainerClient, existing.image_url);
            } catch (cleanupError) {
                console.error("Failed to delete old organization image:", cleanupError);
            }
        }

        res.json(organization);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "An organization with that name already exists" });
        }
        console.error("Error updating organization:", error);
        res.status(500).json({ error: "Failed to update organization" });
    }
};

export const incrementFollowersCount = async (req, res) => {
    try {
        const organization = await organizationModel.incrementFollowersCount(req.params.id);
        if (!organization) {
            return res.status(404).json({ error: "Organization not found" });
        }
        res.json(organization);
    } catch (error) {
        console.error("Error incrementing followers count:", error);
        res.status(500).json({ error: "Failed to increment followers count" });
    }
};

export const decrementFollowersCount = async (req, res) => {
    try {
        const organization = await organizationModel.decrementFollowersCount(req.params.id);
        if (!organization) {
            return res.status(404).json({ error: "Organization not found" });
        }
        res.json(organization);
    } catch (error) {
        console.error("Error decrementing followers count:", error);
        res.status(500).json({ error: "Failed to decrement followers count" });
    }
};

export const deleteOrganization = async (req, res) => {
    try {
        const organization = await organizationModel.deleteOrganization(req.params.id);
        if (!organization) {
            return res.status(404).json({ error: "Organization not found" });
        }
        res.json(organization);
    } catch (error) {
        console.error("Error deleting organization:", error);
        res.status(500).json({ error: "Failed to delete organization" });
    }
};
