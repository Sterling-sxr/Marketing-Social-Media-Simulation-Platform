import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomePage from '../../frontend/src/pages/HomePage.jsx';
import { useApp } from '../../frontend/src/context/AppContext';

vi.mock('../../frontend/src/context/AppContext', () => ({
  useApp: vi.fn(),
}));

const mockedUseApp = useApp;

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

const getEmailInput = () => screen.getByLabelText(/email/i, { selector: 'input' });
const getPasswordInput = () => screen.getByLabelText(/password/i, { selector: 'input' });

describe('HomePage landing experience', () => {
  let loginMock;
  let logoutMock;

  beforeEach(() => {
    loginMock = vi.fn().mockResolvedValue({});
    logoutMock = vi.fn().mockResolvedValue({});
    mockedUseApp.mockReturnValue({
      authUser: null,
      login: loginMock,
      logout: logoutMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders hero copy and login form', () => {
    renderHome();
    expect(
      screen.getByText(/Donut campus social simulation platform/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter your university email/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^login$/i })).toBeInTheDocument();
  });

  test('allows toggling password visibility', () => {
    renderHome();
    const passwordInput = getPasswordInput();
    const toggleBtn = screen.getByRole('button', {
      name: /show or hide password/i,
    });
    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('submits credentials and shows success feedback', async () => {
    renderHome();
    fireEvent.change(getEmailInput(), {
      target: { value: 'z1234567@ad.unsw.edu.au' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'MyPass123!' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        'z1234567@ad.unsw.edu.au',
        'MyPass123!'
      );
    });
    expect(await screen.findByText(/Login Success!/i)).toBeInTheDocument();
  });

  test('shows error feedback when login fails', async () => {
    loginMock.mockRejectedValueOnce(new Error('Invalid credentials'));
    renderHome();
    fireEvent.change(getEmailInput(), {
      target: { value: 'z1234567@ad.unsw.edu.au' },
    });
    fireEvent.change(getPasswordInput(), {
      target: { value: 'wrong' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    expect(
      await screen.findByText(/Invalid credentials/i)
    ).toBeInTheDocument();
  });
});
