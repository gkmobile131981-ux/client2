import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import Login from '../Login';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock Auth Context
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

describe('Login Page Component Tests', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      login: mockLogin
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
  };

  it('should render the login form elements correctly', () => {
    renderComponent();
    
    expect(screen.getByText('GK Repair System')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@gkrepair.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log In/i })).toBeInTheDocument();
  });

  it('should display validation error message if the email is empty or invalid', async () => {
    renderComponent();
    
    const submitBtn = screen.getByRole('button', { name: /Log In/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
  });

  it('should display validation error if password is less than 6 characters', async () => {
    renderComponent();

    const emailInput = screen.getByPlaceholderText('you@gkrepair.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Log In/i });

    await userEvent.type(emailInput, 'test@gkrepair.com');
    await userEvent.type(passwordInput, '123');
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Password must be at least 6 characters')).toBeInTheDocument();
  });

  it('should invoke login API and redirect to dashboard upon successful authentication', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderComponent();

    const emailInput = screen.getByPlaceholderText('you@gkrepair.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Log In/i });

    await userEvent.type(emailInput, 'owner@gkrepair.com');
    await userEvent.type(passwordInput, 'ownerpassword123');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('owner@gkrepair.com', 'ownerpassword123');
      expect(toast.success).toHaveBeenCalledWith('Logged in successfully!');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should show an error toast if authentication fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    renderComponent();

    const emailInput = screen.getByPlaceholderText('you@gkrepair.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /Log In/i });

    await userEvent.type(emailInput, 'owner@gkrepair.com');
    await userEvent.type(passwordInput, 'wrongpassword');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('owner@gkrepair.com', 'wrongpassword');
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
    });
  });
});
