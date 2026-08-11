"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { Capacitor } from "@capacitor/core";
import { SITE_PHONE } from "@/lib/constants";
import { KEYPAD, appendKey, backspace, formatDialed, isDialable, sanitisePasted, toE164 } from "@/lib/phone";
import { setSpeakerEnabled } from "@/lib/speakerOutput";
import type { Contact } from "@/app/api/admin/contacts/route";

/**
 * A phone, in the admin, using the company's number.
 *
 * He dials, he talks through the browser, and the customer sees
 * +1 579-999-5979. His personal mobile is never involved and never
 * transmitted — which is the entire requirement, and the reason this exists
 * alongside the two buttons that already place calls:
 *
 *   - CallButton (`tel:`) uses his own line and shows his own number.
 *   - BusinessCallButton rings his mobile and bridges. Right caller ID, but
 *     his phone has to ring, which is wrong when he is sitting at the desk.
 *   - This one involves no phone at all.
 *
 * THE SDK LOADS LAZILY, and not for bundle size. @twilio/voice-sdk touches
 * browser-only globals at module scope, so a static import breaks the server
 * render of any page that mounts this. Importing it inside an effect keeps it
 * off the server entirely.
 *
 * THE DEVICE IS BUILT ONCE AND DESTROYED ON UNMOUNT. A leaked Device holds a
 * signalling websocket and a microphone permission open; two of them race to
 * answer the same identity.
 *
 * THE PAD IS A REAL PAD, not a text box with a Call button next to it. Numbers
 * get read aloud off a van or a business card and punched in one digit at a
 * time, and the display formats as it goes so a wrong digit is catchable when
 * it is typed rather than after ten of them. It stays available DURING a call
 * too — every supplier and insurer answers with "press 1 for…", and a phone
 * that cannot send a tone cannot get through a switchboard.
 *
 * IDLE VS IN-CALL ARE TWO DIFFERENT SCREENS, like the system Phone app: a
 * keypad/contacts pair before dialling, a caller name and Mute/Keypad/Speaker
 * row once connected. Splitting them means the in-call screen only ever shows
 * controls that do something right now, instead of a pad that happens to have
 * a hang-up button glued to the bottom.
 */

type Status = "loading" | "ready" | "connecting" | "on-call" | "unavailable";
type View = "keypad" | "contacts";

export default function Softphone() {
  const [status, setStatus] = useState<Status>("loading");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // Tones sent since the call connected, shown so he can see that the 1 he
  // pressed actually went — an IVR that ignores a tone is otherwise
  // indistinguishable from a pad that never sent one.
  const [tones, setTones] = useState("");
  const [padOpen, setPadOpen] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);

  const [view, setView] = useState<View>("keypad");
  const [callerLabel, setCallerLabel] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [contactsQuery, setContactsQuery] = useState("");

  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    let device: Device | null = null;

    (async () => {
      try {
        const response = await fetch("/api/voice/token");
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            missing?: string[];
          } | null;
          if (cancelled) return;
          setStatus("unavailable");
          setError(
            payload?.missing?.length
              ? `Not set up yet — missing ${payload.missing.join(", ")}.`
              : "Calling from the browser is not available.",
          );
          return;
        }

        const { token } = (await response.json()) as { token: string };
        if (cancelled) return;

        const { Device: TwilioDevice } = await import("@twilio/voice-sdk");
        if (cancelled) return;

        device = new TwilioDevice(token, {
          // Opus over PCMU: better speech quality on the same bandwidth, and
          // this leg is a browser on wifi rather than a phone on a carrier.
          codecPreferences: ["opus", "pcmu"] as never,
        });

        device.on("error", (err: { message?: string }) => {
          if (cancelled) return;
          setError(err?.message ?? "The phone connection failed.");
          setStatus("ready");
        });

        await device.register();
        if (cancelled) {
          device.destroy();
          return;
        }
        deviceRef.current = device;
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setStatus("unavailable");
        setError(err instanceof Error ? err.message : "Could not start the phone.");
      }
    })();

    return () => {
      cancelled = true;
      callRef.current?.disconnect();
      // The local `device` as well as the ref: unmounting before registration
      // finishes leaves the ref null while a Device is still being built.
      (deviceRef.current ?? device)?.destroy();
      deviceRef.current = null;
    };
  }, []);

  // Contacts load once, on first visit to the tab, and are then filtered in
  // the browser — see the route's own comment for why one fetch is enough.
  useEffect(() => {
    if (view !== "contacts" || contacts !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/contacts");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as { contacts: Contact[] };
        if (!cancelled) setContacts(data.contacts);
      } catch {
        if (!cancelled) setContactsError("Could not load contacts.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, contacts]);

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    const needle = contactsQuery.trim().toLowerCase();
    if (!needle) return contacts;
    const digits = needle.replace(/\D/g, "");
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (digits.length >= 2 && c.phones.some((p) => p.number.replace(/\D/g, "").includes(digits))),
    );
  }, [contacts, contactsQuery]);

  // Call duration, measured from a timestamp rather than counted up by the
  // interval. A tab that gets backgrounded has its timers throttled, so a
  // counter that increments once per tick drifts behind the real call length —
  // and the number he is reading is the one he bills from.
  useEffect(() => {
    if (status !== "on-call") return;
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [status]);

  const dial = useCallback(
    async (overrideNumber?: string) => {
      const device = deviceRef.current;
      const target = overrideNumber ?? phone;
      if (!device || !isDialable(target)) return;

      setError(null);
      setTones("");
      setStatus("connecting");
      try {
        // Normalised here as well as on the server. The server's answer is the
        // one that counts — it is the one Twilio acts on — but sending a clean
        // number means the two agree about what was dialled when a call has to
        // be traced through the logs later.
        const call = await device.connect({ params: { To: toE164(target) ?? target } });
        callRef.current = call;

        call.on("accept", () => {
          startedAtRef.current = Date.now();
          setSeconds(0);
          setStatus("on-call");
        });
        // All three end the call; without every one of them the UI can stick on
        // "connecting" after the far end has already gone.
        const finish = () => {
          callRef.current = null;
          setMuted(false);
          setPadOpen(false);
          if (speakerOn) void setSpeakerEnabled(false);
          setSpeakerOn(false);
          setStatus("ready");
        };
        call.on("disconnect", finish);
        call.on("cancel", finish);
        call.on("reject", finish);
      } catch (err) {
        setError(err instanceof Error ? err.message : "The call could not be placed.");
        setStatus("ready");
      }
    },
    [phone, speakerOn],
  );

  /** The keypad's own Call button — an unknown number, so no caller label. */
  function callTyped() {
    setCallerLabel(null);
    dial();
  }

  /** A tap on a contact's number — dials immediately, like the system Phone app. */
  function callContact(contact: Contact, number: string) {
    if (status !== "ready") return;
    setCallerLabel(contact.name);
    setPhone(sanitisePasted(number));
    dial(number);
  }

  function hangUp() {
    callRef.current?.disconnect();
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    const next = !muted;
    call.mute(next);
    setMuted(next);
  }

  async function toggleSpeaker() {
    const next = !speakerOn;
    setSpeakerOn(await setSpeakerEnabled(next));
  }

  /**
   * One key. Before a call it builds the number; during one it goes down the
   * line as a DTMF tone, which is what gets him through "press 1 for service".
   */
  function press(key: string) {
    if (status === "on-call") {
      callRef.current?.sendDigits(key);
      setTones((current) => (current + key).slice(-20));
      return;
    }
    if (status !== "ready") return;
    setPhone((current) => appendKey(current, key));
  }

  const inCall = status === "on-call" || status === "connecting";
  const padEnabled = status === "ready" || status === "on-call";
  const isNative = Capacitor.isNativePlatform();

  return (
    <section className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-sm font-bold text-charcoal">Phone</h2>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/40">
          {status === "loading" && "Starting…"}
          {status === "ready" && "Ready"}
          {status === "connecting" && "Calling…"}
          {status === "on-call" && formatDuration(seconds)}
          {status === "unavailable" && "Unavailable"}
        </span>
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
        They see {SITE_PHONE}. Your own number is never shown.
      </p>

      {inCall ? (
        <div className="mt-4">
          <div className="flex flex-col items-center gap-1 py-3 text-center">
            <span className="font-heading text-lg font-bold text-charcoal">
              {callerLabel ?? formatDialed(phone)}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-charcoal/40">
              {status === "connecting" ? "Calling…" : formatDuration(seconds)}
            </span>
          </div>

          {padOpen && <KeypadGrid onPress={press} disabled={status !== "on-call"} />}
          {status === "on-call" && tones && (
            <p className="mt-1 text-center font-mono text-[11px] text-charcoal/40">Sent {tones}</p>
          )}

          <div className="mt-5 flex items-center justify-center gap-6">
            <RoundButton
              active={muted}
              disabled={status !== "on-call"}
              onClick={toggleMute}
              label={muted ? "Unmute" : "Mute"}
              icon={<MicIcon slashed={muted} />}
            />
            <RoundButton
              active={padOpen}
              disabled={status !== "on-call"}
              onClick={() => setPadOpen((open) => !open)}
              label="Keypad"
              icon={<KeypadIcon />}
            />
            {isNative && (
              <RoundButton
                active={speakerOn}
                disabled={status !== "on-call"}
                onClick={toggleSpeaker}
                label="Speaker"
                icon={<SpeakerIcon />}
              />
            )}
          </div>

          <button
            type="button"
            onClick={hangUp}
            aria-label="Hang up"
            className="mx-auto mt-6 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-red-600 text-white transition-opacity hover:opacity-90"
          >
            <EndCallIcon />
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex rounded-lg bg-black/[0.04] p-0.5">
            <button
              type="button"
              onClick={() => setView("keypad")}
              className={`flex-1 cursor-pointer rounded-md py-1.5 text-xs font-bold transition-colors ${
                view === "keypad" ? "bg-white text-charcoal shadow-sm" : "text-charcoal/50"
              }`}
            >
              Keypad
            </button>
            <button
              type="button"
              onClick={() => setView("contacts")}
              className={`flex-1 cursor-pointer rounded-md py-1.5 text-xs font-bold transition-colors ${
                view === "contacts" ? "bg-white text-charcoal shadow-sm" : "text-charcoal/50"
              }`}
            >
              Contacts
            </button>
          </div>

          {view === "keypad" ? (
            <>
              {/* The display. A real input so paste, the physical keyboard and
                  screen readers all work without being reimplemented; it shows
                  the formatted number and sanitises whatever comes back out of
                  it. */}
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="tel"
                  inputMode="tel"
                  aria-label="Number to call"
                  value={formatDialed(phone)}
                  onChange={(event) => setPhone(sanitisePasted(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && status === "ready" && isDialable(phone)) {
                      event.preventDefault();
                      callTyped();
                    }
                  }}
                  placeholder="(514) 555-0188"
                  className="min-w-0 flex-1 bg-transparent text-center font-mono text-2xl font-semibold tracking-tight text-charcoal outline-none placeholder:text-charcoal/20"
                />
                <button
                  type="button"
                  onClick={() => setPhone(backspace)}
                  disabled={!phone}
                  aria-label="Delete last digit"
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-charcoal/50 transition-colors hover:bg-black/[0.04] hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-0"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" strokeLinejoin="round" />
                    <path d="m17 9-5 6M12 9l5 6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <KeypadGrid onPress={press} disabled={!padEnabled} />

              <button
                type="button"
                onClick={callTyped}
                disabled={status !== "ready" || !isDialable(phone)}
                aria-label="Call"
                className="mx-auto mt-6 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-brand-green text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <PhoneIcon size={28} />
              </button>
            </>
          ) : (
            <div className="mt-3">
              <input
                type="text"
                value={contactsQuery}
                onChange={(event) => setContactsQuery(event.target.value)}
                placeholder="Search clients…"
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-charcoal outline-none transition-colors placeholder:text-charcoal/30 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15"
              />
              <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
                {contactsError && (
                  <p className="py-4 text-center text-xs text-red-600">{contactsError}</p>
                )}
                {!contactsError && contacts === null && (
                  <p className="py-4 text-center text-xs text-charcoal/40">Loading…</p>
                )}
                {!contactsError && contacts !== null && filteredContacts.length === 0 && (
                  <p className="py-4 text-center text-xs text-charcoal/40">No matching clients.</p>
                )}
                {filteredContacts.map((contact) => (
                  <div key={contact.id} className="border-b border-black/5 py-2 last:border-0">
                    <p className="text-sm font-bold text-charcoal">{contact.name}</p>
                    {contact.phones.map((p) => (
                      <button
                        key={p.number}
                        type="button"
                        onClick={() => callContact(contact, p.number)}
                        disabled={status !== "ready"}
                        className="mt-0.5 flex w-full cursor-pointer items-center justify-between rounded-md px-1 py-1 text-left text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span>{formatDialed(p.number)}</span>
                        <span className="font-medium capitalize text-charcoal/35">{p.type}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p aria-live="polite" className="mt-3 text-xs leading-snug text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

/** True circles, like the system Phone app's own keypad — not rounded
    squares. Sized to be comfortably tappable with a thumb, not just a
    finger. */
function KeypadGrid({ onPress, disabled }: { onPress: (key: string) => void; disabled: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-3 justify-items-center gap-y-3">
      {KEYPAD.map(({ key, letters }) => (
        <button
          key={key}
          type="button"
          onClick={() => onPress(key)}
          disabled={disabled}
          className="flex h-[72px] w-[72px] cursor-pointer flex-col items-center justify-center rounded-full bg-black/[0.04] transition-colors hover:bg-black/[0.08] active:bg-black/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="font-heading text-[28px] font-semibold leading-none text-charcoal">
            {key}
          </span>
          {letters && (
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-charcoal/40">
              {letters}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** One of the three circular in-call toggles — Mute, Keypad, Speaker. */
function RoundButton({
  active,
  disabled,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 ${disabled ? "opacity-40" : ""}`}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full border transition-colors ${
          active
            ? "border-charcoal bg-charcoal text-white"
            : "border-black/10 bg-black/[0.04] text-charcoal hover:bg-black/[0.08]"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {icon}
      </span>
      <span className="text-[11px] font-semibold text-charcoal/60">{label}</span>
    </button>
  );
}

function MicIcon({ slashed }: { slashed: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4" strokeLinecap="round" />
      {slashed && <path d="M3 3l18 18" strokeLinecap="round" />}
    </svg>
  );
}

function KeypadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="6" cy="6" r="1.7" />
      <circle cx="12" cy="6" r="1.7" />
      <circle cx="18" cy="6" r="1.7" />
      <circle cx="6" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18" cy="12" r="1.7" />
      <circle cx="6" cy="18" r="1.7" />
      <circle cx="12" cy="18" r="1.7" />
      <circle cx="18" cy="18" r="1.7" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5z" strokeLinejoin="round" />
      <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The same handset glyph as PhoneIcon, rotated and filled red — the
    universal "hang up" convention. */
function EndCallIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ transform: "rotate(135deg)" }}
      aria-hidden
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

function formatDuration(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
