import { describe, expect, it } from "vitest";
import {
  clientDisplayName,
  clientPersonName,
  formatAddress,
  primaryEmail,
  primaryPhone,
  type EmailContact,
  type PhoneContact,
} from "./types";

// These feed the frozen client_snapshot copied onto sent quotes, jobs and
// invoices, so what they return is what ends up on legal documents.

describe("clientDisplayName", () => {
  it("prefers the company over the person", () => {
    expect(clientDisplayName({ first_name: "Marc", last_name: "Tremblay", company_name: "Gestion Ajax" })).toBe(
      "Gestion Ajax",
    );
  });

  it("falls back to the person, then to a placeholder", () => {
    expect(clientDisplayName({ first_name: "Marc", last_name: "Tremblay", company_name: null })).toBe(
      "Marc Tremblay",
    );
    expect(clientDisplayName({ first_name: "Marc", last_name: null, company_name: null })).toBe("Marc");
    expect(clientDisplayName({ first_name: null, last_name: null, company_name: null })).toBe("Unnamed client");
    expect(clientDisplayName({})).toBe("Unnamed client");
  });

  it("ignores whitespace-only values", () => {
    expect(clientDisplayName({ first_name: "  ", last_name: " ", company_name: "  " })).toBe("Unnamed client");
  });
});

describe("clientPersonName", () => {
  it("returns the person only when shown under a company name", () => {
    expect(clientPersonName({ first_name: "Marc", last_name: "Tremblay", company_name: "Gestion Ajax" })).toBe(
      "Marc Tremblay",
    );
    expect(clientPersonName({ first_name: "Marc", last_name: "Tremblay", company_name: null })).toBeNull();
    expect(clientPersonName({ first_name: null, last_name: null, company_name: "Gestion Ajax" })).toBeNull();
  });
});

describe("primaryEmail / primaryPhone", () => {
  const email = (address: string, primary: boolean): EmailContact => ({
    address,
    type: "main",
    primary,
    receivesQuotes: true,
    receivesInvoices: true,
  });
  const phone = (number: string, primary: boolean): PhoneContact => ({
    number,
    type: "mobile",
    primary,
    smsAllowed: true,
  });

  it("picks the flagged primary over list order", () => {
    expect(primaryEmail({ emails: [email("a@x.com", false), email("b@x.com", true)] })).toBe("b@x.com");
    expect(primaryPhone({ phones: [phone("514-555-0001", false), phone("514-555-0002", true)] })).toBe(
      "514-555-0002",
    );
  });

  it("falls back to the first entry, then to null", () => {
    expect(primaryEmail({ emails: [email("a@x.com", false)] })).toBe("a@x.com");
    expect(primaryEmail({ emails: [] })).toBeNull();
    expect(primaryPhone({ phones: [] })).toBeNull();
  });
});

describe("formatAddress", () => {
  it("joins street, region and postal code with middots", () => {
    expect(
      formatAddress({
        street1: "123 Rue Principale",
        street2: "Suite 4",
        city: "Laval",
        province: "QC",
        postal_code: "H7A 1A1",
      }),
    ).toBe("123 Rue Principale, Suite 4 · Laval, QC · H7A 1A1");
  });

  it("skips missing parts without leaving separators behind", () => {
    expect(formatAddress({ city: "Laval" })).toBe("Laval");
    expect(formatAddress({})).toBe("");
  });
});
