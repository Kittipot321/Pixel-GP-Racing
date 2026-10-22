// Shared types for the Pixel Race monorepo.
// These contracts are consumed by both the API and the web app so the two
// sides of the wire agree on shapes without duplicating definitions.

export * from './domain.js';
export * from './validation.js';

/**
 * Response body returned by the API health endpoint (`GET /api/v1/health`).
 */
export interface HealthStatus {
  status: 'ok';
}
