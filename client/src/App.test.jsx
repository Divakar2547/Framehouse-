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

  it('renders login page on /login route', () => {
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
});
