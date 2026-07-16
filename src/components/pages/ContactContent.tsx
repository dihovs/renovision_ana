"use client";

import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import { isValidEmail, isValidPhone } from "@/components/chat/chatLogic";
import {
  SITE_ADDRESS,
  SITE_EMAIL,
  SITE_PHONE,
  SITE_PHONE_TEL,
} from "@/lib/constants";

const copy = {
  en: {
    eyebrow: "Get in Touch",
    title: "Let's Talk About Your Project",
    intro:
      "Reach out for a renovation, water damage restoration, or remodeling estimate. Prefer an instant ballpark? Use the chat widget for a rough estimate in minutes.",
    formTitle: "Send us a message",
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
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const canSubmit =
    name.trim().length > 1 && isValidPhone(phone) && isValidEmail(email) && message.trim().length > 3;

  const mapQuery = encodeURIComponent(
    `${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.addressLocality}, ${SITE_ADDRESS.addressRegion} ${SITE_ADDRESS.postalCode}`,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setName("");
      setPhone("");
      setEmail("");
      setMessage("");
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
          className="mt-6 rounded-full bg-brand-green px-7 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
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
