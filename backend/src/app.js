import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import organizationRoutes from './routes/organizationRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import tagRoutes from './routes/tagRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();

// Always allow local dev, plus whatever the deployed frontend URL is set to.
const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173'].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // no Origin header means a non-browser request (curl, server-to-server) — CORS doesn't apply
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
}));
app.use(express.json());

app.use('/api/organizations', organizationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Not allowed by CORS' });
    }
    // express-oauth2-jwt-bearer throws these for a missing/invalid/expired Auth0 token
    if (err.status && err.headers && err.headers['WWW-Authenticate']) {
        return res.status(err.status).json({ error: err.message });
    }
    next(err);
});

export default app;