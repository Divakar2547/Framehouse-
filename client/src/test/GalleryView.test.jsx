/**
 * GalleryView Tests — post-PIN authenticated gallery
 *
 * Tests:
 *  - Photo grid renders thumbnails
 *  - Photo count displayed in header
 *  - Lightbox opens on photo click
 *  - Lightbox closes on close button click
 *  - Favourite button toggles state and calls API
 *  - Download button calls download API and is hidden when allowDownloads=false
 *  - Favourites counter in toolbar increments
 *  - Loading state while photos fetch
 *  - Empty gallery state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── API mocks ────────────────────────────────────────────────────────────────
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

import App from '../App';

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const SLUG = 'arjun-priya-wedding-2026';

const GALLERY = {
  id: 'gal-1',
  title: 'Arjun & Priya Wedding',
  description: 'Your special day.',
  slug: SLUG,
  allowDownloads: true,
  showWatermark: false,
  photoCount: 2,
  event: { name: 'Arjun & Priya Wedding', eventDate: '2026-08-15' },
};

const GALLERY_NO_DL = { ...GALLERY, allowDownloads: false };

const PHOTOS = [
  {
    id: 'ph-1',
    filename: 'wedding-001.jpg',
    originalFilename: 'DSC_7001.jpg',
    width: 6000, height: 4000,
    thumbnailUrl: 'https://render.test/thumb-1.jpg',
    galleryUrl: 'https://render.test/gallery-1.jpg',
  },
  {
    id: 'ph-2',
    filename: 'wedding-002.jpg',
    originalFilename: 'DSC_7002.jpg',
    width: 6000, height: 4000,
    thumbnailUrl: 'https://render.test/thumb-2.jpg',
    galleryUrl: 'https://render.test/gallery-2.jpg',
  },
];

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// Helper: render the gallery route already past PIN verification by stubbing
// both publicInfo and verifyPin, then simulating the PIN entry.
async function renderVerifiedGallery(galleryFixture = GALLERY, photosFixture = PHOTOS) {
  const user = userEvent.setup();
  mockPublicInfo.mockResolvedValue({ data: { gallery: galleryFixture } });
  mockVerifyPin.mockResolvedValue({ data: { sessionId: 'sess-ok' } });
  mockPhotos.mockResolvedValue({ data: { photos: photosFixture } });

  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={[`/gallery/${SLUG}`]}>
        <Routes>
          <Route path="/gallery/:slug" element={<App />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  // Wait for PIN screen, enter PIN, submit
  await waitFor(() => screen.getByPlaceholderText('• • • • • •'));
  await user.type(screen.getByPlaceholderText('• • • • • •'), '482917');
  await user.click(screen.getByRole('button', { name: /Open gallery/i }));

  // Wait for gallery grid to appear
  await waitFor(() => screen.getByText('Arjun & Priya Wedding'));

  return user;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GalleryView — photo grid', () => {
  it('renders one figure per photo', async () => {
    await renderVerifiedGallery();
    const figures = screen.getAllByRole('figure');
    expect(figures.length).toBe(2);
  });

  it('renders an img tag for each photo', async () => {
    await renderVerifiedGallery();
    const images = screen.getAllByRole('img');
    // At least 2 gallery images (lightbox not open yet)
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it('shows photo count in header', async () => {
    await renderVerifiedGallery();
    expect(screen.getByText(/2 photographs/i)).toBeTruthy();
  });

  it('renders brand name in gallery header', async () => {
    await renderVerifiedGallery();
    // Multiple brand elements may exist; at least one present
    expect(screen.getAllByText(/framehouse/i).length).toBeGreaterThan(0);
  });
});

describe('GalleryView — empty gallery', () => {
  it('renders empty grid gracefully with 0 photographs', async () => {
    mockPublicInfo.mockResolvedValue({ data: { gallery: { ...GALLERY, photoCount: 0 } } });
    mockVerifyPin.mockResolvedValue({ data: { sessionId: 'sess-ok' } });
    mockPhotos.mockResolvedValue({ data: { photos: [] } });

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={[`/gallery/${SLUG}`]}>
          <Routes>
            <Route path="/gallery/:slug" element={<App />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => screen.getByPlaceholderText('• • • • • •'));
    await user.type(screen.getByPlaceholderText('• • • • • •'), '482917');
    await user.click(screen.getByRole('button', { name: /Open gallery/i }));

    await waitFor(() => screen.getByText('Arjun & Priya Wedding'));

    // No figures rendered
    expect(screen.queryAllByRole('figure').length).toBe(0);
  });
});

describe('GalleryView — lightbox', () => {
  it('opens lightbox when a photo is clicked', async () => {
    const user = await renderVerifiedGallery();

    const photoButtons = screen.getAllByRole('button').filter(
      b => within(b).queryAllByRole('img').length > 0
    );
    await user.click(photoButtons[0]);

    // Lightbox container should appear
    await waitFor(() => {
      const lightbox = document.querySelector('.lightbox');
      expect(lightbox).toBeTruthy();
    });
  });

  it('closes lightbox when close button is clicked', async () => {
    const user = await renderVerifiedGallery();

    const photoButtons = screen.getAllByRole('button').filter(
      b => within(b).queryAllByRole('img').length > 0
    );
    await user.click(photoButtons[0]);

    await waitFor(() => document.querySelector('.lightbox'));

    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(document.querySelector('.lightbox')).toBeNull();
    });
  });
});

describe('GalleryView — favourites', () => {
  beforeEach(() => {
    mockFavorite.mockResolvedValue({ data: { favorited: true } });
  });

  it('clicking favourite button calls galleryApi.favorite with correct args', async () => {
    const user = await renderVerifiedGallery();

    const favButtons = screen.getAllByTitle('Favorite');
    await user.click(favButtons[0]);

    await waitFor(() => {
      expect(mockFavorite).toHaveBeenCalledWith(SLUG, 'ph-1');
    });
  });

  it('favourites counter increments after toggling a favourite', async () => {
    const user = await renderVerifiedGallery();

    // Initial count is 0
    expect(screen.getByText(/0 favorites/i)).toBeTruthy();

    const favButtons = screen.getAllByTitle('Favorite');
    await user.click(favButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/1 favorites/i)).toBeTruthy();
    });
  });

  it('unfavouriting decrements the counter', async () => {
    // First click = favourite, second = unfavourite
    mockFavorite
      .mockResolvedValueOnce({ data: { favorited: true } })
      .mockResolvedValueOnce({ data: { favorited: false } });

    const user = await renderVerifiedGallery();
    const favButtons = screen.getAllByTitle('Favorite');

    await user.click(favButtons[0]);
    await waitFor(() => screen.getByText(/1 favorites/i));

    await user.click(favButtons[0]);
    await waitFor(() => screen.getByText(/0 favorites/i));
  });
});

describe('GalleryView — downloads', () => {
  it('shows download button when allowDownloads is true', async () => {
    await renderVerifiedGallery(GALLERY);
    const dlButtons = screen.getAllByTitle(/Download high-resolution photograph/i);
    expect(dlButtons.length).toBe(2);
  });

  it('hides download button when allowDownloads is false', async () => {
    mockPublicInfo.mockResolvedValue({ data: { gallery: GALLERY_NO_DL } });
    mockVerifyPin.mockResolvedValue({ data: { sessionId: 'sess-ok' } });
    mockPhotos.mockResolvedValue({ data: { photos: PHOTOS } });

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={[`/gallery/${SLUG}`]}>
          <Routes>
            <Route path="/gallery/:slug" element={<App />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => screen.getByPlaceholderText('• • • • • •'));
    await user.type(screen.getByPlaceholderText('• • • • • •'), '482917');
    await user.click(screen.getByRole('button', { name: /Open gallery/i }));

    await waitFor(() => screen.getByText('Arjun & Priya Wedding'));

    expect(screen.queryByTitle(/Download high-resolution photograph/i)).toBeNull();
  });

  it('calls galleryApi.download with correct slug and photoId', async () => {
    const mockUrl = 'https://s3.amazonaws.com/signed-url?token=test';
    mockDownload.mockResolvedValue({ data: { signedUrl: mockUrl } });

    // Mock fetch so the download attempt doesn't fail in jsdom
    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
    });
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
    global.URL.revokeObjectURL = vi.fn();

    const user = await renderVerifiedGallery();
    const dlButtons = screen.getAllByTitle(/Download high-resolution photograph/i);
    await user.click(dlButtons[0]);

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith(SLUG, 'ph-1');
    });
  });
});
