module.exports = {
  // Set the test environment
  testEnvironment: 'jsdom',
  
  // Define where Jest should look for test files
  roots: [
    '<rootDir>/__tests__',
    '<rootDir>/chat/static/js',
    '<rootDir>/cal/static/js',
    '<rootDir>/workflow/static/js',
    '<rootDir>/dashboard/static/js'
  ],
  
  // File patterns to match for test files
  testMatch: [
    '**/__tests__/**/*.test.js?(x)',
    '**/__tests__/**/*.spec.js?(x)',
    '**/?(*.)+(spec|test).js?(x)'
  ],
  
  // Explicitly tell Jest which files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/mocks/'
  ],
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Transform files with Babel
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Mock static assets
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__tests__/mocks/styleMock.js',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__tests__/mocks/fileMock.js'
  }
};