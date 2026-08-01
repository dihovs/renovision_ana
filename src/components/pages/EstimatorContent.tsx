"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { useChat } from "@/components/chat/ChatProvider";
import Reveal from "@/components/ui/Reveal";
import { IconCheckCircle } from "@/components/ui/icons";
import { SITE_PHONE, SITE_PHONE_TEL } from "@/lib/constants";

/**
 * The estimator's own landing page. The chat widget is the site's single
 * biggest differentiator — no competitor in the Quebec market has anything
 * like it — but as a floating button it only converts people who already
 * decided to click it. This page exists to SELL the estimator: what it does,
 * why the numbers can be trusted, and why it costs nothing to try. It is also
 * the landing target for "estimation rénovation en ligne"-type searches.
 *
 * Copy lives inline (AboutContent pattern) rather than in translations.ts —
 * page-specific prose doesn't belong in the shared nav/footer string table.
 */

const copy = {
  en: {
    eyebrow: "Free Online Estimate",
    title: "Know What Your Project Will Cost — in Minutes",
    intro:
      "Our estimate assistant prices your project line by line — materials, labour, even travel to your address — and hands you a detailed range built on our real price list. No endless forms, no waiting for a callback: describe the work, add photos if you have them, and see the numbers.",
    ctaStart: "Start my estimate",
    ctaCall: "Or call us",
    stepsTitle: "How it works",
    steps: [
      {
        title: "Describe your project",
        desc: "Tell us what needs doing — a basement to finish, a bathroom to redo, water damage to repair. Add photos for a more accurate picture.",
      },
      {
        title: "Get your itemized range",
        desc: "The assistant prices every line: materials, labour, and a travel fee calculated from your postal code. You see where every dollar comes from.",
      },
      {
        title: "Artush confirms the price",
        desc: "Send your estimate in one click. Artush reviews the project and calls you back with a firm quote — often the same day.",
      },
    ],
    getTitle: "What you get",
    getItems: [
      "A price range for every line of work — not one vague total",
      "Travel fee calculated from your postal code",
      "An estimate of how many days the work will take",
      "No commitment, no credit card, nothing to install",
    ],
    honestTitle: "Is this the final price?",
    honestBody:
      "No — and that's deliberate. It's a numbers-first preview built on our real price list, not a confirmed bid. Every home is different: what we find on site can move the numbers. That's why Artush always confirms the price after seeing the project — the range gives you an honest order of magnitude before the first call.",
    faqTitle: "Common questions",
    faq: [
      {
        q: "Is it really free?",
        a: "Completely. The estimate costs nothing and commits you to nothing — it exists so you can plan with real numbers instead of guesses.",
      },
      {
        q: "Do I have to give my contact information?",
        a: "You can explore pricing freely. To receive your itemized estimate or get a callback from Artush, we'll ask for your name and a way to reach you.",
      },
      {
        q: "What happens to my photos?",
        a: "They're used only to assess the work, and they're stored on our servers in Quebec.",
      },
    ],
    finalTitle: "Ready to see your numbers?",
    finalDesc: "Two minutes, line-by-line pricing, zero commitment.",
  },
  fr: {
    eyebrow: "Estimation gratuite en ligne",
    title: "Sachez combien coûtera votre projet — en quelques minutes",
    intro:
      "Notre assistant d'estimation chiffre votre projet poste par poste — matériaux, main-d'œuvre, et même le déplacement jusqu'à chez vous — et vous remet une fourchette détaillée bâtie sur notre vraie liste de prix. Pas de formulaire interminable, pas d'attente : décrivez les travaux, ajoutez des photos si vous en avez, et voyez les chiffres.",
    ctaStart: "Lancer mon estimation",
    ctaCall: "Ou appelez-nous",
    stepsTitle: "Comment ça fonctionne",
    steps: [
      {
        title: "Décrivez votre projet",
        desc: "Dites-nous ce qui doit être fait — un sous-sol à finir, une salle de bain à refaire, un dégât d'eau à réparer. Ajoutez des photos pour un portrait plus juste.",
      },
      {
        title: "Recevez votre fourchette détaillée",
        desc: "L'assistant chiffre chaque poste : matériaux, main-d'œuvre, et frais de déplacement calculés selon votre code postal. Vous voyez d'où vient chaque dollar.",
      },
      {
        title: "Artush confirme le prix",
        desc: "Envoyez votre estimation en un clic. Artush examine le projet et vous rappelle avec une soumission ferme — souvent le jour même.",
      },
    ],
    getTitle: "Ce que vous obtenez",
    getItems: [
      "Une fourchette de prix pour chaque poste de travaux — pas un seul total vague",
      "Frais de déplacement calculés selon votre code postal",
      "Une estimation du nombre de jours de travaux",
      "Aucun engagement, aucune carte de crédit, rien à installer",
    ],
    honestTitle: "Est-ce le prix final?",
    honestBody:
      "Non — et c'est voulu. C'est un aperçu chiffré bâti sur notre vraie liste de prix, pas une soumission confirmée. Chaque maison est différente : ce qu'on découvre sur place peut faire bouger les chiffres. C'est pourquoi Artush confirme toujours le prix après avoir vu le projet — la fourchette vous donne un ordre de grandeur honnête avant même le premier appel.",
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "Est-ce vraiment gratuit?",
        a: "Complètement. L'estimation ne coûte rien et ne vous engage à rien — elle existe pour que vous planifiiez avec de vrais chiffres plutôt que des suppositions.",
      },
      {
        q: "Dois-je laisser mes coordonnées?",
        a: "Vous pouvez explorer les prix librement. Pour recevoir votre estimation détaillée ou être rappelé par Artush, on vous demandera votre nom et un moyen de vous joindre.",
      },
      {
        q: "Qu'arrive-t-il à mes photos?",
        a: "Elles servent uniquement à évaluer les travaux et sont conservées sur nos serveurs au Québec.",
      },
    ],
    finalTitle: "Prêt à voir vos chiffres?",
    finalDesc: "Deux minutes, un prix par poste de travaux, zéro engagement.",
  },
};

export default function EstimatorContent() {
  const { locale } = useLanguage();
  const { openChat } = useChat();
  const c = copy[locale];

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
            {c.eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-blue sm:text-5xl">
            {c.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-charcoal/75">{c.intro}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={openChat}
              className="rounded-full uppercase tracking-[0.08em] bg-brand-green px-7 py-3.5 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
            >
              {c.ctaStart}
            </button>
            <a
              href={`tel:${SITE_PHONE_TEL}`}
              className="rounded-full uppercase tracking-[0.08em] border-2 border-brand-blue px-7 py-3.5 text-center font-heading font-bold text-brand-blue transition-colors hover:bg-brand-blue-light"
            >
              {c.ctaCall} · {SITE_PHONE}
            </a>
          </div>
        </div>
      </section>

      <section className="bg-brand-blue-light/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-3xl font-bold text-brand-blue sm:text-4xl">
            {c.stepsTitle}
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {c.steps.map(({ title, desc }, i) => (
              <Reveal key={title} delayMs={i * 120}>
                <div className="h-full rounded-2xl border border-black/5 bg-white p-7 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green font-heading text-lg font-bold text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-bold text-brand-blue">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-heading text-2xl font-bold text-brand-blue sm:text-3xl">
              {c.getTitle}
            </h2>
            <ul className="mt-6 space-y-4">
              {c.getItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <IconCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
                  <span className="text-sm leading-relaxed text-charcoal/80">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal
            delayMs={150}
            className="rounded-2xl bg-brand-blue-light/40 p-8 ring-1 ring-black/5"
          >
            <h2 className="font-heading text-2xl font-bold text-brand-blue sm:text-3xl">
              {c.honestTitle}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-charcoal/75">{c.honestBody}</p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-2xl font-bold text-brand-blue sm:text-3xl">
          {c.faqTitle}
        </h2>
        <div className="mt-8 space-y-6">
          {c.faq.map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <h3 className="font-heading text-base font-bold text-brand-blue">{q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/75">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-charcoal-dark py-16">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="font-heading text-3xl font-bold text-white">{c.finalTitle}</h2>
          <p className="mt-3 text-white/70">{c.finalDesc}</p>
          <button
            onClick={openChat}
            className="mt-7 rounded-full uppercase tracking-[0.08em] bg-brand-green px-8 py-4 font-heading font-bold text-white transition-colors hover:bg-brand-green-dark"
          >
            {c.ctaStart}
          </button>
        </div>
      </section>
    </>
  );
}
