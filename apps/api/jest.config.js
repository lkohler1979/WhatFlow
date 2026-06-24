/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // Os imports do código usam o sufixo `.js` (NodeNext/ESM). Mapeamos
  // tanto os aliases quanto os relativos removendo o `.js` para o ts-jest.
  moduleNameMapper: {
    '^@core/(.*)\\.js$': '<rootDir>/src/core/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@modules/(.*)\\.js$': '<rootDir>/src/modules/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@integrations/(.*)\\.js$': '<rootDir>/src/integrations/$1',
    '^@integrations/(.*)$': '<rootDir>/src/integrations/$1',
    '^@middlewares/(.*)\\.js$': '<rootDir>/src/middlewares/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@queues/(.*)\\.js$': '<rootDir>/src/queues/$1',
    '^@queues/(.*)$': '<rootDir>/src/queues/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};
