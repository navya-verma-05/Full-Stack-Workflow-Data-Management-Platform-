import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestUser, getApp } from './helpers.js';
import { User } from '../src/models/User.js';

describe('Auth Flows (Register, Login, Refresh, Logout, Me)', () => {
  it('allows bootstrapping the first user as admin when no users exist', async () => {
    const app = getApp();
    const res = await request(app).post('/api/auth/register').send({
      name: 'Initial Admin',
      email: 'admin@example.com',
      password: 'AdminPassword123!',
      role: 'viewer', // First user is forced to admin regardless of requested role
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('admin@example.com');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('rejects unauthenticated registration once an admin exists', async () => {
    const app = getApp();
    await createTestUser({ email: 'admin@example.com', role: 'admin' });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Another User',
      email: 'viewer@example.com',
      password: 'Password123!',
      role: 'viewer',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows an authenticated admin to register new users and rejects duplicate emails', async () => {
    const app = getApp();
    const { accessToken } = await createTestUser({
      email: 'admin@example.com',
      role: 'admin',
    });

    const createRes = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Team Manager',
        email: 'manager@example.com',
        password: 'ManagerPassword123!',
        role: 'manager',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.user.role).toBe('manager');
    expect(createRes.body.user.passwordHash).toBeUndefined();

    const dupRes = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Duplicate Manager',
        email: 'manager@example.com',
        password: 'ManagerPassword123!',
        role: 'viewer',
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('logs in, refreshes access token via httpOnly cookie, fetches /me, and logs out', async () => {
    const app = getApp();
    await createTestUser({
      email: 'alice@example.com',
      password: 'AlicePassword123!',
      role: 'manager',
    });

    const agent = request.agent(app);

    const loginRes = await agent.post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'AlicePassword123!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeTypeOf('string');
    expect(loginRes.body.user.email).toBe('alice@example.com');
    expect(loginRes.body.user.passwordHash).toBeUndefined();

    const setCookieHeader = loginRes.headers['set-cookie']?.join(';') || '';
    expect(setCookieHeader).toContain('refreshToken=');
    expect(setCookieHeader).toContain('HttpOnly');

    const meRes = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('alice@example.com');
    expect(meRes.body.user.role).toBe('manager');

    const refreshRes = await agent.post('/api/auth/refresh');
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTypeOf('string');
    expect(refreshRes.body.user.email).toBe('alice@example.com');

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await agent.post('/api/auth/refresh');
    expect(refreshAfterLogout.status).toBe(401);
  });

  it('rejects bad password with 401 and disabled user with 403', async () => {
    const app = getApp();
    await createTestUser({
      email: 'bob@example.com',
      password: 'BobPassword123!',
      role: 'viewer',
      active: true,
    });

    const badPassRes = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'WrongPassword!',
    });
    expect(badPassRes.status).toBe(401);

    await User.updateOne({ email: 'bob@example.com' }, { active: false });

    const disabledRes = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'BobPassword123!',
    });
    expect(disabledRes.status).toBe(403);
    expect(disabledRes.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

