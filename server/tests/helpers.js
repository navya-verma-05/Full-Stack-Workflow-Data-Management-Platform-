import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import bcrypt from 'bcryptjs';
import { signAccessToken } from '../src/services/authService.js';

export function getApp() {
  return createApp();
}

export async function createTestUser({
  name = 'Test User',
  email = 'user@example.com',
  password = 'Password123!',
  role = 'viewer',
  active = true,
} = {}) {
  const passwordHash = await bcrypt.hash(password, 6);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    active,
  });
  const accessToken = signAccessToken(user);
  return { user, accessToken, password };
}

export async function loginViaApi(app, email, password) {
  return request(app).post('/api/auth/login').send({ email, password });
}

