import * as organizationModel from "../models/organizationModel.js";

export const createOrganization = async (req, res) => {
    const { name, email, password_hash, description, image_url } = req.body;
    if (!name || !email || !password_hash) {
        return res.status(400).json({ error: "name, email and password_hash are required" });
    }
    try {
        const organization = await organizationModel.createOrganization({
            name,
            email,
            password_hash,
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
    const { name, description, image_url } = req.body;
    try {
        const organization = await organizationModel.updateOrganization(req.params.id, {
            name,
            description,
            image_url,
        });
        if (!organization) {
            return res.status(404).json({ error: "Organization not found" });
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
