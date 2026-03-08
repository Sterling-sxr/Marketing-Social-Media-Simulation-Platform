import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DigitInput from '../../frontend/src/pages/components/DigitInput.jsx';

describe('DigitInput', () => {
  const setup = (values = ['', '', '', '']) => {
    const handleChange = vi.fn();
    const handleSubmit = vi.fn();
    render(
      <DigitInput digits={values} onChange={handleChange} onSubmit={handleSubmit} />
    );
    return {
      inputs: screen.getAllByRole('textbox'),
      handleChange,
      handleSubmit,
    };
  };

  test('auto-focuses the first input and advances on input', async () => {
    const { inputs, handleChange } = setup();
    await waitFor(() => expect(inputs[0]).toHaveFocus());
    fireEvent.change(inputs[0], { target: { value: '17' } });
    expect(handleChange).toHaveBeenCalledWith(0, '7');
    expect(inputs[1]).toHaveFocus();
  });

  test('backspace on empty cell focuses previous input', () => {
    const { inputs } = setup(['1', '', '', '']);
    inputs[1].focus();
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    expect(inputs[0]).toHaveFocus();
  });

  test('pressing enter submits the digits', () => {
    const { inputs, handleSubmit } = setup(['1', '2', '3', '4']);
    fireEvent.keyDown(inputs[3], { key: 'Enter' });
    expect(handleSubmit).toHaveBeenCalled();
  });
});
