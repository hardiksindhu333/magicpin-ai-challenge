import { createApp } from './app.js';
import dotenv from 'dotenv';
dotenv.config();
const app = createApp();
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log(`Vera listening on port ${port}`);
});
