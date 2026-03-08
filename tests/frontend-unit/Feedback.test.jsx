import { render, screen } from "@testing-library/react";
import Feedback from "../../frontend/src/pages/components/Feedback.jsx";

describe("Feedback component", () => {
  test("renders error state", () => {
    render(<Feedback error="Oops" />);
    const wrapper = screen.getByText("Oops").closest("div");
    expect(wrapper).toHaveClass("bg-red-50");
  });

  test("renders success state without exposing dev code", () => {
    render(<Feedback message="All good" devCode="1234" />);
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(screen.queryByText(/DEBUG Code:/)).not.toBeInTheDocument();
  });

  test("renders null when no props provided", () => {
    const { container } = render(<Feedback />);
    expect(container.firstChild).toBeNull();
  });
});
