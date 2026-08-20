export default async () => ({
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/.jest/setEnvVars.js'],
  // Integration tests hit real Postgres but should never make a real
  // third-party network call - this keeps nodemailer mocked everywhere by
  // default (mail.service.test.js still overrides it per-file when it needs
  // to assert on sendMail calls). See __mocks__/nodemailer.js.
  moduleNameMapper: {
    '^nodemailer$': '<rootDir>/__mocks__/nodemailer.js',
  },
  // Floor set a few points below measured coverage (~98% stmts / 86% branch /
  // 96% funcs / 99% lines across controllers, services, middlewares, schemas,
  // routes) so it fails on real regressions without being brittle. See docs/testing.md.
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 95,
      statements: 95,
    },
  },
});
