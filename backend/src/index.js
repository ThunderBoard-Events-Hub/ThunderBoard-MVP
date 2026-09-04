import dotenv from 'dotenv';
import connectPG from './config/database.js';
import app from './app.js';

dotenv.config({
    path: './.env'
});

const startServer = async () => {
    try{
        //start db connection
        await connectPG();

        app.on("error", (error) => {
            console.error('Error occurred in the app:', error);
            throw error; // Rethrow the error to be caught in the outer try-catch
        });

        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running on port ${process.env.PORT}`);
        });
        

    } catch (error) {
        console.error('Error starting server:', error);
    }
}

startServer();