import * as eventModel from "../models/eventModel.js";
import { eventsContainerClient } from "../config/storage.js";
import { uploadImage, deleteImage } from "../services/imageUploadService.js";

export const createEvent = async (req, res) => {
    const { title, description, start_date, start_time, end_time, location, status } = req.body;
    let { image_url } = req.body;
    if (!title || !start_date) {
        return res.status(400).json({ error: "title and start_date are required" });
    }

    try {
        // organizer_id always comes from the authenticated organization (attachOrganization
        // middleware), never from the request body — otherwise any org could create events
        // under another org's name.
        const organizer_id = req.organization.id;
        if (req.file) {
            image_url = await uploadImage(eventsContainerClient, req.file);
        }
        const event = await eventModel.createEvent({
            organizer_id,
            title,
            description,
            start_date,
            start_time,
            end_time,
            location,
            image_url,
            status,
        });
        res.status(201).json(event);
    } catch (error) {
        if (error.code === "23503") {
            return res.status(400).json({ error: "organizer_id does not reference an existing organization" });
        }
        if (error.code === "23514") {
            return res.status(400).json({ error: "status must be one of: draft, published, expired" });
        }
        console.error("Error creating event:", error);
        res.status(500).json({ error: "Failed to create event" });
    }
};

export const getAllEvents = async (req, res) => {
    try {
        const events = await eventModel.getAllEvents();
        res.json(events);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ error: "Failed to fetch events" });
    }
};

export const searchEventsByTitle = async (req, res) => {
    const { title } = req.query;
    if (!title) {
        return res.status(400).json({ error: "Query param 'title' is required" });
    }
    try {
        const events = await eventModel.searchEventsByTitle(title);
        res.json(events);
    } catch (error) {
        console.error("Error searching events:", error);
        res.status(500).json({ error: "Failed to search events" });
    }
};

export const getEventsByAnyTags = async (req, res) => {
    const { tag_ids } = req.query;
    if (!tag_ids) {
        return res.status(400).json({ error: "Query param 'tag_ids' is required (comma-separated ids)" });
    }
    const ids = tag_ids.split(",").map(Number);
    if (ids.some(Number.isNaN)) {
        return res.status(400).json({ error: "tag_ids must be a comma-separated list of numbers" });
    }
    try {
        const events = await eventModel.getEventsByAnyTags(ids);
        res.json(events);
    } catch (error) {
        console.error("Error fetching events by tags:", error);
        res.status(500).json({ error: "Failed to fetch events by tags" });
    }
};

export const getEventsByOrganizer = async (req, res) => {
    try {
        const events = await eventModel.getEventsByOrganizer(req.params.organizer_id);
        res.json(events);
    } catch (error) {
        console.error("Error fetching events by organizer:", error);
        res.status(500).json({ error: "Failed to fetch events by organizer" });
    }
};

export const getEventById = async (req, res) => {
    try {
        const event = await eventModel.getEventById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        res.json(event);
    } catch (error) {
        console.error("Error fetching event:", error);
        res.status(500).json({ error: "Failed to fetch event" });
    }
};

export const updateEvent = async (req, res) => {
    const { title, description, start_date, start_time, end_time, location, status } = req.body;
    let { image_url } = req.body;
    try {
        // requireOwnEvent middleware already verified this event exists and is owned by the caller
        const existing = req.event;

        if (req.file) {
            image_url = await uploadImage(eventsContainerClient, req.file);
        }

        const event = await eventModel.updateEvent(req.params.id, {
            title,
            description,
            start_date,
            start_time,
            end_time,
            location,
            image_url,
            status,
        });

        if (req.file && existing.image_url) {
            try {
                await deleteImage(eventsContainerClient, existing.image_url);
            } catch (cleanupError) {
                console.error("Failed to delete old event image:", cleanupError);
            }
        }

        res.json(event);
    } catch (error) {
        if (error.code === "23514") {
            return res.status(400).json({ error: "status must be one of: draft, published, expired" });
        }
        console.error("Error updating event:", error);
        res.status(500).json({ error: "Failed to update event" });
    }
};

export const deleteEvent = async (req, res) => {
    try {
        const event = await eventModel.deleteEvent(req.params.id);
        if (!event) {
            return res.status(404).json({ error: "Event not found" });
        }
        res.json(event);
    } catch (error) {
        console.error("Error deleting event:", error);
        res.status(500).json({ error: "Failed to delete event" });
    }
};

export const getTagsForEvent = async (req, res) => {
    try {
        const tags = await eventModel.getTagsForEvent(req.params.id);
        res.json(tags);
    } catch (error) {
        console.error("Error fetching tags for event:", error);
        res.status(500).json({ error: "Failed to fetch tags for event" });
    }
};

export const addTagToEvent = async (req, res) => {
    const { tag_id } = req.body;
    if (!tag_id) {
        return res.status(400).json({ error: "tag_id is required" });
    }
    try {
        await eventModel.addTagToEvent(req.params.id, tag_id);
        res.status(204).send();
    } catch (error) {
        if (error.code === "23503") {
            return res.status(400).json({ error: "event or tag does not exist" });
        }
        if (error.code === "22P02") {
            return res.status(400).json({ error: "tag_id must be a number" });
        }
        console.error("Error adding tag to event:", error);
        res.status(500).json({ error: "Failed to add tag to event" });
    }
};

export const removeTagFromEvent = async (req, res) => {
    try {
        await eventModel.removeTagFromEvent(req.params.id, req.params.tag_id);
        res.status(204).send();
    } catch (error) {
        if (error.code === "22P02") {
            return res.status(400).json({ error: "tag_id must be a number" });
        }
        console.error("Error removing tag from event:", error);
        res.status(500).json({ error: "Failed to remove tag from event" });
    }
};
