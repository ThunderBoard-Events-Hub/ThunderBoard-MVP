import { pool } from "../config/database.js";

export const createEvent = async ({
    organizer_id,
    title,
    description,
    start_date,
    start_time,
    end_time,
    location,
    image_url,
    status,
}) => {
    const { rows } = await pool.query(
        `INSERT INTO events (organizer_id, title, description, start_date, start_time, end_time, location, image_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'published'))
         RETURNING *`,
        [organizer_id, title, description, start_date, start_time, end_time, location, image_url, status]
    );
    return rows[0];
};

// --- CRUD operations for events ---

export const getAllEvents = async () => {
    // Fetch all events ordered by start_date
    const { rows } = await pool.query(`SELECT * FROM events ORDER BY start_date`);
    return rows;
};

export const getEventById = async (id) => {
    const { rows } = await pool.query(`SELECT * FROM events WHERE id = $1`, [id]);
    return rows[0];
};

// Fetch all events for a specific organizer ordered by start_date
export const getEventsByOrganizer = async (organizer_id) => {
    const { rows } = await pool.query(
        `SELECT * FROM events WHERE organizer_id = $1 ORDER BY start_date`,
        [organizer_id]
    );
    return rows;
};

// Case-insensitive partial match search by event title
export const searchEventsByTitle = async (title) => {
    const { rows } = await pool.query(
        `SELECT * FROM events WHERE title ILIKE $1 ORDER BY start_date`,
        [`%${title}%`]
    );
    return rows;
};



export const updateEvent = async (id, fields) => {
    const {
        title,
        description,
        start_date,
        start_time,
        end_time,
        location,
        image_url,
        status,
    } = fields;
    
    const { rows } = await pool.query(
        `UPDATE events
         SET title = COALESCE($2, title),
             description = COALESCE($3, description),
             start_date = COALESCE($4, start_date),
             start_time = COALESCE($5, start_time),
             end_time = COALESCE($6, end_time),
             location = COALESCE($7, location),
             image_url = COALESCE($8, image_url),
             status = COALESCE($9, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, title, description, start_date, start_time, end_time, location, image_url, status]
    );
    return rows[0];
};

export const deleteEvent = async (id) => {
    // Delete an event by ID and return the deleted event
    const { rows } = await pool.query(`DELETE FROM events WHERE id = $1 RETURNING *`, [id]);
    return rows[0];
};


// --- event <-> tags (event_tags join table) ---
export const getTagsForEvent = async (event_id) => {
    const { rows } = await pool.query(
        `SELECT t.* FROM tags t
         JOIN event_tags et ON et.tag_id = t.id
         WHERE et.event_id = $1
         ORDER BY t.name`,
        [event_id]
    );
    return rows;
};

// Fetch distinct events that have at least one of the given tag ids
export const getEventsByAnyTags = async (tag_ids) => {
    const { rows } = await pool.query(
        `SELECT DISTINCT e.* FROM events e
         JOIN event_tags et ON et.event_id = e.id
         WHERE et.tag_id = ANY($1)
         ORDER BY e.start_date`,
        [tag_ids]
    );
    return rows;
};

// Add a tag to an event in the event_tags join table, ensuring no duplicates
export const addTagToEvent = async (event_id, tag_id) => {
    await pool.query(
        `INSERT INTO event_tags (event_id, tag_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [event_id, tag_id]
    );
};

// Remove a tag from an event in the event_tags join table
export const removeTagFromEvent = async (event_id, tag_id) => {
    await pool.query(
        `DELETE FROM event_tags WHERE event_id = $1 AND tag_id = $2`,
        [event_id, tag_id]
    );
};
