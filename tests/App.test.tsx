import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../src/App";

describe("App", () => {
  it("renders either the scraper prompt or the tier board", () => {
    render(<App />);
    expect(screen.getByText("从夯到拉")).toBeInTheDocument();
  });
});
