import * as tagModel from "../models/tagModel.js";

export const createTag = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: "name is required" });
    }
    try {
        const tag = await tagModel.createTag(name);
        res.status(201).json(tag);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "A tag with that name already exists" });
        }
        console.error("Error creating tag:", error);
        res.status(500).json({ error: "Failed to create tag" });
    }
};

export const getAllTags = async (req, res) => {
    try {
        const tags = await tagModel.getAllTags();
        res.json(tags);
    } catch (error) {
        console.error("Error fetching tags:", error);
        res.status(500).json({ error: "Failed to fetch tags" });
    }
};

export const getTagById = async (req, res) => {
    try {
        const tag = await tagModel.getTagById(req.params.id);
        if (!tag) {
            return res.status(404).json({ error: "Tag not found" });
        }
        res.json(tag);
    } catch (error) {
        console.error("Error fetching tag:", error);
        res.status(500).json({ error: "Failed to fetch tag" });
    }
};

export const deleteTag = async (req, res) => {
    try {
        const tag = await tagModel.deleteTag(req.params.id);
        if (!tag) {
            return res.status(404).json({ error: "Tag not found" });
        }
        res.json(tag);
    } catch (error) {
        console.error("Error deleting tag:", error);
        res.status(500).json({ error: "Failed to delete tag" });
    }
};
