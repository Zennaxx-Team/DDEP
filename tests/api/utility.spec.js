// @ts-check
const { test, expect } = require('@playwright/test');

// These endpoints work without a DB connection.
test.describe('Utility API — /generatekey', () => {
  test('generates a UUID key', async ({ request }) => {
    const res = await request.post('/generatekey', {
      data: { ddep_api_auth_type: 'API_Key' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(1);
    expect(body.data.key).toBeTruthy();
  });

  test('generates a JWT bearer key (base64)', async ({ request }) => {
    const res = await request.post('/generatekey', {
      data: { ddep_api_auth_type: 'JWT_Bearer', base64Encode: true },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe(1);
    // Base64-encoded UUIDs are longer than raw UUIDs
    expect(body.data.key.length).toBeGreaterThan(20);
  });
});

test.describe('Utility API — /encode', () => {
  test('base64-encodes a string', async ({ request }) => {
    const res = await request.post('/encode', {
      data: { key: 'hello-world' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.key).toBe(Buffer.from('hello-world').toString('base64'));
  });
});

test.describe('Utility API — /mapping/convert', () => {
  test('converts JSON to inbound GOJSD schema', async ({ request }) => {
    const res = await request.post('/mapping/convert/injson2GOJSD', {
      data: { name: 'test', value: 123 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('schema');
    expect(body).toHaveProperty('keys');
    expect(Array.isArray(body.keys)).toBe(true);
  });

  test('converts JSON to outbound GOJSD schema', async ({ request }) => {
    const res = await request.post('/mapping/convert/outjson2GOJSD', {
      data: { orderId: 'ABC', total: 99.9 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('schema');
    expect(body).toHaveProperty('keys');
  });

  test('converts XML to JSON', async ({ request }) => {
    const res = await request.post('/mapping/convert/xml2JSON', {
      headers: { 'Content-Type': 'text/plain' },
      data: '<root><item>hello</item></root>',
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('root');
  });
});
