/**
 * Content for Clinique Esthétique SLK (esthetiqueslk.com), Laval, QC.
 *
 * SLK's own site and Instagram (@esthetiqueslk) were unreachable from this
 * environment (network egress blocks both domains), so this was assembled
 * from public search results (Fresha listings, Facebook page "SL
 * Esthétique") rather than the source directly. Two address/phone pairs
 * turned up for what looks like the same business at different times; the
 * one used below is the Saint-Martin location, which is the one with the
 * live 5.0-star Fresha review count. CONFIRM every fact in this file
 * against the real business before this goes live — none of it should be
 * treated as verified.
 */

export type Locale = "fr" | "en";

export const business = {
  name: "Clinique Esthétique SLK",
  domain: "esthetiqueslk.com",
  address: {
    line1: "333, rue Saint-Martin Ouest, local 206",
    city: "Laval",
    region: "QC",
    postal: "H7M 1Y7",
  },
  phone: "+1 450-969-8222",
  phoneHref: "tel:+14509698222",
  // Not independently confirmed — carried over from a listing for a
  // different SLK location. Replace with the real inbox before launch.
  email: "info@esthetiqueslk.com",
  // The Fresha URL that was here was a guess from search results and
  // pointed to the wrong business — confirmed wrong by the client. Until
  // the real booking link is provided, every "book" CTA falls back to
  // `phoneHref` instead of linking out anywhere unverified.
  bookingUrl: null as string | null,
  instagram: "https://www.instagram.com/esthetiqueslk",
  facebook: "https://www.facebook.com/slesthetique/",
} as const;

/**
 * Every "book" CTA goes through this rather than reading `bookingUrl`
 * directly, so there is exactly one place that falls back to the phone
 * number when no (verified) booking link exists.
 */
export function bookingLink(): { href: string; external: boolean } {
  return business.bookingUrl
    ? { href: business.bookingUrl, external: true }
    : { href: business.phoneHref, external: false };
}

type Service = { title: string; blurb: string; image?: string };

export type GalleryItem = { src: string; alt: string; tag: string };

type Copy = {
  meta: { title: string; description: string };
  nav: { home: string; services: string; about: string; contact: string; book: string };
  hero: { eyebrow: string; title: string; subtitle: string; cta: string; ctaSecondary: string };
  servicesIntro: { eyebrow: string; title: string; subtitle: string };
  services: Service[];
  spotlight: { eyebrow: string; title: string; body: string; cta: string; image: string };
  results: { eyebrow: string; title: string; subtitle: string; disclaimer: string; items: GalleryItem[] };
  aboutTeaser: { title: string; body: string; cta: string };
  aboutPage: { title: string; intro: string; paragraphs: string[] };
  contactTeaser: { title: string; body: string };
  contactPage: {
    title: string;
    intro: string;
    addressLabel: string;
    phoneLabel: string;
    emailLabel: string;
    hoursLabel: string;
    hours: string[];
    bookCta: string;
    confirmNote: string;
  };
  footer: { rights: string; confirmNote: string };
};

export const copy: Record<Locale, Copy> = {
  fr: {
    meta: {
      title: "Clinique Esthétique SLK | Soins du visage & esthétique à Laval",
      description:
        "Clinique Esthétique SLK à Laval : soins du visage, soins de la peau et traitements esthétiques adaptés à vos besoins.",
    },
    nav: {
      home: "Accueil",
      services: "Services",
      about: "À propos",
      contact: "Contact",
      book: "Réserver",
    },
    hero: {
      eyebrow: "Clinique Esthétique SLK — Laval",
      title: "Révélez l'éclat de votre peau",
      subtitle:
        "Soins du visage et traitements esthétiques personnalisés, pensés pour votre type de peau et vos objectifs — dans une clinique à Laval.",
      cta: "Réserver un rendez-vous",
      ctaSecondary: "Voir nos services",
    },
    servicesIntro: {
      eyebrow: "Nos soins",
      title: "Soins du visage & esthétique",
      subtitle:
        "Chaque traitement est adapté à votre peau par une esthéticienne d'expérience.",
    },
    services: [
      {
        title: "Soin du visage classique",
        blurb:
          "Nettoyage en profondeur, exfoliation et hydratation pour une peau nette et lumineuse.",
        image: "/slk/instagram/03-facial-treatment-closeup.jpg",
      },
      {
        title: "Soin anti-âge",
        blurb:
          "Techniques ciblées pour raffermir, lisser et redonner de l'éclat aux peaux matures.",
      },
      {
        title: "Peeling chimique",
        blurb:
          "Exfoliation en profondeur pour uniformiser le teint et atténuer les imperfections.",
        image: "/slk/instagram/05-peeling-before-after-texture.jpg",
      },
      {
        title: "Microdermabrasion",
        blurb: "Exfoliation mécanique douce qui affine le grain de peau et le teint.",
      },
      {
        title: "Épilation",
        blurb: "Épilation à la cire, visage et corps, dans un environnement propre et confortable.",
      },
      {
        title: "Extensions de cils",
        blurb: "Cils classiques, hybrides ou volume, posés sur mesure selon le résultat souhaité.",
      },
      {
        title: "Remodelage corporel",
        blurb:
          "Traitements ciblés pour le contour du corps : drainage lymphatique, pressothérapie et plus.",
        image: "/slk/instagram/07-body-contouring-thighs-before-after.jpg",
      },
      {
        title: "Consultation personnalisée",
        blurb: "Analyse de votre peau et recommandation d'un parcours de soins adapté.",
      },
    ],
    spotlight: {
      eyebrow: "Soin signature",
      title: "Remodelage corporel — technologie Beauty Pot 4-en-1",
      body: "Quatre technologies combinées en une seule séance — lipocavitation, radiofréquence, lipo laser et lumière LED — pour le contour du corps, la fermeté de la peau et le drainage lymphatique. Consultation gratuite pour évaluer vos objectifs.",
      cta: "Réserver une consultation gratuite",
      image: "/slk/instagram/01-remodelage-before-after.jpg",
    },
    results: {
      eyebrow: "Résultats",
      title: "Des résultats visibles, sur peau et sur corps",
      subtitle: "Une sélection de résultats clients partagés publiquement par SLK.",
      disclaimer:
        "Résultats de clientes, partagés avec leur consentement sur le compte Instagram de la clinique. Les résultats varient d'une personne à l'autre.",
      items: [
        {
          src: "/slk/instagram/04-peeling-before-after-acne.jpg",
          alt: "Avant / après peeling chimique — peau avec acné",
          tag: "Peeling chimique",
        },
        {
          src: "/slk/instagram/05-peeling-before-after-texture.jpg",
          alt: "Avant / après peeling chimique — texture de peau",
          tag: "Peeling chimique",
        },
        {
          src: "/slk/instagram/06-peeling-before-after-eyes.jpg",
          alt: "Avant / après peeling chimique — contour des yeux",
          tag: "Peeling chimique",
        },
        {
          src: "/slk/instagram/07-body-contouring-thighs-before-after.jpg",
          alt: "Avant / après remodelage corporel — cuisses",
          tag: "Remodelage corporel",
        },
        {
          src: "/slk/instagram/08-body-contouring-abdomen-before-after.jpg",
          alt: "Avant / après remodelage corporel — abdomen",
          tag: "Remodelage corporel",
        },
        {
          src: "/slk/instagram/11-body-contouring-back-before-after.jpg",
          alt: "Avant / après remodelage corporel — dos",
          tag: "Remodelage corporel",
        },
      ],
    },
    aboutTeaser: {
      title: "Une esthétique pensée pour vous",
      body:
        "Chaque soin est adapté à vos besoins par du personnel expérimenté, dans une ambiance calme et professionnelle.",
      cta: "En savoir plus",
    },
    aboutPage: {
      title: "À propos de SLK",
      intro: "Une clinique d'esthétique à Laval, centrée sur des soins sur mesure.",
      paragraphs: [
        "Clinique Esthétique SLK accompagne sa clientèle avec des soins du visage et du corps de qualité, adaptés à chaque type de peau et à chaque objectif.",
        "Notre approche : écouter d'abord, puis recommander les traitements les mieux adaptés — jamais l'inverse.",
        "Nous recevons sur rendez-vous à Laval, dans un environnement propre, calme et professionnel.",
      ],
    },
    contactTeaser: {
      title: "Prendre rendez-vous",
      body: "Une question ou envie de réserver? Contactez-nous ou réservez directement en ligne.",
    },
    contactPage: {
      title: "Contact",
      intro: "Nous serions ravis de vous accueillir à la clinique.",
      addressLabel: "Adresse",
      phoneLabel: "Téléphone",
      emailLabel: "Courriel",
      hoursLabel: "Heures d'ouverture",
      hours: ["Sur rendez-vous — appelez pour connaître les disponibilités."],
      bookCta: "Réserver",
      confirmNote:
        "Coordonnées à confirmer avec la clinique — assemblées à partir de sources publiques, non vérifiées directement auprès de SLK.",
    },
    footer: {
      rights: "Tous droits réservés.",
      confirmNote: "Site de démonstration — coordonnées à confirmer avant publication.",
    },
  },
  en: {
    meta: {
      title: "Clinique Esthétique SLK | Facials & Skincare in Laval",
      description:
        "Clinique Esthétique SLK in Laval: facials, skincare and esthetic treatments tailored to your skin and goals.",
    },
    nav: { home: "Home", services: "Services", about: "About", contact: "Contact", book: "Book now" },
    hero: {
      eyebrow: "Clinique Esthétique SLK — Laval",
      title: "Reveal your skin's natural glow",
      subtitle:
        "Personalized facials and esthetic treatments, tailored to your skin type and goals — at our clinic in Laval.",
      cta: "Book an appointment",
      ctaSecondary: "See our services",
    },
    servicesIntro: {
      eyebrow: "Our treatments",
      title: "Facials & Esthetics",
      subtitle: "Every treatment is tailored to your skin by an experienced esthetician.",
    },
    services: [
      {
        title: "Classic facial",
        blurb: "Deep cleansing, exfoliation and hydration for clear, radiant skin.",
        image: "/slk/instagram/03-facial-treatment-closeup.jpg",
      },
      {
        title: "Anti-aging facial",
        blurb: "Targeted techniques to firm, smooth and restore glow to mature skin.",
      },
      {
        title: "Chemical peel",
        blurb: "Deep exfoliation to even out skin tone and soften imperfections.",
        image: "/slk/instagram/05-peeling-before-after-texture.jpg",
      },
      {
        title: "Microdermabrasion",
        blurb: "Gentle mechanical exfoliation that refines texture and tone.",
      },
      {
        title: "Waxing",
        blurb: "Face and body waxing in a clean, comfortable setting.",
      },
      {
        title: "Lash extensions",
        blurb: "Classic, hybrid or volume sets, applied to match the look you want.",
      },
      {
        title: "Body contouring",
        blurb: "Targeted body treatments: lymphatic drainage, pressotherapy and more.",
        image: "/slk/instagram/07-body-contouring-thighs-before-after.jpg",
      },
      {
        title: "Personalized consultation",
        blurb: "A skin assessment and a treatment plan built around your goals.",
      },
    ],
    spotlight: {
      eyebrow: "Signature treatment",
      title: "Body contouring — Beauty Pot 4-in-1 technology",
      body: "Four technologies combined in a single session — lipocavitation, radiofrequency, lipo laser and LED light — for body contouring, skin firmness and lymphatic drainage. Free consultation to assess your goals.",
      cta: "Book a free consultation",
      image: "/slk/instagram/01-remodelage-before-after.jpg",
    },
    results: {
      eyebrow: "Results",
      title: "Visible results, on skin and on body",
      subtitle: "A selection of client results shared publicly by SLK.",
      disclaimer:
        "Client results, shared with consent on the clinic's Instagram account. Results vary by individual.",
      items: [
        {
          src: "/slk/instagram/04-peeling-before-after-acne.jpg",
          alt: "Chemical peel before/after — acne-prone skin",
          tag: "Chemical peel",
        },
        {
          src: "/slk/instagram/05-peeling-before-after-texture.jpg",
          alt: "Chemical peel before/after — skin texture",
          tag: "Chemical peel",
        },
        {
          src: "/slk/instagram/06-peeling-before-after-eyes.jpg",
          alt: "Chemical peel before/after — eye area",
          tag: "Chemical peel",
        },
        {
          src: "/slk/instagram/07-body-contouring-thighs-before-after.jpg",
          alt: "Body contouring before/after — thighs",
          tag: "Body contouring",
        },
        {
          src: "/slk/instagram/08-body-contouring-abdomen-before-after.jpg",
          alt: "Body contouring before/after — abdomen",
          tag: "Body contouring",
        },
        {
          src: "/slk/instagram/11-body-contouring-back-before-after.jpg",
          alt: "Body contouring before/after — back",
          tag: "Body contouring",
        },
      ],
    },
    aboutTeaser: {
      title: "Esthetics, built around you",
      body: "Every treatment is adapted to your needs by experienced staff, in a calm, professional setting.",
      cta: "Learn more",
    },
    aboutPage: {
      title: "About SLK",
      intro: "An esthetics clinic in Laval, built around personalized care.",
      paragraphs: [
        "Clinique Esthétique SLK offers facial and body treatments tailored to every skin type and goal.",
        "Our approach: listen first, then recommend the treatments that actually fit — never the other way around.",
        "We see clients by appointment in Laval, in a clean, calm, professional setting.",
      ],
    },
    contactTeaser: {
      title: "Book an appointment",
      body: "Have a question, or ready to book? Reach out, or book directly online.",
    },
    contactPage: {
      title: "Contact",
      intro: "We'd love to welcome you at the clinic.",
      addressLabel: "Address",
      phoneLabel: "Phone",
      emailLabel: "Email",
      hoursLabel: "Hours",
      hours: ["By appointment — call for current availability."],
      bookCta: "Book now",
      confirmNote:
        "Contact details need confirmation from the clinic — assembled from public sources, not verified directly with SLK.",
    },
    footer: {
      rights: "All rights reserved.",
      confirmNote: "Demo site — confirm contact details before publishing.",
    },
  },
};
