Frontend Unit Tests (Vitest + RTL)

This project imports components from ../../frontend/src without modifying the real app's package.json.

Setup
- cd in tests/frontend-unit folder
- npm install
- npm test (headless) or npm run test:ui (watch/UI)

What's covered (6 files / 21 assertions)
- App.test.jsx: HomePage login view (hero copy, password toggle, login pass/fail flows)
- AppContext.test.jsx: AppProvider helpers (createEmptyProfileData, login/logout, pushToast/dismissToast, toggleInterest, provider guard)
- ToastHost.test.jsx: toast rendering, dismiss button, notification navigation
- Feedback.test.jsx: success/error/devCode rendering
- CircleImage.test.jsx: custom/fallback alt behavior
- DigitInput.test.jsx: digit-only inputs with auto-focus, Backspace navigation, Enter submit

Key assertions
- Login form shows hero text, toggles password visibility, and invokes mocked login
- Success adds "Login Success!", failure renders "Invalid credentials"
- pushToast returns ids, dismissToast clears list, logout resets notifications/courses
- Toast click marks notifications read, dismisses toast, and triggers navigate
- Feedback applies expected styling for error/success/devCode states
- CircleImage wraps images in rounded container with fallback alt text
- DigitInput advances to next field, backs up on Backspace, and fires on Enter

Notes
- Tests stub fetch, WebSocket, and useNavigate where needed
- Vitest config enables jsdom + React classic runtime; React Router future warnings can be ignored
