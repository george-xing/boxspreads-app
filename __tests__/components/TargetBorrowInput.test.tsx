import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TargetBorrowInput } from "@/components/calculator/TargetBorrowInput";

describe("TargetBorrowInput", () => {
  it("renders formatted value", () => {
    const { getByDisplayValue } = render(
      <TargetBorrowInput value={500_000} onChange={() => {}} />,
    );
    expect(getByDisplayValue("$500,000")).toBeTruthy();
  });

  it("parses typed value and calls onChange", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TargetBorrowInput value={0} onChange={onChange} />,
    );
    const input = getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1,250,000" } });
    expect(onChange).toHaveBeenCalledWith(1_250_000);
  });

  it("ignores non-numeric input", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <TargetBorrowInput value={100_000} onChange={onChange} />,
    );
    fireEvent.change(getByRole("textbox"), { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
