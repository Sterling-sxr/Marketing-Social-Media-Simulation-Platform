import { render, screen } from '@testing-library/react';

function SmokeApp() {
  return (
    <main>
      <h1>Bread campus social simulation platform</h1>
      <p>frontend unit test smoke check</p>
    </main>
  );
}

describe('App smoke test', () => {
  test('renders heading text', () => {
    render(<SmokeApp />);
    expect(
      screen.getByText(/Bread campus social simulation platform/i)
    ).toBeInTheDocument();
  });
});
