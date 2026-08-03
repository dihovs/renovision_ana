import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PhoneContact } from "./types";

/**
 * The sweep is the only thing in this repository that can cause a phone call to
 * ring in somebody's kitchen without a human having pressed anything, so the
 * tests are weighted accordingly: most of them are about calls that must NOT
 * happen. The one that must is a single case.
 *
 * `callTasks` is mocked only for its two writes — the Toronto wall-clock helpers
 * and the calling window are the real ones, because the whole point of
 * `confirmNotBefore` is which side of nine in the morning it lands on, and a
 * stubbed clock would prove nothing about that.
 */

vi.mock("./jobs", () => ({ listVisitsBetween: vi.fn() }));

vi.mock("./callTasks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./callTasks")>()),
  queueCallTask: vi.fn(async () => ({ ok: true, task: { id: "task-1" } })),
  cancelCallTasksForVisit: vi.fn(async () => ({ ok: true, changed: 0 })),
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  db: vi.fn(() => null),
}));

const { listVisitsBetween } = await import("./jobs");
const { queueCallTask, cancelCallTasksForVisit } = await import("./callTasks");
const { db } = await import("./db");
const {
  CONFIRM_LEAD_MS,
  MIN_NOTICE_MS,
  SWEEP_HORIZON_MS,
  civilisedNotBefore,
  confirmNotBefore,
  dialableNumber,
  isCallTaskKind,
  onVisitCancelled,
  onVisitRescheduled,
  queueDictatedCall,
  spokenWhen,
  sweepUpcomingVisits,
  toE164,
} = await import("./callScheduler");

// ---------------------------------------------------------------------------
// A Supabase stand-in that understands the four calls this module makes
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>, failing = false) {
  return {
    from(name: string) {
      let rows = [...(tables[name] ?? [])];
      const error = failing ? { code: "42501", message: "permission denied" } : null;
      const api = {
        select: () => api,
        in: (column: string, values: unknown[]) => {
          rows = rows.filter((row) => values.includes(row[column]));
          return api;
        },
        eq: (column: string, value: unknown) => {
          rows = rows.filter((row) => row[column] === value);
          return api;
        },
        maybeSingle: async () => ({ data: error ? null : (rows[0] ?? null), error }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: error ? null : rows, error }),
      };
      return api;
    },
  };
}

function useDb(tables: Record<string, Row[]>, failing = false) {
  vi.mocked(db).mockReturnValue(fakeDb(tables, failing) as never);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Monday 3 August 2026, 14:00 in Montreal (EDT, UTC-4). */
const NOW = new Date("2026-08-03T18:00:00.000Z");

const PHONES: PhoneContact[] = [
  { number: "(450) 555-0123", type: "mobile", primary: true, smsAllowed: true },
];

function visit(overrides: Record<string, unknown> = {}) {
  return {
    id: "visit-1",
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    job_id: "job-1",
    title: "Salle de bain",
    // Tuesday 4 August, 09:00 Montreal — nineteen hours out.
    starts_at: "2026-08-04T13:00:00.000Z",
    ends_at: null,
    all_day: false,
    completed_at: null,
    notes: null,
    job_number: 41,
    job_title: "Salle de bain",
    client_name: "Marie Tremblay",
    address: "12 rue Principale, Laval",
    ...overrides,
  };
}

function jobsTable(overrides: { job?: Row; client?: Row | null } = {}) {
  const client =
    overrides.client === null
      ? null
      : {
          id: "client-1",
          first_name: "Marie",
          last_name: "Tremblay",
          company_name: null,
          phones: PHONES,
          do_not_call: false,
          ...overrides.client,
        };
  return {
    jobs: [{ id: "job-1", status: "scheduled", archived_at: null, clients: client, ...overrides.job }],
  };
}

beforeEach(() => {
  vi.mocked(listVisitsBetween).mockResolvedValue([]);
  vi.mocked(queueCallTask).mockResolvedValue({ ok: true, task: { id: "task-1" } } as never);
  vi.mocked(cancelCallTasksForVisit).mockResolvedValue({ ok: true, changed: 0 });
  useDb(jobsTable());
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe("toE164 — the only door a number gets in through", () => {
  it("accepts the ways a Quebec number is actually typed into the CRM", () => {
    expect(toE164("(450) 555-0123")).toBe("+14505550123");
    expect(toE164("450-555-0123")).toBe("+14505550123");
    expect(toE164("1 450 555 0123")).toBe("+14505550123");
    expect(toE164("+1 (450) 555-0123")).toBe("+14505550123");
    expect(toE164("  4505550123  ")).toBe("+14505550123");
  });

  it("keeps a number that is already international", () => {
    expect(toE164("+33 1 42 68 53 00")).toBe("+33142685300");
  });

  it("refuses anything it cannot verify rather than guessing", () => {
    expect(toE164(null)).toBeNull();
    expect(toE164("")).toBeNull();
    expect(toE164("   ")).toBeNull();
    expect(toE164("poste 4")).toBeNull();
    expect(toE164("555-0123")).toBeNull(); // no area code
    expect(toE164("450555012")).toBeNull(); // nine digits
    expect(toE164("appeler le soir")).toBeNull();
  });

  it("refuses a +1 number whose area code or exchange cannot exist", () => {
    // A CRM typo, not a number. The generic E.164 shape would let both through.
    expect(toE164("+10555550123")).toBeNull();
    expect(toE164("+11555550123")).toBeNull();
    expect(toE164("+14500550123")).toBeNull();
  });

  it("refuses a number with an extension — nobody can dial a switchboard", () => {
    expect(toE164("450-555-0123 ext 22")).toBeNull();
    expect(toE164("450-555-0123 x2")).toBeNull();
    expect(toE164("450-555-0123 poste 2")).toBeNull();
  });
});

describe("dialableNumber", () => {
  it("prefers the primary, then falls back down the list", () => {
    expect(
      dialableNumber([
        { number: "not a number", type: "home", primary: false, smsAllowed: false },
        { number: "514-555-0199", type: "mobile", primary: true, smsAllowed: false },
      ]),
    ).toBe("+15145550199");

    expect(
      dialableNumber([
        { number: "not a number", type: "home", primary: true, smsAllowed: false },
        { number: "514-555-0199", type: "mobile", primary: false, smsAllowed: false },
      ]),
    ).toBe("+15145550199");
  });

  it("never dials a fax line, even when it is the only number on file", () => {
    expect(
      dialableNumber([{ number: "450-555-0123", type: "fax", primary: true, smsAllowed: false }]),
    ).toBeNull();
  });

  it("returns null for an empty or unusable record", () => {
    expect(dialableNumber(null)).toBeNull();
    expect(dialableNumber([])).toBeNull();
  });
});

describe("spokenWhen — the payload has to be readable aloud", () => {
  it("never hands the script a timestamp", () => {
    const said = spokenWhen("2026-08-04T13:00:00.000Z", "fr");
    expect(said).not.toMatch(/\d{2}:\d{2}/);
    expect(said).not.toContain("2026-08-04");
  });

  it("says the date and the hour in French", () => {
    expect(spokenWhen("2026-08-04T13:00:00.000Z", "fr")).toBe(
      "le mardi 4 août à neuf heures du matin",
    );
    expect(spokenWhen("2026-08-04T17:30:00.000Z", "fr")).toBe(
      "le mardi 4 août à une heure trente de l'après-midi",
    );
    // "1er", never "1".
    expect(spokenWhen("2026-09-01T14:00:00.000Z", "fr")).toContain("le mardi 1er septembre");
  });

  it("says the date and the hour in English", () => {
    expect(spokenWhen("2026-08-04T13:00:00.000Z", "en")).toBe(
      "Tuesday, August 4th at nine in the morning",
    );
    expect(spokenWhen("2026-08-04T22:45:00.000Z", "en")).toBe(
      "Tuesday, August 4th at six forty-five in the evening",
    );
  });

  it("says midday and midnight the way a person does", () => {
    expect(spokenWhen("2026-08-04T16:00:00.000Z", "fr")).toContain("à midi");
    expect(spokenWhen("2026-08-04T16:00:00.000Z", "en")).toContain("at noon");
    expect(spokenWhen("2026-08-04T04:00:00.000Z", "fr")).toContain("à minuit");
  });

  it("gives back an empty string rather than 'Invalid Date'", () => {
    expect(spokenWhen("not a date", "fr")).toBe("");
  });
});

describe("confirmNotBefore — nothing is queued for the middle of the night", () => {
  it("aims at twenty-four hours before the visit when that is a decent hour", () => {
    // Visit Wednesday 09:00 local; twenty-four hours earlier is Tuesday 09:00.
    const startsAt = new Date("2026-08-05T13:00:00.000Z");
    expect(confirmNotBefore(NOW, startsAt).toISOString()).toBe("2026-08-04T13:00:00.000Z");
  });

  it("pushes a nocturnal slot forward to the morning", () => {
    // Visit Wednesday 07:00 local; T-24h is Tuesday 07:00, which is before the
    // window opens. It must wait for nine, not go out at seven.
    const startsAt = new Date("2026-08-05T11:00:00.000Z");
    const notBefore = confirmNotBefore(NOW, startsAt);
    expect(notBefore.toISOString()).toBe("2026-08-04T13:00:00.000Z");
    expect(notBefore.getTime()).toBeGreaterThan(startsAt.getTime() - CONFIRM_LEAD_MS);
  });

  it("pushes an after-hours slot to the next morning, not to midnight", () => {
    // Visit Thursday 03:00 local — T-24h is Wednesday 03:00, still the small
    // hours, so it lands on Wednesday morning rather than that night.
    const startsAt = new Date("2026-08-06T07:00:00.000Z");
    const notBefore = confirmNotBefore(NOW, startsAt);
    expect(notBefore.toISOString()).toBe("2026-08-05T13:00:00.000Z");
  });

  it("never lands after the crew does", () => {
    // A Sunday visit: the window is shut all day, so the courtesy push would
    // carry the call past the appointment. It is clamped back instead.
    const startsAt = new Date("2026-08-09T14:00:00.000Z"); // Sunday 10:00 local
    const notBefore = confirmNotBefore(NOW, startsAt);
    expect(notBefore.getTime()).toBeLessThanOrEqual(startsAt.getTime() - MIN_NOTICE_MS);
  });

  it("never moves a slot earlier than the moment it was computed", () => {
    const startsAt = new Date(NOW.getTime() + 4 * 3_600_000);
    expect(confirmNotBefore(NOW, startsAt).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });

  it("is forward-only for an instant already inside the window", () => {
    expect(civilisedNotBefore(NOW).toISOString()).toBe(NOW.toISOString());
  });
});

describe("sweepUpcomingVisits", () => {
  it("asks for exactly the horizon and nothing wider", async () => {
    await sweepUpcomingVisits(NOW);
    expect(listVisitsBetween).toHaveBeenCalledWith(
      NOW.toISOString(),
      new Date(NOW.getTime() + SWEEP_HORIZON_MS).toISOString(),
    );
  });

  it("queues one confirmation, with the time already in words", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([visit()] as never);

    const report = await sweepUpcomingVisits(NOW);

    expect(report.queued).toBe(1);
    expect(report.skipped).toEqual([]);
    expect(queueCallTask).toHaveBeenCalledTimes(1);

    const [task] = vi.mocked(queueCallTask).mock.calls[0];
    expect(task).toMatchObject({
      kind: "confirm_visit",
      visitId: "visit-1",
      jobId: "job-1",
      clientId: "client-1",
      toNumber: "+14505550123",
      notBefore: "2026-08-03T18:00:00.000Z",
    });
    expect(task.payload).toMatchObject({
      visitStartsAt: "2026-08-04T13:00:00.000Z",
      when: {
        fr: "le mardi 4 août à neuf heures du matin",
        en: "Tuesday, August 4th at nine in the morning",
      },
      contactName: "Marie Tremblay",
    });
    // The address is on the visit and deliberately not on the task: it must
    // never end up read into somebody's voicemail.
    expect(JSON.stringify(task.payload)).not.toContain("rue Principale");
  });

  it("is idempotent — a second run queues nothing and does not report an error", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([visit()] as never);
    vi.mocked(queueCallTask).mockResolvedValue({ ok: false, reason: "duplicate" });

    const report = await sweepUpcomingVisits(NOW);

    expect(report.queued).toBe(0);
    expect(report.failure).toBeUndefined();
    expect(report.skipped).toEqual([
      expect.objectContaining({ visitId: "visit-1", reason: "already_queued" }),
    ]);
  });

  it("skips a visit that has already been done", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([
      visit({ completed_at: "2026-08-03T12:00:00.000Z" }),
    ] as never);

    const report = await sweepUpcomingVisits(NOW);

    expect(queueCallTask).not.toHaveBeenCalled();
    expect(report.skipped[0].reason).toBe("already_completed");
  });

  it("skips an all-day visit — there is no time to confirm", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([visit({ all_day: true })] as never);

    const report = await sweepUpcomingVisits(NOW);

    expect(queueCallTask).not.toHaveBeenCalled();
    expect(report.skipped[0].reason).toBe("all_day");
  });

  it("skips a customer who asked not to be called, and says so in the report", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([visit()] as never);
    useDb(jobsTable({ client: { do_not_call: true } }));

    const report = await sweepUpcomingVisits(NOW);

    expect(queueCallTask).not.toHaveBeenCalled();
    expect(report.skipped).toEqual([
      expect.objectContaining({ reason: "do_not_call", clientName: "Marie Tremblay" }),
    ]);
  });

  it("skips a client with no number we can dial, and names them", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([visit()] as never);
    useDb(jobsTable({ client: { phones: [] } }));

    const report = await sweepUpcomingVisits(NOW);

    expect(queueCallTask).not.toHaveBeenCalled();
    expect(report.skipped).toEqual([
      expect.objectContaining({ reason: "no_phone", clientName: "Marie Tremblay" }),
    ]);
  });

  it("treats a number the CRM holds but cannot be dialled the same as none", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([visit()] as never);
    useDb(
      jobsTable({
        client: {
          phones: [{ number: "450-555-0123 poste 2", type: "work", primary: true, smsAllowed: false }],
        },
      }),
    );

    const report = await sweepUpcomingVisits(NOW);

    expect(queueCallTask).not.toHaveBeenCalled();
    expect(report.skipped[0].reason).toBe("no_phone");
  });

  it("does not confirm a visit on a cancelled job", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([visit()] as never);
    useDb(jobsTable({ job: { status: "cancelled" } }));

    const report = await sweepUpcomingVisits(NOW);

    expect(queueCallTask).not.toHaveBeenCalled();
    expect(report.skipped[0].reason).toBe("job_inactive");
  });

  it("fails closed when the job or client cannot be read at all", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([visit()] as never);
    useDb({}, true);

    const report = await sweepUpcomingVisits(NOW);

    expect(queueCallTask).not.toHaveBeenCalled();
    expect(report.skipped[0].reason).toBe("no_client");
  });

  describe("the two-hour floor", () => {
    it("skips a visit that is closer than the minimum notice", async () => {
      vi.mocked(listVisitsBetween).mockResolvedValue([
        visit({ starts_at: new Date(NOW.getTime() + MIN_NOTICE_MS - 1).toISOString() }),
      ] as never);

      const report = await sweepUpcomingVisits(NOW);

      expect(queueCallTask).not.toHaveBeenCalled();
      expect(report.skipped[0].reason).toBe("too_soon");
    });

    it("keeps one sitting exactly on the boundary", async () => {
      vi.mocked(listVisitsBetween).mockResolvedValue([
        visit({ starts_at: new Date(NOW.getTime() + MIN_NOTICE_MS).toISOString() }),
      ] as never);

      const report = await sweepUpcomingVisits(NOW);

      expect(report.queued).toBe(1);
    });
  });

  it("stops the whole run — not one visit — when the migration has not been applied", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([
      visit(),
      visit({ id: "visit-2", starts_at: "2026-08-04T18:00:00.000Z" }),
    ] as never);
    vi.mocked(queueCallTask).mockResolvedValue({ ok: false, reason: "migration_pending" });

    const report = await sweepUpcomingVisits(NOW);

    expect(queueCallTask).toHaveBeenCalledTimes(1);
    expect(report.failure).toBe("migration_pending");
    expect(report.summary).toContain("migration_pending");
  });

  it("reports rather than throws when the visits table is missing", async () => {
    vi.mocked(listVisitsBetween).mockRejectedValue(new Error('The "visits" table does not exist'));

    const report = await sweepUpcomingVisits(NOW);

    expect(report.failure).toBe("migration_pending");
    expect(report.queued).toBe(0);
  });

  it("counts the reasons in one line for the cron log", async () => {
    vi.mocked(listVisitsBetween).mockResolvedValue([
      visit(),
      visit({ id: "visit-2", all_day: true }),
      visit({ id: "visit-3", completed_at: NOW.toISOString() }),
    ] as never);

    const report = await sweepUpcomingVisits(NOW);

    expect(report.scanned).toBe(3);
    expect(report.queued).toBe(1);
    expect(report.summary).toContain("3 visits in window");
    expect(report.summary).toContain("1 all_day");
    expect(report.summary).toContain("1 already_completed");
  });
});

describe("when a visit moves or goes away", () => {
  const visitsTable = (overrides: Row = {}) => ({
    ...jobsTable(),
    visits: [
      {
        id: "visit-1",
        job_id: "job-1",
        starts_at: "2026-08-05T13:00:00.000Z",
        all_day: false,
        completed_at: null,
        ...overrides,
      },
    ],
  });

  it("withdraws everything queued when the visit is cancelled", async () => {
    vi.mocked(cancelCallTasksForVisit).mockResolvedValue({ ok: true, changed: 2 });

    const result = await onVisitCancelled("visit-1");

    expect(cancelCallTasksForVisit).toHaveBeenCalledWith("visit-1");
    expect(result).toEqual({ cancelled: 2, queued: false });
    expect(queueCallTask).not.toHaveBeenCalled();
  });

  it("replaces the stale confirmation with a schedule_change carrying both times", async () => {
    useDb(visitsTable());
    vi.mocked(cancelCallTasksForVisit).mockResolvedValue({ ok: true, changed: 1 });

    const result = await onVisitRescheduled("visit-1", "2026-08-04T13:00:00.000Z", NOW);

    expect(result).toEqual({ cancelled: 1, queued: true });
    const [task] = vi.mocked(queueCallTask).mock.calls[0];
    expect(task.kind).toBe("schedule_change");
    expect(task.payload).toMatchObject({
      previousStartsAt: "2026-08-04T13:00:00.000Z",
      previousWhen: { fr: "le mardi 4 août à neuf heures du matin" },
      visitStartsAt: "2026-08-05T13:00:00.000Z",
      when: { fr: "le mercredi 5 août à neuf heures du matin" },
    });
  });

  it("withdraws but does not re-queue for a customer who opted out", async () => {
    useDb({ ...visitsTable(), ...jobsTable({ client: { do_not_call: true } }) });
    vi.mocked(cancelCallTasksForVisit).mockResolvedValue({ ok: true, changed: 1 });

    const result = await onVisitRescheduled("visit-1", "2026-08-04T13:00:00.000Z", NOW);

    expect(result).toEqual({ cancelled: 1, queued: false, reason: "do_not_call" });
    expect(queueCallTask).not.toHaveBeenCalled();
  });

  it("does not announce a move to a slot that has all but arrived", async () => {
    useDb(visitsTable({ starts_at: new Date(NOW.getTime() + 60_000).toISOString() }));

    const result = await onVisitRescheduled("visit-1", "2026-08-04T13:00:00.000Z", NOW);

    expect(result.queued).toBe(false);
    expect(result.reason).toBe("too_soon");
  });

  it("says so when the visit itself has vanished", async () => {
    useDb(jobsTable());

    const result = await onVisitRescheduled("gone", "2026-08-04T13:00:00.000Z", NOW);

    expect(result.reason).toBe("no_visit");
    expect(queueCallTask).not.toHaveBeenCalled();
  });
});

describe("queueDictatedCall — the owner's errand", () => {
  const clientsTable = (client: Row = {}) => ({
    clients: [
      {
        id: "client-1",
        first_name: "Marie",
        last_name: "Tremblay",
        company_name: null,
        phones: PHONES,
        do_not_call: false,
        ...client,
      },
    ],
  });

  it("reads the number off the record and never takes one from the caller", async () => {
    useDb(clientsTable());

    const result = await queueDictatedCall(
      { clientId: "client-1", kind: "crew_on_way", message: "the crew is an hour behind" },
      NOW,
    );

    expect(result).toMatchObject({ ok: true, clientName: "Marie Tremblay", toNumber: "+14505550123" });
    const [task] = vi.mocked(queueCallTask).mock.calls[0];
    expect(task.toNumber).toBe("+14505550123");
    expect(task.visitId).toBeUndefined();
    expect(task.payload).toMatchObject({ message: "the crew is an hour behind", source: "owner_voice" });
  });

  it("refuses for a customer who opted out", async () => {
    useDb(clientsTable({ do_not_call: true }));

    const result = await queueDictatedCall(
      { clientId: "client-1", kind: "crew_on_way", message: "running late" },
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "do_not_call", clientName: "Marie Tremblay" });
    expect(queueCallTask).not.toHaveBeenCalled();
  });

  it("refuses when the record has no dialable number", async () => {
    useDb(clientsTable({ phones: [] }));

    const result = await queueDictatedCall(
      { clientId: "client-1", kind: "crew_on_way", message: "running late" },
      NOW,
    );

    expect(result).toMatchObject({ ok: false, reason: "no_phone" });
  });

  it("refuses when the client cannot be found", async () => {
    useDb({ clients: [] });

    const result = await queueDictatedCall(
      { clientId: "nobody", kind: "crew_on_way", message: "running late" },
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "no_client" });
  });

  it("waits for the morning when the owner dictates one at midnight", async () => {
    useDb(clientsTable());
    const lateNight = new Date("2026-08-04T05:00:00.000Z"); // 01:00 Montreal

    const result = await queueDictatedCall(
      { clientId: "client-1", kind: "crew_on_way", message: "running late" },
      lateNight,
    );

    expect(result).toMatchObject({ ok: true, notBefore: "2026-08-04T13:00:00.000Z" });
  });
});

describe("isCallTaskKind", () => {
  it("admits the three the schema allows", () => {
    expect(isCallTaskKind("confirm_visit")).toBe(true);
    expect(isCallTaskKind("crew_on_way")).toBe(true);
    expect(isCallTaskKind("schedule_change")).toBe(true);
  });

  it("rejects the one that would make this telemarketing", () => {
    // Docs/Voice-Outbound-Compliance.md §4.3: a quote follow-up solicits, and
    // ADAD solicitation needs express consent an existing customer does not
    // supply. There is no kind for it and this is where that stays true.
    expect(isCallTaskKind("quote_followup")).toBe(false);
    expect(isCallTaskKind("message")).toBe(false);
    expect(isCallTaskKind("")).toBe(false);
    expect(isCallTaskKind(null)).toBe(false);
    expect(isCallTaskKind(42)).toBe(false);
  });
});
