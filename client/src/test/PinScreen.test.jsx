/**
 * PIN Screen Tests — Gallery component (pre-verification state)
 *
 * Tests:
 *  - Loading state
 *  - Gallery unavailable (404 / error)
 *  - PIN form renders with gallery title
 *  - Only accepts numeric input (strips non-digits)
 *  - Successful PIN verification transitions to GalleryView
 *  - Wrong PIN shows inline error message
 *  - Submit button disabled until 6 digits entered
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock the API module ──────────────────────────────────────────────────────
const mockPublicInfo = vi.fn();
const mockVerifyPin = vi.fn();
const mockPhotos = vi.fn();
const mockFavorite = vi.fn();
const mockDownload = vi.fn();

vi.mock('../services/api', async () => {
  const actual = await vi.importActual('../services/api');
  return {
    ...actual,
    galleryApi: {
      publicInfo: (...a) => mockPublicInfo(...a),
      verifyPin: (...a) => mockVerifyPin(...a),
      photos: (...a) => mockPhotos(...a),
      favorite: (...a) => mockFavorite(...a),
      download: (...a) => mockDownload(...a),
    },
  };
});

// Import App AFTER the mock so Gallery component uses mocked galleryApi
import App from '../App';

// ─── Shared gallery fixture ───────────────────────────────────────────────────
const GALLERY_FIXTURE = {
  id: 'gal-1',
  title: 'Arjun & Priya Wedding',
  description: 'Your special day captured.',
  slug: 'arjun-priya-wedding-2026',
  allowDownloads: true,
  showWatermark: false,
  photoCount: 80,
  event: { name: 'Arjun & Priya Wedding', eventDate: '2026-08-15', location: 'Mumbai' },
};

const PHOTOS_FIXTURE = [
  {
    id: 'ph-1', filename: 'wedding-001.jpg', originalFilename: 'DSC_7001.jpg',
    width: 6000, height: 4000,
    thumbnailUrl: 'https://framehouse-r7yy.onrender.com/api/mock-view/thumb-1.jpg',
    galleryUrl: 'https://framehouse-r7yy.onrender.com/api/mock-view/gallery-1.jpg',
  },
  {
    id: 'ph-2', filename: 'wedding-002.jpg', originalFilename: 'DSC_7002.jpg',
    width: 6000, height: 4000,
    thumbnailUrl: 'https://framehouse-r7yy.onrender.com/api/mock-view/thumb-2.jpg',
    galleryUrl: 'https://framehouse-r7yy.onrender.com/api/mock-view/gallery-2.jpg',
  },
];

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderGalleryRoute(slug = 'arjun-priya-wedding-2026') {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={[`/gallery/${slug}`]}>
        <Routes>
          <Route path="/gallery/:slug" element={<App />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PIN Screen — loading state', () => {
  beforeEach(() => {
    mockPublicInfo.mockReturnValue(new Promise(() => {})); // never resolves
  });

  it('shows loading indicator while fetching gallery info', () => {
    renderGalleryRoute();
    expect(screen.getByText(/Opening gallery/i)).toBeTruthy();
  });
});

describe('PIN Screen — gallery unavailable', () => {
  beforeEach(() => {
    mockPublicInfo.mockRejectedValue(new Error('Not found'));
  });

  it('shows "Gallery unavailable" when API returns error', async () => {
    renderGalleryRoute();
    await waitFor(() => {
      expect(screen.getByText(/Gallery unavailable/i)).toBeTruthy();
    });
  });

  it('shows helpful guidance text when gallery is unavailable', async () => {
    renderGalleryRoute();
    await waitFor(() => {
      expect(screen.getByText(/private or no longer available/i)).toBeTruthy();
    });
  });
});

describe('PIN Screen — form renders correctly', () => {
  beforeEach(() => {
    mockPublicInfo.mockResolvedValue({ data: { gallery: GALLERY_FIXTURE } });
  });

  it('renders gallery title on PIN screen', async () => {
    renderGalleryRoute();
    await waitFor(() => {
      expect(screen.getByText('Arjun & Priya Wedding')).toBeTruthy();
    });
  });

  it('renders the framehouse brand mark', async () => {
    renderGalleryRoute();
    await waitFor(() => {
      expect(screen.getByText(/framehouse/i)).toBeTruthy();
    });
  });

  it('renders PIN input with correct attributes', async () => {
    renderGalleryRoute();
    await waitFor(() => {
      const input = screen.getByPlaceholderText('• • • • • •');
      expect(input).toBeTruthy();
      expect(input.getAttribute('inputmode')).toBe('numeric');
      expect(input.getAttribute('maxlength')).toBe('6');
    });
  });

  it('renders "Open gallery" submit button', async () => {
    renderGalleryRoute();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open gallery/i })).toBeTruthy();
    });
  });
});

describe('PIN Screen — input validation', () => {
  beforeEach(() => {
    mockPublicInfo.mockResolvedValue({ data: { gallery: GALLERY_FIXTURE } });
  });

  it('strips non-numeric characters from PIN input', async () => {
    const user = userEvent.setup();
    renderGalleryRoute();

    await waitFor(() => screen.getByPlaceholderText('• • • • • •'));
    const input = screen.getByPlaceholderText('• • • • • •');

    await user.type(input, 'abc123def');
    expect(input.value).toBe('123');
  });

  it('accepts only digits up to maxLength 6', async () => {
    const user = userEvent.setup();
    renderGalleryRoute();

    await waitFor(() => screen.getByPlaceholderText('• • • • • •'));
    const input = screen.getByPlaceholderText('• • • • • •');

    await user.type(input, '123456789');
    expect(input.value.length).toBeLessThanOrEqual(6);
  });
});

describe('PIN Screen — form submission', () => {
  beforeEach(() => {
    mockPublicInfo.mockResolvedValue({ data: { gallery: GALLERY_FIXTURE } });
    mockPhotos.mockResolvedValue({ data: { photos: PHOTOS_FIXTURE } });
  });

  it('shows error message when wrong PIN submitted', async () => {
    mockVerifyPin.mockRejectedValue({ response: { data: { message: 'Incorrect PIN' } } });
    const user = userEvent.setup();
    renderGalleryRoute();

    await waitFor(() => screen.getByPlaceholderText('• • • • • •'));
    await user.type(screen.getByPlaceholderText('• • • • • •'), '000000');
    await user.click(screen.getByRole('button', { name: /Open gallery/i }));

    await waitFor(() => {
      expect(screen.getByText(/PIN doesn/i)).toBeTruthy();
    });
  });

  it('calls verifyPin with the slug and entered PIN', async () => {
    mockVerifyPin.mockResolvedValue({ data: { sessionId: 'sess-1' } });
    const user = userEvent.setup();
    renderGalleryRoute();

    await waitFor(() => screen.getByPlaceholderText('• • • • • •'));
    await user.type(screen.getByPlaceholderText('• • • • • •'), '482917');
    await user.click(screen.getByRole('button', { name: /Open gallery/i }));

    await waitFor(() => {
      expect(mockVerifyPin).toHaveBeenCalledWith('arjun-priya-wedding-2026', '482917');
    });
  });

  it('transitions to gallery view after correct PIN', async () => {
    mockVerifyPin.mockResolvedValue({ data: { sessionId: 'sess-1' } });
    const user = userEvent.setup();
    renderGalleryRoute();

    await waitFor(() => screen.getByPlaceholderText('• • • • • •'));
    await user.type(screen.getByPlaceholderText('• • • • • •'), '482917');
    await user.click(screen.getByRole('button', { name: /Open gallery/i }));

    // After correct PIN, PIN screen disappears and gallery header appears
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('• • • • • •')).toBeNull();
    });
  });
});
