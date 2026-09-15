import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

describe('P0-4: Team Member Assignment and Authorization', () => {
  let adminToken;
  let teamMemberToken;
  let eventId;
  let availableTeamMemberId;

  beforeAll(async () => {
    // 1. Authenticate admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Admin@123456' });
    adminToken = adminRes.headers['set-cookie'];

    // 2. Authenticate team member
    const teamRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'photographer@example.com', password: 'Member@123456' });
    teamMemberToken = teamRes.headers['set-cookie'];

    // 3. Find event
    const event = await prisma.event.findFirst({
      where: { name: 'TechCorp Annual Conference 2026' },
    });
    eventId = event.id;

    // 4. Find available team member not yet assigned to this event
    const user = await prisma.user.findFirst({
      where: { email: 'sneha@example.com', role: 'TEAM_MEMBER' },
    });
    availableTeamMemberId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('P0-4: Admin can list team members in event', async () => {
    const res = await request(app)
      .get(`/api/events/${eventId}/members`)
      .set('Cookie', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.members)).toBe(true);
  });

  test('P0-4: Admin can search available team members', async () => {
    const res = await request(app)
      .get('/api/events/team-members?search=sneha')
      .set('Cookie', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users.length).toBeGreaterThan(0);
    expect(res.body.data.users[0].email).toBe('sneha@example.com');
  });

  test('P0-4: Admin can assign team member to event', async () => {
    // Remove if previously existing
    await prisma.eventMember.deleteMany({
      where: { eventId, userId: availableTeamMemberId },
    });

    const res = await request(app)
      .post(`/api/events/${eventId}/members`)
      .set('Cookie', adminToken)
      .send({ userId: availableTeamMemberId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.member.userId).toBe(availableTeamMemberId);

    // Verify in database
    const membership = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId: availableTeamMemberId } },
    });
    expect(membership).toBeTruthy();
  });

  test('P0-4: Admin can remove team member from event', async () => {
    const res = await request(app)
      .delete(`/api/events/${eventId}/members/${availableTeamMemberId}`)
      .set('Cookie', adminToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify deleted
    const membership = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId, userId: availableTeamMemberId } },
    });
    expect(membership).toBeNull();
  });

  test('P0-4: Team Member cannot list, add, or remove event members (403 Forbidden)', async () => {
    // 1. List attempt
    const listRes = await request(app)
      .get(`/api/events/${eventId}/members`)
      .set('Cookie', teamMemberToken);
    expect(listRes.status).toBe(403);

    // 2. Add attempt
    const addRes = await request(app)
      .post(`/api/events/${eventId}/members`)
      .set('Cookie', teamMemberToken)
      .send({ userId: availableTeamMemberId });
    expect(addRes.status).toBe(403);

    // 3. Remove attempt
    const delRes = await request(app)
      .delete(`/api/events/${eventId}/members/${availableTeamMemberId}`)
      .set('Cookie', teamMemberToken);
    expect(delRes.status).toBe(403);
  });
});
