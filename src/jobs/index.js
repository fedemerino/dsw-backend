import cron from 'node-cron';
import { cancelExpiredPendingBookings } from './cancelExpiredBookings.job.js';

/**
 * Registers all scheduled background jobs. Only call this from the real
 * running server (src/index.js) - never from src/app.js, which Supertest
 * imports directly in tests.
 */
export function scheduleJobs() {
  cron.schedule('0 * * * *', async () => {
    try {
      const count = await cancelExpiredPendingBookings();
      if (count > 0) {
        console.log(`Auto-cancelled ${count} expired pending booking(s).`);
      }
    } catch (err) {
      console.error('cancelExpiredPendingBookings job failed:', err);
    }
  });
}
