import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContactFormCopy } from "../../domain/contact-form";
import { buildContactFormFields } from "../../domain/contact-form";
import { Form } from "./form";

const REQUIRED = "This field is required.";
const INVALID_EMAIL = "Invalid email address.";

/** English fixture copy; the strings the assertions look for. */
const copy: ContactFormCopy = {
  labels: {
    name: "Name",
    email: "Email",
    phone: "Phone (optional)",
    message: "Message",
  },
  placeholders: {
    message: "What do you need?",
  },
  submit: "Send message",
  sending: "Sending…",
  success: "Thanks! Your message is on its way.",
  errorFallback: "Something went wrong.",
  verificationFailed: "We couldn't verify your submission. Please try again.",
  validation: {
    required: REQUIRED,
    email: INVALID_EMAIL,
    min: "{n} characters minimum.",
    max: "{n} characters maximum.",
    words: "Please write a complete message.",
  },
};

const contactFormFields = buildContactFormFields(copy);

function renderForm() {
  render(<Form fields={contactFormFields} endpoint="/api/contact" />);

  return {
    name: screen.getByLabelText("Name"),
    email: screen.getByLabelText("Email"),
    message: screen.getByLabelText("Message"),
    form: document.querySelector("form.form") as HTMLFormElement,
  };
}

describe("Form validation flow (reward early, punish late)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows no errors before the user interacts", () => {
    renderForm();

    expect(screen.queryByText(REQUIRED)).not.toBeInTheDocument();
  });

  it("stays silent when fields are focused and left empty", async () => {
    const { name, email, message } = renderForm();

    for (const field of [name, email, message]) {
      fireEvent.focus(field);
      fireEvent.blur(field);
    }

    await waitFor(() => {
      expect(screen.queryByText(REQUIRED)).not.toBeInTheDocument();
    });
  });

  it("stays silent while an invalid value is being typed", async () => {
    const { email } = renderForm();

    fireEvent.input(email, { target: { value: "not-an-email" } });

    await waitFor(() => {
      expect(screen.queryByText(INVALID_EMAIL)).not.toBeInTheDocument();
    });
  });

  it("shows the error when leaving a field with an invalid value", async () => {
    const { email } = renderForm();

    fireEvent.input(email, { target: { value: "not-an-email" } });
    fireEvent.blur(email);

    await waitFor(() => {
      expect(screen.getByText(INVALID_EMAIL)).toBeInTheDocument();
    });
  });

  it("clears the error on the keystroke that fixes it, without another blur", async () => {
    const { email } = renderForm();

    fireEvent.input(email, { target: { value: "not-an-email" } });
    fireEvent.blur(email);
    await waitFor(() => {
      expect(screen.getByText(INVALID_EMAIL)).toBeInTheDocument();
    });

    fireEvent.input(email, { target: { value: "stephen@example.com" } });

    await waitFor(() => {
      expect(screen.queryByText(INVALID_EMAIL)).not.toBeInTheDocument();
    });
  });

  it("shows every error on an empty submit and sends nothing", async () => {
    const { form } = renderForm();

    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getAllByText(REQUIRED)).toHaveLength(3);
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("clears a field's error live after a failed submit while others remain", async () => {
    const { form, name } = renderForm();

    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getAllByText(REQUIRED)).toHaveLength(3);
    });

    fireEvent.input(name, { target: { value: "Stephen" } });

    await waitFor(() => {
      expect(screen.getAllByText(REQUIRED)).toHaveLength(2);
    });
  });

  it("sends the form when everything is valid", async () => {
    const { form, name, email, message } = renderForm();

    fireEvent.input(name, { target: { value: "Stephen" } });
    fireEvent.input(email, { target: { value: "stephen@example.com" } });
    fireEvent.input(message, {
      target: { value: "A message long enough to pass validation." },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText("Thanks! Your submission was sent."),
      ).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/contact",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("Submit button variant", () => {
  it("renders the primary treatment by default", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Send" })).toHaveClass(
      "button-primary",
    );
  });

  it("applies the variant passed as submitVariant", () => {
    render(
      <Form
        fields={contactFormFields}
        endpoint="/api/contact"
        submitVariant="inverted"
      />,
    );

    expect(screen.getByRole("button", { name: "Send" })).toHaveClass(
      "button-inverted",
    );
  });
});
