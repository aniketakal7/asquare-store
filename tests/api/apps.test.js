const request = require('supertest');
const app = require('../../server');

describe('ASquare Store API Endpoints', () => {
    let devToken = '';
    let devId = '';

    test('GET /api/health returns 200 OK with sqlite info', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.database).toBe('sqlite');
    });

    test('GET /api/apps returns list of published apps', async () => {
        const res = await request(app).get('/api/apps');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('name');
            expect(res.body[0]).toHaveProperty('status', 'published');
        }
    });

    test('POST /api/developer/register creates a developer account with token', async () => {
        const res = await request(app)
            .post('/api/developer/register')
            .send({ name: 'Test Studio' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('developerId');
        expect(res.body).toHaveProperty('token');
        expect(res.body.name).toBe('Test Studio');

        devId = res.body.developerId;
        devToken = res.body.token;
    });

    test('POST /api/apps rejects upload without valid dev token or APK', async () => {
        const res = await request(app)
            .post('/api/apps')
            .send({ name: 'Test App', category: 'Utility', version: '1.0.0', summary: 'Test' });

        expect(res.status).toBe(401);
    });

    test('POST /api/admin/login authenticates admin with valid key', async () => {
        const res = await request(app)
            .post('/api/admin/login')
            .send({ key: 'dev-only-change-me' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('POST /api/apps/ritika-ai/reviews adds a review successfully', async () => {
        const res = await request(app)
            .post('/api/apps/ritika-ai/reviews')
            .send({
                user: 'Test User',
                rating: 5,
                comment: 'Automated test review'
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Review added successfully.');
        expect(res.body.app).toHaveProperty('id', 'ritika-ai');
    });
});
