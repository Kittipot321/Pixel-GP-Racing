// Public entry point for the @pixel-race/database package.
//
// Re-exports the schema, inferred row types, and connection lifecycle so
// consumers (the API, scripts, tests) import from one place.

export * from './schema.js';
export * from './connection.js';
