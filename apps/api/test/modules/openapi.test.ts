import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('OpenAPI', () => {
  it('serves the spec with every documented path and the shared error schema', async () => {
    const res = await request(createApp()).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.paths).toHaveProperty('/health');
    expect(res.body.components.schemas).toHaveProperty('ErrorResponse');
    expect(res.body.components.schemas).toHaveProperty('HealthResponse');
  });

  it('serves Swagger UI', async () => {
    const res = await request(createApp()).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
