import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.AZURE_DATABASE_URL,
    // Local Postgres doesn't speak SSL; only require it in production (e.g. Heroku)
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const connectPG = async () => {
    try {
        const client = await pool.connect();
        console.log(
            `\nSuccessfully connected to PostgreSQL: ${client.connectionParameters.host}/${client.connectionParameters.database}`
        );
        client.release();
    } catch (error) {
        console.error("Error connecting to PostgreSQL:", error);
        process.exit(1);
    }
};

export default connectPG;

//TODO: check connection by running `npm run dev`