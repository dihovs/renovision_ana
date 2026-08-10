"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { SITE_PHONE } from "@/lib/constants";
import { KEYPAD, appendKey, backspace, formatDialed, isDialable, sanitisePasted, toE164 } from "@/lib/phone";

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
 */

type Status = "loading" | "ready" | "connecting" | "on-call" | "unavailable";

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

  const dial = useCallback(async () => {
    const device = deviceRef.current;
    if (!device || !isDialable(phone)) return;

    setError(null);
    setTones("");
    setStatus("connecting");
    try {
      // Normalised here as well as on the server. The server's answer is the
      // one that counts — it is the one Twilio acts on — but sending a clean
      // number means the two agree about what was dialled when a call has to
      // be traced through the logs later.
      const call = await device.connect({ params: { To: toE164(phone) ?? phone } });
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
        setStatus("ready");
      };
      call.on("disconnect", finish);
      call.on("cancel", finish);
      call.on("reject", finish);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The call could not be placed.");
      setStatus("ready");
    }
  }, [phone]);

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

      {/* The display. A real input so paste, the physical keyboard and screen
          readers all work without being reimplemented; it shows the formatted
          number and sanitises whatever comes back out of it. */}
      <div className="mt-4 flex items-center gap-2">
        <input
          type="tel"
          inputMode="tel"
          aria-label="Number to call"
          value={formatDialed(phone)}
          readOnly={inCall}
          onChange={(event) => setPhone(sanitisePasted(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && status === "ready" && isDialable(phone)) {
              event.preventDefault();
              dial();
            }
          }}
          placeholder="(514) 555-0188"
          className="min-w-0 flex-1 bg-transparent text-center font-mono text-2xl font-semibold tracking-tight text-charcoal outline-none placeholder:text-charcoal/20 read-only:text-charcoal"
        />
        <button
          type="button"
          onClick={() => setPhone(backspace)}
          disabled={inCall || !phone}
          aria-label="Delete last digit"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-charcoal/50 transition-colors hover:bg-black/[0.04] hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-0"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" strokeLinejoin="round" />
            <path d="m17 9-5 6M12 9l5 6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {status === "on-call" && tones && (
        <p className="mt-1 text-center font-mono text-[11px] text-charcoal/40">Sent {tones}</p>
      )}

      {/* The pad itself. Hidden during a call until he asks for it, because the
          controls that matter mid-call are Mute and Hang up — but one tap away,
          because switchboards. */}
      {(!inCall || padOpen) && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {KEYPAD.map(({ key, letters }) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={!padEnabled}
              className="flex h-14 cursor-pointer flex-col items-center justify-center rounded-xl border border-black/5 bg-black/[0.02] transition-colors hover:bg-black/[0.06] active:bg-black/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="font-mono text-xl font-semibold leading-none text-charcoal">
                {key}
              </span>
              {letters && (
                <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-charcoal/35">
                  {letters}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {inCall ? (
          <>
            <button
              type="button"
              onClick={toggleMute}
              disabled={status !== "on-call"}
              className={`h-11 flex-1 cursor-pointer rounded-xl border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                muted
                  ? "border-charcoal/20 bg-charcoal text-white"
                  : "border-black/10 text-charcoal hover:bg-black/[0.03]"
              }`}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={() => setPadOpen((open) => !open)}
              disabled={status !== "on-call"}
              className="h-11 flex-1 cursor-pointer rounded-xl border border-black/10 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {padOpen ? "Hide keys" : "Keys"}
            </button>
            <button
              type="button"
              onClick={hangUp}
              className="h-11 flex-1 cursor-pointer rounded-xl bg-red-600 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Hang up
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={dial}
            disabled={status !== "ready" || !isDialable(phone)}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-green text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path
                d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Call
          </button>
        )}
      </div>

      {error && (
        <p aria-live="polite" className="mt-3 text-xs leading-snug text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

function formatDuration(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
