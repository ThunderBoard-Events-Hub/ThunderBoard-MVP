import { pool } from "../config/database.js";

// Columns safe to expose to clients — password_hash is deliberately excluded
const PUBLIC_COLUMNS = "id, name, email, description, image_url, followers_count, created_at";

export const createOrganization = async ({ name, email, password_hash, description, image_url }) => {
    const { rows } = await pool.query(
        `INSERT INTO organizations (name, email, password_hash, description, image_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${PUBLIC_COLUMNS}`,
        [name, email, password_hash, description, image_url]
    );
    return rows[0];
};

export const getAllOrganizations = async () => {
    const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM organizations ORDER BY id`);
    return rows;
};

export const getOrganizationById = async (id) => {
    const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM organizations WHERE id = $1`, [id]);
    return rows[0];
};

// Includes password_hash — for internal auth/login use only, never expose via a route
export const getOrganizationByEmail = async (email) => {
    const { rows } = await pool.query(`SELECT * FROM organizations WHERE email = $1`, [email]);
    return rows[0];
};

// Case-insensitive partial match search by organization name
export const searchOrganizationsByName = async (name) => {
    const { rows } = await pool.query(
        `SELECT ${PUBLIC_COLUMNS} FROM organizations WHERE name ILIKE $1 ORDER BY name`,
        [`%${name}%`]
    );
    return rows;
};

export const updateOrganization = async (id, { name, description, image_url }) => {
    const { rows } = await pool.query(
        `UPDATE organizations
         SET name = COALESCE($2, name),
             description = COALESCE($3, description),
             image_url = COALESCE($4, image_url)
         WHERE id = $1
         RETURNING ${PUBLIC_COLUMNS}`,
        [id, name, description, image_url]
    );
    return rows[0];
};

export const incrementFollowersCount = async (id) => {
    const { rows } = await pool.query(
        `UPDATE organizations
         SET followers_count = followers_count + 1
         WHERE id = $1
         RETURNING ${PUBLIC_COLUMNS}`,
        [id]
    );
    return rows[0];
};

export const deleteOrganization = async (id) => {
    const { rows } = await pool.query(`DELETE FROM organizations WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`, [id]);
    return rows[0];
};
