import { useRef, useEffect } from "react";

export default function DigitInput({ digits, onChange, onSubmit }) {
  const refs = useRef([]);

  useEffect(() => {
    if (refs.current[0]) {
      refs.current[0].focus();
    }
  }, []);

  const handleChange = (index, event) => {
    const value = event.target.value.replace(/\D/g, "").slice(-1);
    onChange(index, value);
    if (value && refs.current[index + 1]) {
      refs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && refs.current[index - 1]) {
      refs.current[index - 1].focus();
    }
    if (event.key === "Enter") {
      onSubmit();
    }
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => (refs.current[index] = node)}
          className="field-input h-14 text-center text-2xl font-semibold"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
        />
      ))}
    </div>
  );
}
