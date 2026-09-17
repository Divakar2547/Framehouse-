import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import App from './App';

const mockEventGet = vi.fn();
const mockEventUpdate = vi.fn();
const mockEventPhotos = vi.fn();
const mockAuthMe = vi.fn();

vi.mock('./services/api', async () => {
  const actual = await vi.importActual('./services/api');
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      me: (...args) => mockAuthMe(...args),
    },
    eventApi: {
      ...actual.eventApi,
      get: (...args) => mockEventGet(...args),
      update: (...args) => mockEventUpdate(...args),
      photos: (...args) => mockEventPhotos(...args),
    },
  };
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('Client Frontend Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMe.mockResolvedValue({ data: { user: { id: 'admin-1', name: 'Ava', email: 'ava@example.com', role: 'ADMIN' } } });
    mockEventGet.mockResolvedValue({
      data: {
        event: {
          id: 'evt-1',
          name: 'Spring Wedding',
          location: 'Mumbai',
          eventDate: '2026-02-14',
          description: 'A wedding gallery',
          status: 'UPCOMING',
          members: [],
          _count: { photos: 0 },
        },
      },
    });
    mockEventPhotos.mockResolvedValue({ data: { photos: [] } });
    mockEventUpdate.mockResolvedValue({
      data: { event: { id: 'evt-1', status: 'ACTIVE' } },
    });
  });

  it('renders login page on /login route and toggles password visibility', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Good to see you again/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeDefined();

    const passwordInput = screen.getByLabelText(/^Password$/i);
    expect(passwordInput.getAttribute('type')).toBe('password');

    const toggleButton = screen.getByRole('button', { name: /Show password/i });
    await user.click(toggleButton);
    expect(passwordInput.getAttribute('type')).toBe('text');

    const hideButton = screen.getByRole('button', { name: /Hide password/i });
    await user.click(hideButton);
    expect(passwordInput.getAttribute('type')).toBe('password');
  });

  it('allows admins to edit the event status from upcoming to active', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin/events/evt-1']}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: /Spring Wedding/i })).toBeDefined());

    const statusSelect = screen.getByLabelText(/event status/i);
    await user.selectOptions(statusSelect, 'ACTIVE');

    await waitFor(() => expect(mockEventUpdate).toHaveBeenCalledWith('evt-1', { status: 'ACTIVE' }));
  });

  it('renders pagination controls and handles page navigation and search reset', async () => {
    const user = userEvent.setup();

    mockEventPhotos.mockResolvedValue({
      data: {
        photos: [
          { id: 'p1', filename: 'photo1.jpg', originalFilename: 'photo1.jpg', status: 'READY', width: 800, height: 600 },
        ],
      },
      pagination: {
        page: 1,
        limit: 24,
        total: 50,
        totalPages: 3,
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin/events/evt-1']}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText(/Page 1 of 3/i)).toBeDefined());

    const prevButton = screen.getByRole('button', { name: /Previous page/i });
    const nextButton = screen.getByRole('button', { name: /Next page/i });

    // Previous should be disabled on page 1
    expect(prevButton.hasAttribute('disabled')).toBe(true);
    expect(nextButton.hasAttribute('disabled')).toBe(false);

    // Click Next
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockEventPhotos).toHaveBeenCalledWith('evt-1', expect.objectContaining({ page: 2 }));
    });

    // When searching, page resets to 1
    const searchInput = screen.getByPlaceholderText(/Search photo filename/i);
    await user.type(searchInput, 'flower');

    await waitFor(() => {
      expect(mockEventPhotos).toHaveBeenCalledWith('evt-1', expect.objectContaining({ page: 1, search: 'flower' }));
    });
  });
});
