import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewRepair from '../NewRepair';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';

// Mock API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock Auth context
vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn()
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: undefined })
  };
});

describe('NewRepair Page Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    (useAuth as any).mockReturnValue({
      user: { id: 'owner-uuid-123', name: 'John Owner' },
      role: 'owner'
    });

    // Default mock APIs
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes('/auth/staff')) {
        return Promise.resolve({ staff: [] });
      }
      if (url.includes('/customers')) {
        return Promise.resolve({ customers: [] });
      }
      return Promise.resolve({});
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NewRepair />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should render the NewRepair form correctly', () => {
    renderComponent();
    expect(screen.getByText('Add New Customer Details')).toBeInTheDocument();
    expect(screen.getByText('Order Status')).toBeInTheDocument();
    expect(screen.getByText('Register New Customer')).toBeInTheDocument();
  });
});
