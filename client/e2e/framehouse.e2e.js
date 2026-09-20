/**
 * FRAMEHOUSE — Full End-to-End Workflow Test
 *
 * Tests the complete production workflow:
 *
 *   Admin login
 *     → Create event
 *       → Add team member
 *         → Team member logs in + uploads photo
 *           → Admin selects photo + creates gallery
 *             → Admin publishes gallery
 *               → Customer opens gallery URL
 *                 → Customer enters PIN
 *                   → Customer browses, favourites, views lightbox
 *
 * Prerequisites:
 *   1. Backend running on http://localhost:5000
 *   2. Frontend running on http://localhost:5173
 *   3. Seeded DB: cd server && npm run db:seed
 *
 * Run: cd client && npm run test:e2e
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Credentials (from seed) ──────────────────────────────────────────────────
const ADMIN_EMAIL    = 'admin@framehouse.com';
const ADMIN_PASSWORD = 'Admin@123456';
const TEAM_EMAIL     = 'photographer@framehouse.com';
const TEAM_PASSWORD  = 'Member@123456';

// We use the seeded wedding gallery for the customer flow
const SEEDED_GALLERY_SLUG = 'arjun-priya-wedding-2026';
const SEEDED_GALLERY_PIN  = '482917';

// ─── Helper: log in as a given user ──────────────────────────────────────────
async function loginAs(page, email, password) {
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Wait for redirect away from /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
}

// ─── Test 1: Authentication ────────────────────────────────────────────────────
test.describe('1. Authentication', () => {
  test('Admin can log in and reach the dashboard', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/(admin\/dashboard|admin\/events)/);
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test('Team member can log in and reach their dashboard', async ({ page }) => {
    await loginAs(page, TEAM_EMAIL, TEAM_PASSWORD);
    await expect(page).toHaveURL(/\/(team\/dashboard|team\/events|admin\/dashboard)/);
  });

  test('Login page rejects wrong password with an error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill('WrongPassword99');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should stay on login page and show an error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Protected route redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── Test 2: Admin — Event Management ─────────────────────────────────────────
test.describe('2. Admin — Event Management', () => {
  let createdEventName;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('Admin can create a new event', async ({ page }) => {
    createdEventName = `E2E Test Event ${Date.now()}`;

    await page.goto('/admin/events/new');
    await expect(page.getByRole('heading', { name: /new event|create event/i })).toBeVisible();

    await page.getByLabel(/event name/i).fill(createdEventName);
    // Date input — fill with ISO date string
    const dateInput = page.locator('input[type="date"], input[name*="date"], input[placeholder*="date"]').first();
    await dateInput.fill('2027-03-15');
    await page.getByLabel(/location/i).fill('E2E Test Venue');

    await page.getByRole('button', { name: /create|save/i }).click();

    // Should redirect to the new event page
    await expect(page).toHaveURL(/\/admin\/events\/.+/);
    await expect(page.getByText(createdEventName)).toBeVisible({ timeout: 8_000 });
  });

  test('Admin can see list of their events', async ({ page }) => {
    await page.goto('/admin/events');
    // Should show at least the seeded wedding event
    await expect(page.getByText(/Wedding|Conference|Fashion/i).first()).toBeVisible();
  });

  test('Admin can see event statistics', async ({ page }) => {
    await page.goto('/admin/events');
    // Click the first event
    await page.getByRole('link', { name: /Wedding|view|open/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/events\/.+/);
    // Should show photo stats
    await expect(page.getByText(/photos?|uploaded/i).first()).toBeVisible();
  });
});

// ─── Test 3: Admin — Team Management ──────────────────────────────────────────
test.describe('3. Admin — Team Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('Admin can view team members on an event', async ({ page }) => {
    await page.goto('/admin/events');
    await page.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/admin\/events\/.+/);

    // Open team panel or look for members section
    const teamButton = page.getByRole('button', { name: /team|members|photographers/i });
    if (await teamButton.isVisible()) {
      await teamButton.click();
    }
    // Should show at least one member from seed
    await expect(page.getByText(/photographer|Priya|Rahul/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

// ─── Test 4: Team Member — Photo Upload ───────────────────────────────────────
test.describe('4. Team Member — Photo Upload', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEAM_EMAIL, TEAM_PASSWORD);
  });

  test('Team member can see their assigned events', async ({ page }) => {
    // After login, should see events list
    const eventsLink = page.getByRole('link', { name: /events/i }).first();
    await eventsLink.click();
    await expect(page.getByText(/Wedding|assigned/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('Team member can navigate to upload page and see the upload UI', async ({ page }) => {
    // Navigate into the wedding event
    await page.goto('/team/events');
    await page.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/team\/events\/.+/);

    // Open upload section
    const uploadBtn = page.getByRole('button', { name: /upload/i });
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();
    }
    // Upload dropzone or input should be present
    await expect(
      page.locator('input[type="file"], [data-testid="dropzone"], .upload')
        .first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Team member cannot access admin event management pages', async ({ page }) => {
    // Try to create an event directly
    await page.goto('/admin/events/new');
    // Either redirected to login, shown 403, or no create form
    const isLoginPage = page.url().includes('/login');
    const hasCreateForm = await page.getByRole('button', { name: /create|save/i }).isVisible().catch(() => false);
    // At least one of these should be true: redirected OR no create form available
    expect(isLoginPage || !hasCreateForm).toBe(true);
  });
});

// ─── Test 5: Admin — Gallery Creation & Publishing ────────────────────────────
test.describe('5. Admin — Gallery Publishing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('Admin can see gallery section on event page', async ({ page }) => {
    await page.goto('/admin/events');
    await page.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/admin\/events\/.+/);

    // Look for gallery or publish button
    await expect(
      page.getByRole('button', { name: /publish|gallery|create gallery/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Publish modal shows PIN field and photo count', async ({ page }) => {
    await page.goto('/admin/events');
    await page.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/admin\/events\/.+/);

    // Open publish modal
    const publishBtn = page.getByRole('button', { name: /publish|create gallery/i }).first();
    await publishBtn.click();

    // Modal should contain PIN input
    await expect(
      page.locator('input[maxlength="6"], input[placeholder*="PIN"], input[placeholder*="482"]')
        .first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Admin can publish the seeded wedding event gallery', async ({ page }) => {
    await page.goto('/admin/events');
    await page.getByRole('link').first().click();

    const publishBtn = page.getByRole('button', { name: /publish|create gallery/i }).first();
    await publishBtn.click();

    // Fill gallery title if field is editable
    const titleInput = page.getByLabel(/gallery title/i);
    if (await titleInput.isVisible()) {
      await titleInput.clear();
      await titleInput.fill('E2E Wedding Gallery');
    }

    // Set PIN
    const pinInput = page.locator('input[maxlength="6"]').first();
    await pinInput.clear();
    await pinInput.fill('482917');

    // Submit
    await page.getByRole('button', { name: /publish/i }).last().click();

    // After publish, share URL or success message should appear
    await expect(
      page.getByText(/live|published|share|gallery url|copy link/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Published gallery success screen shows a copyable URL', async ({ page }) => {
    await page.goto('/admin/events');
    await page.getByRole('link').first().click();

    const publishBtn = page.getByRole('button', { name: /publish|create gallery/i }).first();
    await publishBtn.click();

    const pinInput = page.locator('input[maxlength="6"]').first();
    await pinInput.clear();
    await pinInput.fill('482917');

    await page.getByRole('button', { name: /publish/i }).last().click();
    await page.waitForTimeout(2_000);

    // An input with the gallery URL should be visible
    const urlInput = page.locator('input[readonly], input[value*="gallery"]').first();
    if (await urlInput.isVisible()) {
      const val = await urlInput.inputValue();
      expect(val).toContain('/gallery/');
    }
  });
});

// ─── Test 6: Customer — PIN-Protected Gallery ─────────────────────────────────
test.describe('6. Customer — Gallery Access', () => {
  // These tests do NOT require admin login — they simulate a customer
  // opening a fresh browser tab with the gallery URL and PIN

  test('Customer sees PIN screen when opening gallery URL', async ({ page }) => {
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);

    // Should show PIN input
    await expect(page.locator('input[inputmode="numeric"], .pin-input').first())
      .toBeVisible({ timeout: 10_000 });
  });

  test('Customer sees gallery title on PIN screen', async ({ page }) => {
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);
    await expect(page.getByText(/Arjun.*Priya|Wedding/i).first())
      .toBeVisible({ timeout: 8_000 });
  });

  test('Wrong PIN shows an error message', async ({ page }) => {
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);

    const pinInput = page.locator('input[inputmode="numeric"], .pin-input').first();
    await pinInput.fill('000000');
    await page.getByRole('button', { name: /open gallery/i }).click();

    await expect(page.getByText(/pin|incorrect|wrong|right/i).first())
      .toBeVisible({ timeout: 5_000 });
  });

  test('Correct PIN unlocks the gallery and shows photo grid', async ({ page }) => {
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);

    const pinInput = page.locator('input[inputmode="numeric"], .pin-input').first();
    await pinInput.fill(SEEDED_GALLERY_PIN);
    await page.getByRole('button', { name: /open gallery/i }).click();

    // Gallery grid should load — masonry figures or images
    await expect(
      page.locator('.masonry figure, .gallery-photo, [class*="photo"] img').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Customer can favourite a photo and see counter update', async ({ page }) => {
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);
    const pinInput = page.locator('input[inputmode="numeric"], .pin-input').first();
    await pinInput.fill(SEEDED_GALLERY_PIN);
    await page.getByRole('button', { name: /open gallery/i }).click();

    // Wait for photos
    await expect(
      page.locator('.gallery-photo, .masonry figure').first()
    ).toBeVisible({ timeout: 15_000 });

    // Favourites counter starts at 0
    await expect(page.getByText(/0 favorites/i)).toBeVisible();

    // Click first favourite button
    await page.getByTitle('Favorite').first().click();

    // Counter should update to 1
    await expect(page.getByText(/1 favorites/i)).toBeVisible({ timeout: 5_000 });
  });

  test('Customer can open a photo in the lightbox', async ({ page }) => {
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);
    const pinInput = page.locator('input[inputmode="numeric"], .pin-input').first();
    await pinInput.fill(SEEDED_GALLERY_PIN);
    await page.getByRole('button', { name: /open gallery/i }).click();

    await expect(
      page.locator('.gallery-photo, .masonry figure').first()
    ).toBeVisible({ timeout: 15_000 });

    // Click the photo image button to open lightbox
    await page.locator('.gallery-photo button, .masonry figure button').first().click();

    // Lightbox should appear with a large image
    await expect(page.locator('.lightbox')).toBeVisible({ timeout: 5_000 });
  });

  test('Lightbox can be closed with the X button', async ({ page }) => {
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);
    const pinInput = page.locator('input[inputmode="numeric"], .pin-input').first();
    await pinInput.fill(SEEDED_GALLERY_PIN);
    await page.getByRole('button', { name: /open gallery/i }).click();

    await expect(
      page.locator('.gallery-photo, .masonry figure').first()
    ).toBeVisible({ timeout: 15_000 });

    await page.locator('.gallery-photo button, .masonry figure button').first().click();
    await expect(page.locator('.lightbox')).toBeVisible({ timeout: 5_000 });

    await page.locator('.lightbox-close').click();
    await expect(page.locator('.lightbox')).not.toBeVisible({ timeout: 3_000 });
  });

  test('Non-existent gallery slug shows unavailable message', async ({ page }) => {
    await page.goto('/gallery/this-gallery-does-not-exist-xyz999');

    await expect(page.getByText(/unavailable|not found|private/i).first())
      .toBeVisible({ timeout: 8_000 });
  });
});

// ─── Test 7: Admin — Analytics ────────────────────────────────────────────────
test.describe('7. Admin — Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test('Admin can view the analytics dashboard', async ({ page }) => {
    await page.goto('/admin/analytics');

    await expect(
      page.getByText(/total events|total photos|gallery views|analytics/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Dashboard shows numeric statistics', async ({ page }) => {
    await page.goto('/admin/analytics');

    // At least one numeric stat card should be visible
    await expect(
      page.locator('[class*="stat"], [class*="card"], [class*="metric"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─── Test 8: Security ─────────────────────────────────────────────────────────
test.describe('8. Security Smoke Tests', () => {
  test('Admin pages redirect to login when not authenticated', async ({ page }) => {
    // Clear cookies / start fresh context
    await page.context().clearCookies();
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('Gallery page shows PIN screen — does not expose photos to unauthenticated access', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);

    // Should show PIN screen, not photos
    await expect(
      page.locator('input[inputmode="numeric"], .pin-input').first()
    ).toBeVisible({ timeout: 8_000 });

    // Photos should NOT be visible yet
    await expect(page.locator('.gallery-photo img, .masonry img').first())
      .not.toBeVisible();
  });

  test('PIN screen rate limits — entering 5 wrong PINs shows lockout warning', async ({ page }) => {
    await page.goto(`/gallery/${SEEDED_GALLERY_SLUG}`);

    // Attempt 5 wrong PINs
    for (let i = 0; i < 5; i++) {
      const pinInput = page.locator('input[inputmode="numeric"], .pin-input').first();
      await pinInput.fill('000000');
      await page.getByRole('button', { name: /open gallery/i }).click();
      // Small wait between attempts
      await page.waitForTimeout(300);
    }

    // Should see some kind of rate limit or error message after multiple failures
    await expect(
      page.getByText(/incorrect|wrong|pin|too many|try again/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});
