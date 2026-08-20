import app from './app.js';
import { scheduleJobs } from './jobs/index.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

scheduleJobs();
