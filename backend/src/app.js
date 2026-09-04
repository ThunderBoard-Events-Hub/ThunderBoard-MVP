import express from 'express';
import organizationRoutes from './routes/organizationRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import tagRoutes from './routes/tagRoutes.js';

const app = express();

app.use(express.json());

app.use('/api/organizations', organizationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tags', tagRoutes);

export default app;