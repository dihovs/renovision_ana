/**
 * Content for Clinique Esthétique SLK / Esthétique SLK (esthetiqueslk.com), Laval, QC.
 *
 * Sourcing policy (per the client's brief, 2026-09-20): services on this
 * site are limited to what's evidenced on Instagram `@esthetiqueslk` —
 * grid posts, captions, and highlight *labels*. Fresha (menu, prices,
 * hours, team, booking) is explicitly out of scope for this build, even
 * though `docs/esthetiqueslk/RESEARCH.md` documents it — that doc's Fresha
 * sections are kept for reference only and are not a source for this file.
 * Anything not evidenced on Instagram carries a `note` on its detail entry
 * saying so, rather than being invented.
 *
 * Contact NAP (address/phone/email) is founder-supplied, not Fresha- or
 * directory-derived, and is kept as secondary contact info — not the
 * primary CTA. The primary booking CTA is Instagram DM, per the account's
 * own repeated "réservation via messagerie" / "sur rendez-vous seulement"
 * captions.
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
  // Founder-supplied, not independently confirmed. Secondary contact only —
  // never the primary "book" CTA (see bookingLink()).
  email: "info@esthetiqueslk.com",
  // No verified direct booking link exists (a guessed Fresha URL was tried
  // here once and turned out to point to the wrong business). Instagram DM
  // is what the account itself repeatedly names as the booking channel, so
  // it's the real primary CTA, not a placeholder.
  bookingUrl: null as string | null,
  instagram: "https://www.instagram.com/esthetiqueslk",
  facebook: "https://www.facebook.com/slesthetique/",
} as const;

/**
 * Every "book" CTA goes through this. Preference order: a confirmed direct
 * booking URL (none exists yet) → Instagram DM (the account's own stated
 * channel) → phone, as a last resort only.
 */
export function bookingLink(): { href: string; external: boolean } {
  if (business.bookingUrl) return { href: business.bookingUrl, external: true };
  if (business.instagram) return { href: business.instagram, external: true };
  return { href: business.phoneHref, external: false };
}

type ServiceCategory = "visage" | "remodelage";
type ServiceDetail = { intro: string; points: string[]; note?: string };
type Service = {
  slug: string;
  category: ServiceCategory;
  title: string;
  blurb: string;
  image?: string;
  detail: ServiceDetail;
};

export type GalleryItem = { src: string; alt: string };
export type FaqItem = { q: string; a: string };

type Copy = {
  meta: { title: string; description: string };
  nav: { home: string; services: string; about: string; contact: string; book: string };
  hero: {
    eyebrow: string;
    title: string;
    /** Substring of `title` set in italic clay — must appear verbatim in it. */
    accent: string;
    subtitle: string;
    cta: string;
    ctaSecondary: string;
    meta: string[];
  };
  marquee: string[];
  expect: { eyebrow: string; title: string; items: { label: string; value: string; text: string }[] };
  ui: {
    allTreatments: string;
    discover: string;
    otherTreatments: string;
    menuLabel: string;
    modalitiesLabel: string;
    findUs: string;
    instagramHandle: string;
  };
  servicesIntro: { eyebrow: string; title: string; subtitle: string };
  serviceCategories: Record<ServiceCategory, string>;
  services: Service[];
  spotlight: { eyebrow: string; title: string; body: string; cta: string; image: string; modalities: string[] };
  results: {
    eyebrow: string;
    title: string;
    subtitle: string;
    disclaimer: string;
    peauLabel: string;
    corpsLabel: string;
    peau: GalleryItem[];
    corps: GalleryItem[];
  };
  noWalkIns: string;
  reviews: { eyebrow: string; title: string; placeholder: string; items: { quote: string; author: string }[] };
  faq: { eyebrow: string; title: string; items: FaqItem[] };
  aboutTeaser: { title: string; body: string; cta: string };
  aboutPage: { eyebrow: string; title: string; intro: string; quote: string; paragraphs: string[] };
  contactTeaser: { title: string; body: string };
  contactPage: {
    title: string;
    intro: string;
    addressLabel: string;
    addressConfirmNote: string;
    phoneLabel: string;
    emailLabel: string;
    hoursLabel: string;
    hours: string[];
    bookCta: string;
    confirmNote: string;
    mapQuery: string;
  };
  footer: { rights: string; confirmNote: string };
};

export const copy: Record<Locale, Copy> = {
  fr: {
    meta: {
      title: "Clinique Esthétique SLK | Soins du visage & esthétique à Laval",
      description:
        "Clinique Esthétique SLK à Laval : soins du visage et remodelage corporel — sur rendez-vous, réservation via Instagram.",
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
      accent: "l'éclat",
      subtitle:
        "Soins du visage et remodelage corporel personnalisés, pensés pour votre peau et vos objectifs — dans une clinique à Laval.",
      cta: "Réserver sur Instagram",
      ctaSecondary: "Voir nos soins",
      meta: ["Laval, QC", "Sur rendez-vous", "Réservation par Instagram"],
    },
    marquee: [
      "Extraction",
      "Microdermabrasion",
      "Peeling chimique",
      "Lipocavitation",
      "Radiofréquence",
      "Lipo laser",
      "Lumière LED",
    ],
    expect: {
      eyebrow: "À quoi s'attendre",
      title: "Honnêtement, avant de réserver",
      items: [
        {
          label: "Nettoyage & extraction",
          value: "≈ 1 h 30",
          text: "Rougeurs, petits bleus ou gonflement possibles pendant 3 à 5 jours après une extraction en profondeur — c'est normal.",
        },
        {
          label: "Peeling chimique",
          value: "≈ 7 jours",
          text: "Phase de pelage et de guérison, avec des soins post-traitement à suivre à la maison.",
        },
        {
          label: "Remodelage corporel",
          value: "Consultation gratuite",
          text: "On évalue vos objectifs avant la première séance, sans engagement.",
        },
      ],
    },
    ui: {
      allTreatments: "Tous les soins",
      discover: "Découvrir",
      otherTreatments: "Autres soins",
      menuLabel: "Menu",
      modalitiesLabel: "Quatre technologies, une séance",
      findUs: "Nous trouver",
      instagramHandle: "@esthetiqueslk",
    },
    servicesIntro: {
      eyebrow: "Nos soins",
      title: "Soins du visage & esthétique à Laval",
      subtitle: "Ce que la clinique montre elle-même sur Instagram — rien d'inventé, rien d'un menu tiers.",
    },
    serviceCategories: {
      visage: "Soins du visage & peau",
      remodelage: "Remodelage corporel",
    },
    services: [
      {
        slug: "nettoyage-extraction",
        category: "visage",
        title: "Nettoyage en profondeur & extraction",
        blurb: "Nettoyage et extraction manuelle du visage et du cou, pour désengorger les pores.",
        image: "/slk/instagram/03-facial-treatment-closeup-crop.jpg",
        detail: {
          intro:
            "Un nettoyage en profondeur du visage et du cou, avec extraction manuelle, pensé pour désengorger les pores et relancer l'éclat naturel de la peau.",
          points: [
            "Nettoyage, extraction manuelle et hydratation du visage et du cou.",
            "Séance d'environ 1 h 30.",
            "Une légère rougeur, de petits bleus ou un gonflement peuvent apparaître et persister 3 à 5 jours après une extraction en profondeur — c'est normal.",
            "Souvent combiné à une microdermabrasion dans la même séance.",
          ],
        },
      },
      {
        slug: "microdermabrasion",
        category: "visage",
        title: "Microdermabrasion",
        blurb: "Exfoliation mécanique douce qui affine le grain de peau et le teint.",
        detail: {
          intro:
            "Une exfoliation mécanique douce, généralement combinée à l'extraction, pour retirer les cellules mortes et raviver l'éclat de la peau.",
          points: [
            "Affine le grain de peau et uniformise le teint.",
            "Nommée aux côtés de l'extraction dans les publications de la clinique.",
          ],
        },
      },
      {
        slug: "peeling-chimique",
        category: "visage",
        title: "Peeling chimique",
        blurb: "Exfoliation en profondeur pour uniformiser le teint et atténuer les imperfections.",
        image: "/slk/instagram/05-peeling-before-after-texture-clean.jpg",
        detail: {
          intro:
            "Une exfoliation chimique utilisée pour l'acné, les cicatrices d'acné, l'hyperpigmentation, la rosacée et les signes de l'âge.",
          points: [
            "Cible l'acné, les cicatrices, les taches, la rosacée et les autres imperfections visibles.",
            "Phase de pelage et de guérison d'environ 7 jours, avec des soins post-traitement à suivre.",
            "Consultation gratuite offerte pour évaluer si ce soin convient à votre peau.",
          ],
          note: "Les résultats et le temps de récupération varient d'une personne à l'autre.",
        },
      },
      {
        slug: "soin-du-visage",
        category: "visage",
        title: "Soin du visage",
        blurb: "Le soin signature — nettoyage et éclat, pensé comme une vraie pause.",
        detail: {
          intro:
            "Le soin du visage de la clinique, décrit par la propriétaire elle-même comme « sa passion » dans ses publications.",
          points: [
            "Nettoyage et mise en valeur du teint.",
            "Souvent combiné à l'extraction et à la microdermabrasion dans la même séance.",
          ],
        },
      },
      {
        slug: "anti-age",
        category: "visage",
        title: "Anti-âge",
        blurb: "Un bénéfice recherché à travers l'extraction et le peeling, plus qu'un soin à part.",
        detail: {
          intro:
            "Les bénéfices anti-âge (fermeté, lissage, éclat) reviennent régulièrement dans les publications d'extraction et de peeling de la clinique.",
          points: [
            "Vise le raffermissement, le lissage et l'uniformisation du teint.",
            "Construit à partir des mêmes techniques que le nettoyage en profondeur et le peeling chimique.",
          ],
          note: "Ce n'est pas un protocole distinct au menu — à valider avec la clinique selon vos objectifs.",
        },
      },
      {
        slug: "remodelage-beauty-pot",
        category: "remodelage",
        title: "Remodelage corporel — Beauty Pot 4-en-1",
        blurb: "Lipocavitation, radiofréquence, lipo laser et lumière LED, en une seule séance.",
        image: "/slk/instagram/07-body-contouring-thighs-before-after-clean.jpg",
        detail: {
          intro:
            "Le soin signature de la clinique : quatre technologies combinées en une seule séance avec l'appareil Beauty Pot.",
          points: [
            "Lipocavitation, radiofréquence, lipo laser et lumière LED, dans une même séance.",
            "Objectifs visés : réduction du contour et fermeté de la peau.",
            "Consultation gratuite pour évaluer vos objectifs avant de commencer.",
          ],
          note: "Les résultats varient d'une personne à l'autre; ce sont les objectifs promus par la clinique, non des garanties médicales.",
        },
      },
      {
        slug: "cellulite-fermete-drainage",
        category: "remodelage",
        title: "Cellulite, fermeté & drainage lymphatique",
        blurb: "Les objectifs du remodelage corporel : peau plus ferme, cellulite, vergetures, drainage.",
        image: "/slk/instagram/11-body-contouring-back-before-after-clean.jpg",
        detail: {
          intro:
            "Ce sont les objectifs visés par le remodelage corporel avec le Beauty Pot, dans la même séance — pas des traitements séparés.",
          points: [
            "Traitement de la cellulite et des vergetures.",
            "Drainage lymphatique, mentionné directement dans les publications de la clinique.",
          ],
          note: "Objectifs promus par la clinique sur Instagram — les résultats varient d'une personne à l'autre.",
        },
      },
      {
        slug: "consultation-remodelage",
        category: "remodelage",
        title: "Consultation remodelage (gratuite)",
        blurb: "Une évaluation gratuite de vos objectifs avant de commencer un parcours de remodelage.",
        detail: {
          intro:
            "Consultation gratuite offerte pour le remodelage corporel, mentionnée directement dans les publications de la clinique.",
          points: ["Aucun engagement.", "Bon point de départ si vous hésitez à commencer."],
        },
      },
    ],
    spotlight: {
      eyebrow: "Soin signature",
      title: "Remodelage corporel — technologie Beauty Pot 4-en-1",
      body: "Quatre technologies combinées en une seule séance — lipocavitation, radiofréquence, lipo laser et lumière LED — pour le contour du corps et la fermeté de la peau. Consultation gratuite pour évaluer vos objectifs.",
      cta: "Réserver une consultation gratuite",
      image: "/slk/instagram/08-body-contouring-abdomen-before-after-clean.jpg",
      modalities: ["Lipocavitation", "Radiofréquence", "Lipo laser", "Lumière LED"],
    },
    results: {
      eyebrow: "Résultats",
      title: "Des résultats visibles, sur peau et sur corps",
      subtitle: "Une sélection de résultats clients partagés publiquement par SLK sur Instagram.",
      disclaimer:
        "Exemples clients, partagés avec leur consentement sur le compte Instagram de la clinique. Les résultats varient d'une personne à l'autre.",
      peauLabel: "Peau",
      corpsLabel: "Corps",
      peau: [
        { src: "/slk/instagram/04-peeling-before-after-acne-clean.jpg", alt: "Avant / après peeling chimique — peau avec acné" },
        { src: "/slk/instagram/05-peeling-before-after-texture-clean.jpg", alt: "Avant / après peeling chimique — texture de peau" },
        { src: "/slk/instagram/06-peeling-before-after-eyes-clean.jpg", alt: "Avant / après peeling chimique — contour des yeux" },
      ],
      corps: [
        { src: "/slk/instagram/07-body-contouring-thighs-before-after-clean.jpg", alt: "Avant / après remodelage corporel — cuisses" },
        { src: "/slk/instagram/08-body-contouring-abdomen-before-after-clean.jpg", alt: "Avant / après remodelage corporel — abdomen" },
        { src: "/slk/instagram/09-cellulite-before-after-legs-clean.jpg", alt: "Avant / après traitement de la cellulite — jambes" },
        { src: "/slk/instagram/10-body-contouring-waist-before-after-clean.jpg", alt: "Avant / après remodelage corporel — taille" },
        { src: "/slk/instagram/11-body-contouring-back-before-after-clean.jpg", alt: "Avant / après remodelage corporel — dos" },
        { src: "/slk/instagram/12-body-contouring-abdomen-before-after-2-clean.jpg", alt: "Avant / après remodelage corporel — abdomen" },
        { src: "/slk/instagram/13-body-contouring-midsection-before-after-clean.jpg", alt: "Avant / après remodelage corporel — mi-corps" },
      ],
    },
    noWalkIns: "Sur rendez-vous seulement — pas de visites sans rendez-vous.",
    reviews: {
      eyebrow: "Avis",
      title: "Ce que disent les clientes",
      // No real quotes are wired in here — pulling them off Instagram
      // requires opening the "Avis Clientes" highlight, which is gated to
      // guests and unreachable from this environment. Inventing quotes
      // would be worse than showing none, so this stays empty until SLK
      // supplies real, consented reviews (screenshot or text is enough).
      placeholder:
        "Les avis clientes de SLK sont visibles dans son répertoire « Avis Clientes » sur Instagram. Envoyez-nous 2 ou 3 avis (avec autorisation) et on les affiche ici.",
      items: [],
    },
    faq: {
      eyebrow: "Questions fréquentes",
      title: "Avant de réserver",
      items: [
        {
          q: "Comment prendre rendez-vous?",
          a: "Par message sur Instagram (@esthetiqueslk) ou par téléphone. Il n'y a pas de réservation en ligne pour le moment — c'est la clinique qui confirme votre créneau directement.",
        },
        {
          q: "Puis-je me présenter sans rendez-vous?",
          a: "Non — la clinique reçoit sur rendez-vous seulement, pas de visites sans rendez-vous.",
        },
        {
          q: "Y a-t-il un dépôt à la réservation?",
          a: "À confirmer avec la clinique au moment de la prise de rendez-vous.",
        },
      ],
    },
    aboutTeaser: {
      title: "Une esthétique pensée pour vous",
      body: "Chaque soin est adapté à vos besoins par du personnel expérimenté, dans une ambiance calme et professionnelle.",
      cta: "En savoir plus",
    },
    aboutPage: {
      eyebrow: "À propos",
      title: "À propos de SLK",
      intro: "Une clinique d'esthétique à Laval, centrée sur des soins sur mesure.",
      quote: "Écouter d'abord, recommander ensuite — jamais l'inverse.",
      paragraphs: [
        "Clinique Esthétique SLK accompagne sa clientèle avec des soins du visage et du corps, adaptés à chaque type de peau et à chaque objectif.",
        "Chaque rendez-vous commence par comprendre votre peau et ce que vous cherchez, avant de proposer un soin.",
        "Nous recevons sur rendez-vous à Laval, dans un environnement propre, calme et professionnel.",
      ],
    },
    contactTeaser: {
      title: "Prendre rendez-vous",
      body: "Une question ou envie de réserver? Écrivez-nous directement sur Instagram.",
    },
    contactPage: {
      title: "Contact",
      intro: "Nous serions ravis de vous accueillir à la clinique.",
      addressLabel: "Adresse",
      addressConfirmNote:
        "Des publications Instagram de la clinique (fin juin) mentionnaient une autre adresse (3774A boul. Lévesque O., Laval). Adresse à confirmer avec SLK avant publication.",
      phoneLabel: "Téléphone",
      emailLabel: "Courriel",
      hoursLabel: "Rendez-vous",
      hours: [
        "Sur rendez-vous seulement — pas de visites sans rendez-vous.",
        "Réservation par message sur Instagram, ou par téléphone.",
      ],
      bookCta: "Réserver via Instagram",
      confirmNote:
        "Coordonnées à confirmer avec la clinique — assemblées à partir de sources publiques, non vérifiées directement auprès de SLK.",
      mapQuery: "333 rue Saint-Martin Ouest, Laval, QC H7M 1Y7",
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
        "Clinique Esthétique SLK in Laval: facials and body contouring — by appointment, book via Instagram.",
    },
    nav: { home: "Home", services: "Services", about: "About", contact: "Contact", book: "Book now" },
    hero: {
      eyebrow: "Clinique Esthétique SLK — Laval",
      title: "Reveal your skin's natural glow",
      accent: "natural glow",
      subtitle:
        "Personalized facials and body contouring, tailored to your skin and goals — at our clinic in Laval.",
      cta: "Book on Instagram",
      ctaSecondary: "See our treatments",
      meta: ["Laval, QC", "By appointment", "Book via Instagram"],
    },
    marquee: [
      "Extraction",
      "Microdermabrasion",
      "Chemical peel",
      "Lipocavitation",
      "Radiofrequency",
      "Lipo laser",
      "LED light",
    ],
    expect: {
      eyebrow: "What to expect",
      title: "Honestly, before you book",
      items: [
        {
          label: "Deep cleansing & extraction",
          value: "≈ 1.5 h",
          text: "Redness, light bruising or swelling can show up for 3–5 days after a deep extraction — that's normal.",
        },
        {
          label: "Chemical peel",
          value: "≈ 7 days",
          text: "A peeling and healing phase, with aftercare to follow at home.",
        },
        {
          label: "Body contouring",
          value: "Free consultation",
          text: "We go over your goals before the first session, no commitment.",
        },
      ],
    },
    ui: {
      allTreatments: "All treatments",
      discover: "Discover",
      otherTreatments: "Other treatments",
      menuLabel: "Menu",
      modalitiesLabel: "Four technologies, one session",
      findUs: "Find us",
      instagramHandle: "@esthetiqueslk",
    },
    servicesIntro: {
      eyebrow: "Our treatments",
      title: "Facials & Esthetics in Laval",
      subtitle: "What the clinic itself shows on Instagram — nothing invented, nothing from a third-party menu.",
    },
    serviceCategories: {
      visage: "Face & Skin",
      remodelage: "Body Contouring",
    },
    services: [
      {
        slug: "deep-cleansing-extraction",
        category: "visage",
        title: "Deep Cleansing & Extraction",
        blurb: "Cleansing and manual extraction for face and neck, to clear congested pores.",
        image: "/slk/instagram/03-facial-treatment-closeup-crop.jpg",
        detail: {
          intro:
            "A deep cleansing treatment for face and neck, with manual extraction, built to clear congested pores and bring back the skin's natural glow.",
          points: [
            "Cleansing, manual extraction and hydration for face and neck.",
            "Roughly a 1.5-hour session.",
            "Mild redness, light bruising or swelling can show up and last 3–5 days after a deep extraction — that's normal.",
            "Often paired with microdermabrasion in the same visit.",
          ],
        },
      },
      {
        slug: "microdermabrasion",
        category: "visage",
        title: "Microdermabrasion",
        blurb: "Gentle mechanical exfoliation that refines texture and tone.",
        detail: {
          intro:
            "A gentle mechanical exfoliation, usually paired with extraction, to clear away dead skin cells and bring back radiance.",
          points: [
            "Refines skin texture and evens out tone.",
            "Named alongside extraction in the clinic's own posts.",
          ],
        },
      },
      {
        slug: "chemical-peel",
        category: "visage",
        title: "Chemical Peel",
        blurb: "Deep exfoliation to even out skin tone and soften imperfections.",
        image: "/slk/instagram/05-peeling-before-after-texture-clean.jpg",
        detail: {
          intro:
            "A chemical exfoliation used for acne, acne scarring, hyperpigmentation, rosacea and signs of aging.",
          points: [
            "Targets acne, scarring, dark spots, rosacea and other visible imperfections.",
            "About a 7-day peeling and healing phase, with aftercare to follow.",
            "Free consultation offered to check whether this treatment fits your skin.",
          ],
          note: "Results and recovery time vary by individual.",
        },
      },
      {
        slug: "facial",
        category: "visage",
        title: "Facial",
        blurb: "The signature treatment — cleansing and glow, built as a real pause.",
        detail: {
          intro: "The clinic's facial, described by the owner herself as \"her passion\" in the account's posts.",
          points: [
            "Cleansing and a visible glow.",
            "Often combined with extraction and microdermabrasion in the same session.",
          ],
        },
      },
      {
        slug: "anti-aging",
        category: "visage",
        title: "Anti-Aging",
        blurb: "A benefit pursued through extraction and peeling, more than a stand-alone treatment.",
        detail: {
          intro:
            "Anti-aging benefits — firmness, smoothing, glow — come up consistently across the clinic's extraction and peel posts.",
          points: [
            "Aims to firm, smooth and even out tone.",
            "Built on the same techniques as deep cleansing and the chemical peel.",
          ],
          note: "Not a separate named item on the menu — confirm with the clinic based on your goals.",
        },
      },
      {
        slug: "body-contouring-beauty-pot",
        category: "remodelage",
        title: "Body Contouring — Beauty Pot 4-in-1",
        blurb: "Lipocavitation, radiofrequency, lipo laser and LED light, in a single session.",
        image: "/slk/instagram/07-body-contouring-thighs-before-after-clean.jpg",
        detail: {
          intro:
            "The clinic's signature treatment: four technologies combined in a single session with the Beauty Pot device.",
          points: [
            "Lipocavitation, radiofrequency, lipo laser and LED light, in one session.",
            "Stated goals: reduced contour and firmer skin.",
            "Free consultation to assess your goals before starting.",
          ],
          note: "Results vary by individual; these are the clinic's stated goals, not medical guarantees.",
        },
      },
      {
        slug: "cellulite-firmness-drainage",
        category: "remodelage",
        title: "Cellulite, Firmness & Lymphatic Drainage",
        blurb: "The stated goals of body contouring: firmer skin, cellulite, stretch marks, drainage.",
        image: "/slk/instagram/11-body-contouring-back-before-after-clean.jpg",
        detail: {
          intro:
            "These are the stated goals of body contouring with the Beauty Pot, within the same session — not separate treatments.",
          points: [
            "Treatment of cellulite and stretch marks.",
            "Lymphatic drainage, named directly in the clinic's posts.",
          ],
          note: "Goals as promoted by the clinic on Instagram — results vary by individual.",
        },
      },
      {
        slug: "free-consultation-contouring",
        category: "remodelage",
        title: "Free Body Contouring Consultation",
        blurb: "A free assessment of your goals before starting a contouring plan.",
        detail: {
          intro: "Free consultation offered for body contouring, named directly in the clinic's own posts.",
          points: ["No commitment required.", "A good starting point if you're not sure where to begin."],
        },
      },
    ],
    spotlight: {
      eyebrow: "Signature treatment",
      title: "Body contouring — Beauty Pot 4-in-1 technology",
      body: "Four technologies combined in a single session — lipocavitation, radiofrequency, lipo laser and LED light — for body contouring and skin firmness. Free consultation to assess your goals.",
      cta: "Book a free consultation",
      image: "/slk/instagram/08-body-contouring-abdomen-before-after-clean.jpg",
      modalities: ["Lipocavitation", "Radiofrequency", "Lipo laser", "LED light"],
    },
    results: {
      eyebrow: "Results",
      title: "Visible results, on skin and on body",
      subtitle: "A selection of client results shared publicly by SLK on Instagram.",
      disclaimer:
        "Client examples, shared with consent on the clinic's Instagram account. Results vary by individual.",
      peauLabel: "Skin",
      corpsLabel: "Body",
      peau: [
        { src: "/slk/instagram/04-peeling-before-after-acne-clean.jpg", alt: "Chemical peel before/after — acne-prone skin" },
        { src: "/slk/instagram/05-peeling-before-after-texture-clean.jpg", alt: "Chemical peel before/after — skin texture" },
        { src: "/slk/instagram/06-peeling-before-after-eyes-clean.jpg", alt: "Chemical peel before/after — eye area" },
      ],
      corps: [
        { src: "/slk/instagram/07-body-contouring-thighs-before-after-clean.jpg", alt: "Body contouring before/after — thighs" },
        { src: "/slk/instagram/08-body-contouring-abdomen-before-after-clean.jpg", alt: "Body contouring before/after — abdomen" },
        { src: "/slk/instagram/09-cellulite-before-after-legs-clean.jpg", alt: "Cellulite treatment before/after — legs" },
        { src: "/slk/instagram/10-body-contouring-waist-before-after-clean.jpg", alt: "Body contouring before/after — waist" },
        { src: "/slk/instagram/11-body-contouring-back-before-after-clean.jpg", alt: "Body contouring before/after — back" },
        { src: "/slk/instagram/12-body-contouring-abdomen-before-after-2-clean.jpg", alt: "Body contouring before/after — abdomen" },
        { src: "/slk/instagram/13-body-contouring-midsection-before-after-clean.jpg", alt: "Body contouring before/after — midsection" },
      ],
    },
    noWalkIns: "By appointment only — no walk-ins.",
    reviews: {
      eyebrow: "Reviews",
      title: "What clients say",
      // No real quotes wired in — see the fr block's comment for why.
      placeholder:
        "SLK's client reviews live in its \"Avis Clientes\" highlight on Instagram. Send us 2-3 (with permission) and we'll show them here.",
      items: [],
    },
    faq: {
      eyebrow: "FAQ",
      title: "Before you book",
      items: [
        {
          q: "How do I book an appointment?",
          a: "By Instagram message (@esthetiqueslk) or by phone. There's no online booking yet — the clinic confirms your slot directly.",
        },
        {
          q: "Can I just walk in?",
          a: "No — by appointment only, no walk-ins.",
        },
        {
          q: "Is there a deposit to book?",
          a: "Confirm with the clinic when you book.",
        },
      ],
    },
    aboutTeaser: {
      title: "Esthetics, built around you",
      body: "Every treatment is adapted to your needs by experienced staff, in a calm, professional setting.",
      cta: "Learn more",
    },
    aboutPage: {
      eyebrow: "About",
      title: "About SLK",
      intro: "An esthetics clinic in Laval, built around personalized care.",
      quote: "Listen first, recommend second — never the other way around.",
      paragraphs: [
        "Clinique Esthétique SLK offers facial and body treatments tailored to every skin type and goal.",
        "Every appointment starts with understanding your skin and what you're after, before suggesting a treatment.",
        "We see clients by appointment in Laval, in a clean, calm, professional setting.",
      ],
    },
    contactTeaser: {
      title: "Book an appointment",
      body: "Have a question, or ready to book? Message us directly on Instagram.",
    },
    contactPage: {
      title: "Contact",
      intro: "We'd love to welcome you at the clinic.",
      addressLabel: "Address",
      addressConfirmNote:
        "Some of the clinic's own Instagram posts (late June) listed a different address (3774A boul. Lévesque O., Laval). Address needs confirming with SLK before publishing.",
      phoneLabel: "Phone",
      emailLabel: "Email",
      hoursLabel: "Appointments",
      hours: [
        "By appointment only — no walk-ins.",
        "Book by Instagram message, or by phone.",
      ],
      bookCta: "Book via Instagram",
      confirmNote:
        "Contact details need confirmation from the clinic — assembled from public sources, not verified directly with SLK.",
      mapQuery: "333 rue Saint-Martin Ouest, Laval, QC H7M 1Y7",
    },
    footer: {
      rights: "All rights reserved.",
      confirmNote: "Demo site — confirm contact details before publishing.",
    },
  },
};
