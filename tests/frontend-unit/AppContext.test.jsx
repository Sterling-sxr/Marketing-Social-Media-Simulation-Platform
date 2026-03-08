import { act, render } from '@testing-library/react';
import { AppProvider, useApp, createEmptyProfileData } from '../../frontend/src/context/AppContext.jsx';
import { postJson } from '../../frontend/src/lib/api';

vi.mock('../../frontend/src/lib/api', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
}));

function renderWithProvider() {
  let ctx;
  function Consumer() {
    ctx = useApp();
    return null;
  }
  render(
    <AppProvider>
      <Consumer />
    </AppProvider>
  );
  return () => ctx;
}

describe('AppContext helpers', () => {
  test('createEmptyProfileData returns default fields', () => {
    const data = createEmptyProfileData();
    expect(data).toMatchObject({
      gender: '',
      city: '',
      interests: [],
      social_value: 5,
    });
  });

  test('useApp throws outside provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function LoneConsumer() {
      useApp();
      return null;
    }
    expect(() => render(<LoneConsumer />)).toThrow(/within AppProvider/);
    errorSpy.mockRestore();
  });
});

describe('AppContext behaviours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('login stores user and returns needsProfile flag', async () => {
    postJson.mockResolvedValueOnce({
      user: { id: 42, username: 'demo' },
      needs_profile: true,
    });
    const getCtx = renderWithProvider();

    await act(async () => {
      const result = await getCtx().login('user@example.com', 'secret');
      expect(result).toEqual({ needsProfile: true });
    });

    expect(getCtx().authUser).toMatchObject({ id: 42, username: 'demo' });
  });

  test('logout clears auth state and flows', async () => {
    postJson
      .mockResolvedValueOnce({ user: { id: 1 }, needs_profile: false })
      .mockResolvedValueOnce({}); // logout
    const getCtx = renderWithProvider();

    await act(async () => {
      await getCtx().login('user@example.com', 'secret');
    });
    expect(getCtx().authUser).not.toBeNull();

    await act(async () => {
      await getCtx().logout();
    });

    expect(getCtx().authUser).toBeNull();
    expect(getCtx().notifications.unread).toBe(0);
  });

  test('pushToast returns id and dismissToast removes item', () => {
    vi.useFakeTimers();
    const getCtx = renderWithProvider();
    let id;
    act(() => {
      id = getCtx().pushToast({ title: 'Hello', message: 'World' });
    });
    expect(typeof id).toBe('string');
    expect(getCtx().toasts.length).toBe(1);

    act(() => {
      getCtx().dismissToast(id);
    });
    expect(getCtx().toasts.length).toBe(0);
    vi.useRealTimers();
  });

  test('toggleInterest adds and removes entries synchronously', () => {
    const getCtx = renderWithProvider();

    act(() => {
      getCtx().toggleInterest('music');
    });
    expect(getCtx().profileData.interests).toContain('music');

    act(() => {
      getCtx().toggleInterest('music');
    });
    expect(getCtx().profileData.interests).not.toContain('music');
  });
});
