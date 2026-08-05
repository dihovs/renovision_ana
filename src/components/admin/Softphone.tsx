"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Call, Device } from "@twilio/voice-sdk";
import { SITE_PHONE } from "@/lib/constants";

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
 */

type Status = "loading" | "ready" | "connecting" | "on-call" | "unavailable";

export default function Softphone() {
  const [status, setStatus] = useState<Status>("loading");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

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
  //
  // The zeroing happens in the accept handler, not here: resetting state from
  // inside an effect is a second render pass for something an event already
  // knows.
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
    if (!device || !phone.trim()) return;

    setError(null);
    setStatus("connecting");
    try {
      const call = await device.connect({ params: { To: phone.trim() } });
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

  const busy = status === "connecting" || status === "on-call";

  return (
    <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-sm font-bold text-charcoal">Phone</h2>
        <span className="text-[11px] uppercase tracking-wide text-charcoal/40">
          {status === "loading" && "Starting…"}
          {status === "ready" && "Ready"}
          {status === "connecting" && "Connecting…"}
          {status === "on-call" && formatDuration(seconds)}
          {status === "unavailable" && "Unavailable"}
        </span>
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-charcoal/55">
        Talk here in the browser. They see {SITE_PHONE} — your own number is never shown.
      </p>

      {status === "on-call" || status === "connecting" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-charcoal">{phone}</span>
          <button
            type="button"
            onClick={toggleMute}
            disabled={status !== "on-call"}
            className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 text-xs font-bold text-charcoal transition-colors hover:bg-black/[0.03] disabled:opacity-40"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={hangUp}
            className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            Hang up
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (status === "ready") dial();
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(514) 555-0188"
            disabled={status !== "ready"}
            className="w-48 rounded-lg border border-black/10 px-3 py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/30 focus:border-charcoal/30 disabled:bg-black/[0.03]"
          />
          <button
            type="submit"
            disabled={status !== "ready" || !phone.trim() || busy}
            className="cursor-pointer rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            Call
          </button>
        </form>
      )}

      {error && (
        <p aria-live="polite" className="mt-2 text-xs leading-snug text-red-600">
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
