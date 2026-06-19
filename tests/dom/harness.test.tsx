import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Smoke test proving the component-test harness works end to end:
// JSX/TSX transform (plugin-react), jsdom environment, Testing Library
// rendering, and jest-dom matchers.
function Hello({ name }: { name: string }) {
  return <p>Hello {name}</p>;
}

describe("component test harness", () => {
  it("renders a component into jsdom and asserts on the DOM", () => {
    render(<Hello name="world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
