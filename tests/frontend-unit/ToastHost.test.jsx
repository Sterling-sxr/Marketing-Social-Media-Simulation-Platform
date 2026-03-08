import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ToastHost from '../../frontend/src/components/ToastHost.jsx';

const navigateSpy = vi.fn();
const mockUseApp = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('../../frontend/src/context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

describe('ToastHost', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
    navigateSpy.mockReset();
  });

  test('returns null when there are no toasts', () => {
    mockUseApp.mockReturnValue({
      toasts: [],
      dismissToast: vi.fn(),
      markNotificationsRead: vi.fn(),
    });
    const { container } = render(<ToastHost />);
    expect(container.firstChild).toBeNull();
  });

  test('renders toast and can dismiss it', () => {
    const dismissToast = vi.fn();
    mockUseApp.mockReturnValue({
      toasts: [{ id: '1', title: 'Hello', message: 'World' }],
      dismissToast,
      markNotificationsRead: vi.fn(),
    });

    render(<ToastHost />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(dismissToast).toHaveBeenCalledWith('1');
  });

  test('clicking toast body marks notification as read and navigates', async () => {
    const dismissToast = vi.fn();
    const markNotificationsRead = vi.fn().mockResolvedValue();
    mockUseApp.mockReturnValue({
      toasts: [
        {
          id: '2',
          title: 'New alert',
          message: 'See details',
          link: '/notifications',
          notification_id: 88,
        },
      ],
      dismissToast,
      markNotificationsRead,
    });

    render(<ToastHost />);
    fireEvent.click(screen.getByText('New alert'));

    await waitFor(() => {
      expect(markNotificationsRead).toHaveBeenCalledWith([88]);
      expect(dismissToast).toHaveBeenCalledWith('2');
      expect(navigateSpy).toHaveBeenCalledWith('/notifications');
    });
  });
});
