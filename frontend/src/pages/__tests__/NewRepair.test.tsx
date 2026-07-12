import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewRepair from '../NewRepair';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';
import toast from 'react-hot-toast';

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

describe('NewRepair Multi-Step Wizard Page Tests', () => {
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
        return Promise.resolve({ staff: [{ id: 'staff-uuid-1', name: 'Sam Staff', staff_id: 'GK001' }] });
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

  it('should render step 1 and advance to step 2 after inline customer registration', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      customer: { id: 'cust-uuid-789', name: 'Alice Customer', phone: '1234567890' }
    });

    renderComponent();

    // Verify step 1 header
    expect(screen.getByText('Section 1: Customer Coordinate File')).toBeInTheDocument();

    // Switch to "Create New Inline" mode
    const inlineBtn = screen.getByRole('button', { name: /Create New Inline/i });
    fireEvent.click(inlineBtn);

    // Populate registration form
    const nameInput = screen.getByPlaceholderText('e.g. Jane Doe');
    const phoneInput = screen.getByPlaceholderText('e.g. +1999222333');
    const addressInput = screen.getByPlaceholderText('Cupertino, California');

    fireEvent.change(nameInput, { target: { value: 'Alice Customer' } });
    fireEvent.change(phoneInput, { target: { value: '1234567890' } });
    fireEvent.change(addressInput, { target: { value: 'Alice Address' } });

    // Submit step 1
    const continueBtn = screen.getByRole('button', { name: /Continue to Device details/i });
    fireEvent.click(continueBtn);

    // Verify client customer registration is called
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/customers', {
        name: 'Alice Customer',
        phone: '1234567890',
        address: 'Alice Address'
      });
      // Advances to step 2 (Device details)
      expect(screen.getByText('Section 2: Hardware Characteristics')).toBeInTheDocument();
    });
  });

  it('should block progression on step 2 with empty brand and model fields', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      customer: { id: 'cust-uuid-789', name: 'Alice Customer', phone: '1234567890' }
    });

    renderComponent();

    // Advance to step 2 via inline customer creation
    fireEvent.click(screen.getByRole('button', { name: /Create New Inline/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Jane Doe'), { target: { value: 'Alice Customer' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. +1999222333'), { target: { value: '1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Device details/i }));

    await screen.findByText('Section 2: Hardware Characteristics');

    // Try to advance to step 3 with empty fields
    const continueBtn = screen.getByRole('button', { name: /Continue to Financials/i });
    fireEvent.click(continueBtn);

    // Expect validation errors
    expect(await screen.findByText('Brand is required')).toBeInTheDocument();
    expect(await screen.findByText('Model is required')).toBeInTheDocument();
  });

  it('should calculate balance outstanding based on estimate and advance numbers', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      customer: { id: 'cust-uuid-789', name: 'Alice Customer', phone: '1234567890' }
    });

    renderComponent();

    // 1. Advance to step 2
    fireEvent.click(screen.getByRole('button', { name: /Create New Inline/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Jane Doe'), { target: { value: 'Alice Customer' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. +1999222333'), { target: { value: '1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Device details/i }));

    // 2. Populate step 2 details
    await screen.findByText('Section 2: Hardware Characteristics');
    fireEvent.change(screen.getByPlaceholderText('e.g. Apple, Samsung'), { target: { value: 'Google' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. iPhone 15 Pro, Galaxy S24'), { target: { value: 'Pixel 7' } });
    fireEvent.change(screen.getByPlaceholderText('Describe hardware issues in details...'), { target: { value: 'Port cracked' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Financials/i }));

    // 3. Populate financials
    await screen.findByText('Section 3: Financial Calculations');
    const estimateInput = screen.getByPlaceholderText('250.00');
    const advanceInput = screen.getByPlaceholderText('50.00');

    // Fill in values
    fireEvent.change(estimateInput, { target: { value: '300' } });
    fireEvent.change(advanceInput, { target: { value: '80' } });

    // Expect balance to show $220.00 (300 - 80)
    expect(screen.getByText('$220.00')).toBeInTheDocument();
  });

  it('should aggregate and submit all wizard form data correctly on final step', async () => {
    (apiClient.post as any)
      .mockResolvedValueOnce({ customer: { id: 'cust-uuid-789', name: 'Alice Customer', phone: '1234567890' } }) // Step 1 register
      .mockResolvedValueOnce({ repair: { id: 'repair-uuid-999', job_number: 'GK-20260617-001' } }); // Final submit

    renderComponent();

    // Step 1: Customer
    fireEvent.click(screen.getByRole('button', { name: /Create New Inline/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Jane Doe'), { target: { value: 'Alice Customer' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. +1999222333'), { target: { value: '1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Device details/i }));

    // Step 2: Device
    await screen.findByText('Section 2: Hardware Characteristics');
    fireEvent.change(screen.getByPlaceholderText('e.g. Apple, Samsung'), { target: { value: 'Apple' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. iPhone 15 Pro, Galaxy S24'), { target: { value: 'iPhone 13' } });
    fireEvent.change(screen.getByPlaceholderText('Describe hardware issues in details...'), { target: { value: 'Broken battery' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Financials/i }));

    // Step 3: Financials
    await screen.findByText('Section 3: Financial Calculations');
    fireEvent.change(screen.getByPlaceholderText('250.00'), { target: { value: '200' } });
    fireEvent.change(screen.getByPlaceholderText('50.00'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Assignment/i }));

    // Step 4: Assignment
    await screen.findByText('Section 4: Staff Assignment & Delivery');
    fireEvent.click(screen.getByRole('button', { name: /Submit Repair Order/i }));

    // Verify final submit post payload was triggered with correct FormData entries
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledTimes(2);
      
      const lastCallArgs = (apiClient.post as any).mock.calls[1];
      expect(lastCallArgs[0]).toBe('/repairs');
      
      const formData = lastCallArgs[1] as FormData;
      expect(formData.get('customerId')).toBe('cust-uuid-789');
      expect(formData.get('brand')).toBe('Apple');
      expect(formData.get('model')).toBe('iPhone 13');
      expect(formData.get('problem')).toBe('Broken battery');
      expect(formData.get('estimate')).toBe('200');
      expect(formData.get('advance')).toBe('50');
      
      expect(toast.success).toHaveBeenCalledWith('Repair job registered successfully! Job ID: GK-20260617-001');
      expect(mockNavigate).toHaveBeenCalledWith('/repairs/repair-uuid-999');
    });
  });
});
