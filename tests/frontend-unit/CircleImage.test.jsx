import { render, screen } from '@testing-library/react';
import CircleImage from '../../frontend/src/pages/components/CircleImage.jsx';

describe('CircleImage', () => {
  test('renders provided src and alt', () => {
    render(<CircleImage src="/logo.jpg" alt="logo" className="h-10 w-10" />);
    const img = screen.getByAltText('logo');
    expect(img).toHaveAttribute('src', '/logo.jpg');
    expect(img.closest('div')).toHaveClass('rounded-full');
    expect(img.closest('div')).toHaveClass('h-10 w-10', { exact: false });
  });

  test('fallback alt text is used when missing', () => {
    render(<CircleImage src="/fallback.png" />);
    expect(screen.getByAltText(/circle image/i)).toBeInTheDocument();
  });
});
