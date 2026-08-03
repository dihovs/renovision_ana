"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import { isValidEmail, isValidPhone } from "@/components/chat/chatLogic";
import { stripImageMetadata } from "@/lib/stripImageMetadata";
import { leadSourceFor } from "@/lib/attribution";
import {
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_PHONE,
  SITE_PHONE_TEL,
} from "@/lib/constants";

/**
 * Photo payload discipline — deliberately duplicated from ChatWidget.tsx
 * (selectPhotosToSend) rather than extracted, so neither lead path can drift
 * under the other's feet. If you change the limits, change them there too.
 *
 * Why this exists: the platform rejects request bodies over ~4.5 MB at the
 * edge, BEFORE /api/leads ever runs, so an oversized submission doesn't fail
 * loudly — the lead silently vanishes. That happened once. Capping in the
 * browser is lead-loss protection, not a nicety.
 */
const MAX_PHOTOS_TO_SEND = 4;
const MAX_PHOTO_PAYLOAD_CHARS = 3_200_000;

/** Newest first, same as the chat: the last photo taken is usually the
 *  close-up of the damage, and the first is the doorway on the way in. */
function selectPhotosToSend(all: string[]): string[] {
  const kept: string[] = [];
  let budget = MAX_PHOTO_PAYLOAD_CHARS;

  for (const photo of [...all].reverse()) {
    if (kept.length >= MAX_PHOTOS_TO_SEND) break;
    if (photo.length > budget) continue;
    budget -= photo.length;
    kept.push(photo);
  }

  return kept.reverse();
}

const copy = {
  en: {
    eyebrow: "Get in Touch",
    title: "Let's Talk About Your Project",
    intro:
      "Reach out for a renovation, water damage restoration, or remodeling estimate. Prefer an instant ballpark? Use the chat widget for a rough estimate in minutes.",
    formTitle: "Send us a message",
    emergencyLabel: "Is this an emergency?",
    emergencyYes: "Yes",
    emergencyNo: "No",
    emergencyCallout:
      "For active water damage, call us right now — every minute of standing water grows the repair. The phone is always faster than a form.",
    emergencyCall: "Call",
    roleLabel: "I am the…",
    heardLabel: "How did you hear about us?",
    selectPlaceholder: "Select an option (optional)",
    roleOptions: [
      { value: "owner", label: "Property owner" },
      { value: "property_manager", label: "Property manager" },
      { value: "insurance", label: "Insurance adjuster or broker" },
      { value: "syndicate", label: "Condo syndicate" },
      { value: "other", label: "Other" },
    ],
    heardOptions: [
      { value: "google", label: "Google" },
      { value: "referral", label: "Referral from a friend" },
      { value: "plumber", label: "Plumber" },
      { value: "insurance_broker", label: "Insurance broker or adjuster" },
      { value: "social", label: "Facebook / Instagram" },
      { value: "neighbourhood", label: "Saw our work in the neighbourhood" },
      { value: "other", label: "Other" },
    ],
    photosLabel: "Photos of the damage or project (optional)",
    photosHint: "Up to 4 photos — they help us arrive prepared.",
    photosAdd: "Attach photos",
    photosProcessing: "Processing…",
    photosLimit: "Photo limit reached — not every photo could be attached.",
    photosFailed: "One of the photos couldn't be read. Please try a different one.",
    photosRemove: "Remove photo",
    message: "Tell us about your project",
    submit: "Send Message",
    submitting: "Sending...",
    success: "Thanks! We've received your message and will get back to you shortly.",
    error: "Something went wrong. Please try again or call us directly.",
    infoTitle: "Contact Information",
    hoursTitle: "Hours",
    hours: [
      { day: "Monday – Friday", time: "9:00 AM – 5:00 PM" },
      { day: "Saturday – Sunday", time: "Scheduled estimates & emergencies only" },
    ],
    emergencyNote: "Water damage emergency? We respond to active flooding or leaks 7 days a week, including weekends.",
    viewOnMap: "View on map",
    or: "or",
    estimateCta: "Get an Instant Estimate",
  },
  fr: {
    eyebrow: "Contactez-nous",
    title: "Parlons de votre projet",
    intro:
      "Contactez-nous pour une estimation de rénovation, de restauration de dégât d'eau ou de rénovation. Vous préférez un aperçu instantané? Utilisez l'outil de clavardage pour une estimation approximative en quelques minutes.",
    formTitle: "Envoyez-nous un message",
    emergencyLabel: "Est-ce une urgence?",
    emergencyYes: "Oui",
    emergencyNo: "Non",
    emergencyCallout:
      "Pour un dégât d'eau en cours, appelez-nous immédiatement — chaque minute d'eau stagnante aggrave les dommages. Le téléphone est toujours plus rapide qu'un formulaire.",
    emergencyCall: "Appelez le",
    roleLabel: "Je suis…",
    heardLabel: "Comment avez-vous entendu parler de nous?",
    selectPlaceholder: "Choisissez une option (facultatif)",
    roleOptions: [
      { value: "owner", label: "Propriétaire" },
      { value: "property_manager", label: "Gestionnaire immobilier" },
      { value: "insurance", label: "Expert en sinistre ou courtier d'assurance" },
      { value: "syndicate", label: "Syndicat de copropriété" },
      { value: "other", label: "Autre" },
    ],
    heardOptions: [
      { value: "google", label: "Google" },
      { value: "referral", label: "Recommandation d'un proche" },
      { value: "plumber", label: "Plombier" },
      { value: "insurance_broker", label: "Courtier ou expert en assurance" },
      { value: "social", label: "Facebook / Instagram" },
      { value: "neighbourhood", label: "J'ai vu vos travaux dans le quartier" },
      { value: "other", label: "Autre" },
    ],
    photosLabel: "Photos des dommages ou du projet (facultatif)",
    photosHint: "Jusqu'à 4 photos — elles nous aident à arriver préparés.",
    photosAdd: "Joindre des photos",
    photosProcessing: "Traitement…",
    photosLimit: "Limite de photos atteinte — certaines photos n'ont pas pu être jointes.",
    photosFailed: "Une des photos n'a pas pu être lue. Veuillez en essayer une autre.",
    photosRemove: "Retirer la photo",
    message: "Parlez-nous de votre projet",
    submit: "Envoyer le message",
    submitting: "Envoi en cours...",
    success: "Merci! Nous avons reçu votre message et vous répondrons sous peu.",
    error: "Une erreur s'est produite. Veuillez réessayer ou nous appeler directement.",
    infoTitle: "Coordonnées",
    hoursTitle: "Heures d'ouverture",
    hours: [
      { day: "Lundi – Vendredi", time: "9h00 – 17h00" },
      { day: "Samedi – Dimanche", time: "Estimations planifiées et urgences seulement" },
    ],
    emergencyNote: "Urgence de dégât d'eau? Nous répondons aux inondations ou fuites actives 7 jours sur 7, incluant les fins de semaine.",
    viewOnMap: "Voir sur la carte",
    or: "ou",
    estimateCta: "Estimation instantanée",
  },
};

export default function ContactContent() {
  const { locale, t } = useLanguage();
  const { openChat } = useChat();
  const c = copy[locale];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // Tri-state on purpose: "didn't answer" is not the same as "no", and only an
  // explicit answer should be stored against the lead.
  const [isEmergency, setIsEmergency] = useState<boolean | null>(null);
  const [contactRole, setContactRole] = useState("");
  const [heardAbout, setHeardAbout] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoNote, setPhotoNote] = useState<"limit" | "failed" | null>(null);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const canSubmit =
    name.trim().length > 1 && isValidPhone(phone) && isValidEmail(email) && message.trim().length > 3;

  const mapQuery = encodeURIComponent(
    `${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.addressLocality}, ${SITE_ADDRESS.addressRegion} ${SITE_ADDRESS.postalCode}`,
  );

  /**
   * Same pipeline as the chat widget's photos: re-encode on the device (drops
   * EXIF/GPS, downscales to ~1568px JPEG), then enforce count and byte caps
   * BEFORE anything is sent. A photo that won't fit is skipped with a note —
   * it must never grow the payload past what the platform edge accepts.
   */
  async function handlePhotoFiles(files: File[]) {
    if (files.length === 0) return;
    setPhotoNote(null);
    setProcessingPhotos(true);
    try {
      const next = [...photos];
      let charsUsed = next.reduce((sum, p) => sum + p.length, 0);
      for (const file of files) {
        if (next.length >= MAX_PHOTOS_TO_SEND) {
          setPhotoNote("limit");
          break;
        }
        try {
          const dataUrl = await stripImageMetadata(file);
          if (charsUsed + dataUrl.length > MAX_PHOTO_PAYLOAD_CHARS) {
            setPhotoNote("limit");
            continue;
          }
          charsUsed += dataUrl.length;
          next.push(dataUrl);
        } catch (err) {
          console.error("[contact] could not process photo:", err);
          setPhotoNote("failed");
        }
      }
      setPhotos(next);
    } finally {
      setProcessingPhotos(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "submitting") return;
    setStatus("submitting");
    // Which campaign this session landed from, if any. Omitted when nothing
    // was captured so the server keeps its "website" default.
    const leadSource = leadSourceFor("contact");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          message: message.trim(),
          locale,
          ...(leadSource ? { source: leadSource } : {}),
          // Only send what was actually answered — the qualifiers are
          // optional, and an absent answer must store as null, not "no".
          ...(isEmergency !== null ? { isEmergency } : {}),
          ...(contactRole ? { contactRole } : {}),
          ...(heardAbout ? { heardAbout } : {}),
          // Belt and braces: attachment already enforces the caps, but the
          // trim runs again at the door exactly like the chat path does.
          ...(photos.length > 0 ? { photos: selectPhotosToSend(photos) } : {}),
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
      setIsEmergency(null);
      setContactRole("");
      setHeardAbout("");
      setPhotos([]);
      setPhotoNote(null);
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
          {c.eyebrow}
        </p>
        <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-blue sm:text-5xl">
          {c.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{c.intro}</p>
        <button
          onClick={openChat}
          className="mt-6 rounded-full uppercase tracking-[0.08em] bg-brand-green px-7 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
        >
          {c.estimateCta}
        </button>
      </div>

      <div className="mx-auto mt-16 grid max-w-5xl gap-10 lg:grid-cols-5">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-black/5 lg:col-span-3"
        >
          <h2 className="font-heading text-xl font-bold text-brand-blue">{c.formTitle}</h2>

          <div className="mt-6 space-y-4">
            {/* First question on purpose: someone standing in water should be
                routed to the phone before they invest in typing a message.
                Answering is optional and never blocks the form. */}
            <div>
              <span className="block text-sm font-semibold text-charcoal/80">
                {c.emergencyLabel}
              </span>
              <div className="mt-2 flex gap-2" role="group" aria-label={c.emergencyLabel}>
                <button
                  type="button"
                  aria-pressed={isEmergency === true}
                  onClick={() => setIsEmergency(true)}
                  className={`cursor-pointer rounded-lg border px-5 py-2.5 text-sm font-bold transition-colors ${
                    isEmergency === true
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-black/10 text-charcoal/70 hover:border-red-300"
                  }`}
                >
                  {c.emergencyYes}
                </button>
                <button
                  type="button"
                  aria-pressed={isEmergency === false}
                  onClick={() => setIsEmergency(false)}
                  className={`cursor-pointer rounded-lg border px-5 py-2.5 text-sm font-bold transition-colors ${
                    isEmergency === false
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-black/10 text-charcoal/70 hover:border-brand-blue"
                  }`}
                >
                  {c.emergencyNo}
                </button>
              </div>
              {isEmergency === true && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold leading-relaxed text-red-700">
                    {c.emergencyCallout}
                  </p>
                  <a
                    href={`tel:${SITE_PHONE_TEL}`}
                    className="mt-3 inline-block rounded-full bg-red-600 px-6 py-3 font-heading text-base font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-red-700"
                  >
                    {c.emergencyCall} {SITE_PHONE}
                  </a>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="contact-name" className="sr-only">
                {t.chat.leadCapture.name}
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.chat.leadCapture.name}
                autoComplete="name"
                className="w-full rounded-lg border border-black/10 px-4 py-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-phone" className="sr-only">
                  {t.chat.leadCapture.phone}
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.chat.leadCapture.phone}
                  autoComplete="tel"
                  className="w-full rounded-lg border border-black/10 px-4 py-3 text-sm outline-none focus:border-brand-blue"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="sr-only">
                  {t.chat.leadCapture.email}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.chat.leadCapture.email}
                  autoComplete="email"
                  className="w-full rounded-lg border border-black/10 px-4 py-3 text-sm outline-none focus:border-brand-blue"
                />
              </div>
            </div>
            {/* Both optional. Select elements can't carry a placeholder, so
                these get visible labels where the text inputs use sr-only. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-role"
                  className="mb-1.5 block text-sm font-semibold text-charcoal/80"
                >
                  {c.roleLabel}
                </label>
                <select
                  id="contact-role"
                  value={contactRole}
                  onChange={(e) => setContactRole(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-brand-blue"
                >
                  <option value="">{c.selectPlaceholder}</option>
                  {c.roleOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="contact-heard"
                  className="mb-1.5 block text-sm font-semibold text-charcoal/80"
                >
                  {c.heardLabel}
                </label>
                <select
                  id="contact-heard"
                  value={heardAbout}
                  onChange={(e) => setHeardAbout(e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-brand-blue"
                >
                  <option value="">{c.selectPlaceholder}</option>
                  {c.heardOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="sr-only">
                {c.message}
              </label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={c.message}
                className="w-full resize-none rounded-lg border border-black/10 px-4 py-3 text-sm outline-none focus:border-brand-blue"
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-charcoal/80">
                {c.photosLabel}
              </span>
              <p className="mt-1 text-xs text-charcoal/55">{c.photosHint}</p>
              {photos.length > 0 && (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                  {photos.map((url, i) => (
                    <div key={url.slice(-24) + i} className="relative shrink-0">
                      {/* Data URLs — next/image has nothing to optimize here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-20 w-20 rounded-lg border border-black/10 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={c.photosRemove}
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-charcoal text-xs font-bold text-white transition-colors hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < MAX_PHOTOS_TO_SEND && (
                <label
                  className={`mt-3 inline-block rounded-lg border border-dashed border-black/20 px-5 py-2.5 text-sm font-semibold text-charcoal/70 transition-colors ${
                    processingPhotos
                      ? "cursor-default opacity-60"
                      : "cursor-pointer hover:border-brand-blue hover:text-brand-blue"
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={processingPhotos}
                    className="sr-only"
                    onChange={(e) => {
                      // Snapshot before clearing the input — the FileList is
                      // live, and resetting value would empty it mid-flight.
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      e.target.value = "";
                      void handlePhotoFiles(files);
                    }}
                  />
                  {processingPhotos ? c.photosProcessing : `📎 ${c.photosAdd}`}
                </label>
              )}
              {photoNote && (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  {photoNote === "limit" ? c.photosLimit : c.photosFailed}
                </p>
              )}
            </div>
          </div>

          {status === "success" && (
            <p className="mt-4 rounded-lg bg-brand-green-light px-4 py-3 text-sm font-semibold text-brand-green-dark">
              {c.success}
            </p>
          )}
          {status === "error" && (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {c.error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || status === "submitting"}
            className="mt-6 w-full cursor-pointer rounded-lg bg-brand-blue px-6 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "submitting" ? c.submitting : c.submit}
          </button>
        </form>

        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-brand-blue-light/40 p-8">
            <h2 className="font-heading text-lg font-bold text-brand-blue">{c.infoTitle}</h2>
            <ul className="mt-4 space-y-3 text-sm text-charcoal/80">
              <li>
                <a href={`tel:${SITE_PHONE_TEL}`} className="font-semibold text-brand-blue hover:underline">
                  {SITE_PHONE}
                </a>
              </li>
              <li>
                <a href={`mailto:${SITE_EMAIL}`} className="font-semibold text-brand-blue hover:underline">
                  {SITE_EMAIL}
                </a>
              </li>
              <li>
                <p>{SITE_ADDRESS.streetAddress}</p>
                <p>
                  {SITE_ADDRESS.addressLocality}, {SITE_ADDRESS.addressRegion}{" "}
                  {SITE_ADDRESS.postalCode}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm font-semibold text-brand-green hover:underline"
                >
                  {c.viewOnMap} →
                </a>
              </li>
            </ul>

            <h3 className="mt-6 font-heading text-sm font-bold uppercase tracking-wide text-brand-blue">
              {c.hoursTitle}
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-charcoal/80">
              {c.hours.map(({ day, time }) => (
                <li key={day} className="flex justify-between gap-4">
                  <span>{day}</span>
                  <span className="font-semibold">{time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-charcoal/60">{c.emergencyNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
