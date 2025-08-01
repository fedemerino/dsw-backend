export default async () => ({
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/.jest/setEnvVars.js'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 100,
      lines: 100,
      statements: 99.87,
    },
  },
});
