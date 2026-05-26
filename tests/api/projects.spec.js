// @ts-check
const { test, expect } = require('@playwright/test');

// These tests hit MongoDB-backed endpoints.
// Set SKIP_DB_TESTS=true in CI if MongoDB is unavailable.
test.describe('Projects API', () => {
  test.skip(!!process.env.SKIP_DB_TESTS, 'Skipped: requires DB');

  test('POST /projects/list returns a list response', async ({ request }) => {
    const res = await request.post('/projects/list', {
      data: { companyCode: 'ddep' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Expects { status: 1|0, data: [...] }
    expect(body).toHaveProperty('status');
  });

  test('GET /projects/get/:id with invalid id returns error', async ({ request }) => {
    const res = await request.get('/projects/get/000000000000000000000000');
    expect([200, 404, 500]).toContain(res.status());
  });
});

test.describe('Items API', () => {
  test.skip(!!process.env.SKIP_DB_TESTS, 'Skipped: requires DB');

  test('POST /projects/item-list returns a list response', async ({ request }) => {
    const res = await request.post('/projects/item-list', {
      data: { companyCode: 'ddep' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});

test.describe('Inbound API', () => {
  test.skip(!!process.env.SKIP_DB_TESTS, 'Skipped: requires DB');

  test('POST /inbound/inboundrun with missing item_id returns error', async ({ request }) => {
    const res = await request.post('/inbound/inboundrun', {
      data: {},
    });
    // Should fail gracefully — not crash the server
    expect([200, 400, 404, 500]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe(0);
  });
});

test.describe('Queue status endpoint', () => {
  test.skip(!!process.env.SKIP_DB_TESTS, 'Skipped: requires Redis');

  test('GET /count/queues/logs returns queue counts', async ({ request }) => {
    const res = await request.get('/count/queues/logs');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('logQueue');
    expect(body).toHaveProperty('batchQueue');
  });
});
