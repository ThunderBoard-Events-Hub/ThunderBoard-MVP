import { pool } from "../config/database.js";

export const createTag = async (name) => {
    const { rows } = await pool.query(
        `INSERT INTO tags (name) VALUES ($1) RETURNING *`,
        [name]
    );
    return rows[0];
};

export const getAllTags = async () => {
    const { rows } = await pool.query(`SELECT * FROM tags ORDER BY id`);
    return rows;
};

export const getTagById = async (id) => {
    const { rows } = await pool.query(`SELECT * FROM tags WHERE id = $1`, [id]);
    return rows[0];
};

export const getTagByName = async (name) => {
    const { rows } = await pool.query(`SELECT * FROM tags WHERE name = $1`, [name]);
    return rows[0];
};

export const deleteTag = async (id) => {
    const { rows } = await pool.query(`DELETE FROM tags WHERE id = $1 RETURNING *`, [id]);
    return rows[0];
};
