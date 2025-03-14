module.exports = {
  // La directory radice per la ricerca dei test
  roots: ['<rootDir>/__tests__', '<rootDir>/static/js'],
  
  // Pattern per trovare i file di test
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  
  // Ambiente di test (jsdom simula un browser)
  testEnvironment: 'jsdom',
  
  // Estensioni dei file da considerare
  moduleFileExtensions: ['js', 'json'],
  
  // Verbosità dell'output
  verbose: true,
  
  // Setup per i test
  setupFiles: ['<rootDir>/jest.setup.js']
};