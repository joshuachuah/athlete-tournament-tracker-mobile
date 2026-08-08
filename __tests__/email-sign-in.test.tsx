import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { EmailSignIn } from "@/components/auth/email-sign-in";

const mockRequestEmailCode = jest.fn();
const mockVerifyEmailCode = jest.fn();

jest.mock("@/context/auth", () => ({
  useAuth: () => ({
    requestEmailCode: mockRequestEmailCode,
    verifyEmailCode: mockVerifyEmailCode,
  }),
}));

function renderEmailSignIn() {
  return render(
    <EmailSignIn
      disabled={false}
      onBusyChange={jest.fn()}
      submitting={false}
    />,
  );
}

describe("EmailSignIn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestEmailCode.mockResolvedValue(true);
    mockVerifyEmailCode.mockResolvedValue(true);
  });

  it("requests and verifies a passwordless email code", async () => {
    const screen = renderEmailSignIn();

    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "athlete@example.com",
    );
    fireEvent.press(screen.getByText("Continue with email"));

    await waitFor(() => {
      expect(screen.getByText("Verification code")).toBeTruthy();
    });
    expect(mockRequestEmailCode).toHaveBeenCalledWith("athlete@example.com");

    fireEvent.changeText(
      screen.getByLabelText("Six-digit email code"),
      "123456",
    );
    fireEvent.press(screen.getByText("Verify code"));

    await waitFor(() => {
      expect(mockVerifyEmailCode).toHaveBeenCalledWith(
        "athlete@example.com",
        "123456",
      );
    });
  });

  it("does not submit an empty email or incomplete code from the keyboard", async () => {
    const screen = renderEmailSignIn();

    fireEvent(screen.getByLabelText("Email address"), "submitEditing");
    expect(mockRequestEmailCode).not.toHaveBeenCalled();

    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "athlete@example.com",
    );
    fireEvent.press(screen.getByText("Continue with email"));

    await waitFor(() => {
      expect(screen.getByText("Verification code")).toBeTruthy();
    });

    mockVerifyEmailCode.mockClear();
    fireEvent.changeText(screen.getByLabelText("Six-digit email code"), "123");
    fireEvent(screen.getByLabelText("Six-digit email code"), "submitEditing");

    expect(mockVerifyEmailCode).not.toHaveBeenCalled();
  });

  it("keeps the current code available when a resend is rejected", async () => {
    mockRequestEmailCode
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const screen = renderEmailSignIn();

    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "athlete@example.com",
    );
    fireEvent.press(screen.getByText("Continue with email"));

    await waitFor(() => {
      expect(screen.getByText("Verification code")).toBeTruthy();
    });
    fireEvent.changeText(
      screen.getByLabelText("Six-digit email code"),
      "123456",
    );
    fireEvent.press(screen.getByText("Resend code"));

    await waitFor(() => {
      expect(mockRequestEmailCode).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText("Verification code")).toBeTruthy();
    expect(screen.getByDisplayValue("123456")).toBeTruthy();
  });

  it("returns to email entry only when the athlete chooses change email", async () => {
    const screen = renderEmailSignIn();

    fireEvent.changeText(
      screen.getByLabelText("Email address"),
      "athlete@example.com",
    );
    fireEvent.press(screen.getByText("Continue with email"));

    await waitFor(() => {
      expect(screen.getByText("Change email")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Change email"));

    expect(screen.getByLabelText("Email address")).toBeTruthy();
  });
});
