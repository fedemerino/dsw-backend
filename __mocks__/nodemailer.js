// Global manual mock, wired up via jest.config.js's moduleNameMapper.
//
// Integration tests hit real Postgres but never a real third-party network
// call (see docs/testing.md) - without this, every controller path that now
// sends an email (createBooking, cancelBooking, the payment webhook) would
// attempt a real SMTP connection with the fake credentials from
// .jest/setEnvVars.js, hanging until connection timeout on every single
// test run and turning a ~10s suite into several minutes.
export const createTransport = () => ({
  sendMail: () => Promise.resolve({}),
});

export default { createTransport };
