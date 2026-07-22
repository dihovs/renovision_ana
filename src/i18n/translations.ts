export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];

const en: Record<string, unknown> & {
  nav: Record<string, string>;
  header: Record<string, string>;
  hero: Record<string, string>;
  stats: Record<"years" | "projects" | "satisfaction" | "emergency", { value: string; label: string }>;
  trustBar: Record<string, string>;
  audience: {
    title: string;
    propertyManagers: { title: string; desc: string };
    insurance: { title: string; desc: string };
    homeowners: { title: string; desc: string };
  };
  services: {
    title: string;
    subtitle: string;
    learnMore: string;
    items: Record<
      "waterDamage" | "flooring" | "kitchenBath" | "interior" | "basements" | "repairs",
      { title: string; desc: string }
    >;
  };
  howItWorks: {
    title: string;
    subtitle: string;
    stepLabel: string;
    steps: Record<"inspection" | "estimate" | "approval" | "completion", { title: string; desc: string }>;
  };
  ctaBand: {
    title: string;
    subtitle: string;
    ctaEstimate: string;
    ctaCall: string;
  };
  testimonials: {
    title: string;
    googleReview: string;
    items: Array<{ name: string; rating: number; quote: string }>;
  };
  partners: { title: string };
  footer: Record<string, string>;
  chat: {
    launcherLabel: string;
    title: string;
    subtitle: string;
    welcome: string;
    placeholder: string;
    uploadLabel: string;
    disclaimer: string;
    offTopic: string;
    restart: string;
    send: string;
    photoAttached: string;
    removePhoto: string;
    skip: string;
    projectType: Record<
      "question" | "waterDamage" | "flooring" | "kitchenBath" | "interior" | "basements" | "repairs",
      string
    >;
    size: Record<"question" | "small" | "medium" | "large", string>;
    tier: Record<"question" | "standard" | "premium" | "luxury", string>;
    photo: Record<"question", string>;
    estimate: Record<"intro" | "disclaimer", string>;
    leadCapture: Record<"intro" | "name" | "phone" | "email" | "submit" | "later" | "success", string>;
  };
} = {
  nav: {
    services: "Services",
    about: "About",
    gallery: "Gallery",
    blog: "Blog",
    contact: "Contact",
    commercial: "Commercial",
    safety: "Safety & Certifications",
    careers: "Careers",
    caseStudies: "Case Studies",
    company: "Company",
  },
  header: {
    freeEstimate: "Get a Free Estimate",
    callNow: "Call Now",
  },
  hero: {
    eyebrow: "Renovations & Water Damage Restoration",
    headlineStart: "Renovation and Water Damage Restoration",
    headlineAccent: "You Can Trust.",
    subheadline:
      "From emergency water damage repair to full kitchen and bathroom remodels, Renovision AnA delivers reliable craftsmanship for property managers, insurers, and homeowners.",
    ctaEstimate: "Get an Instant Estimate",
    ctaCall: "Call Now",
    beforeLabel: "Before",
    afterLabel: "After",
    dragHint: "Drag to see the transformation",
  },
  stats: {
    years: { value: "5+", label: "Years of Experience" },
    projects: { value: "100+", label: "Projects Completed" },
    satisfaction: { value: "5★", label: "Google Reviews" },
    emergency: { value: "Laval & Montreal", label: "Proudly Local" },
  },
  trustBar: {
    item1: "Trusted by property management companies",
    item2: "Insurance approved network",
    item3: "Licensed & insured",
  },
  audience: {
    title: "Built for Every Client",
    propertyManagers: {
      title: "Property Management Companies",
      desc: "Fast response times and dependable crews so your units are turned around quickly and tenants stay happy.",
    },
    insurance: {
      title: "Insurance Companies",
      desc: "Experienced with claims work, thorough documentation, and photo evidence that keeps adjusters and policyholders aligned.",
    },
    homeowners: {
      title: "Homeowners",
      desc: "Clear communication and quality craftsmanship, so you have peace of mind from the first inspection to the final walkthrough.",
    },
  },
  services: {
    title: "Our Services",
    subtitle: "Any interior job, big or small — from full transformations to cost-effective local repairs.",
    learnMore: "Learn more",
    items: {
      waterDamage: {
        title: "Water Damage Restoration",
        desc: "Rapid response water extraction, drying, and repair to protect your property and minimize downtime.",
      },
      flooring: {
        title: "Flooring",
        desc: "Tile, hardwood, and vinyl flooring installed and refinished with precision, built to last.",
      },
      kitchenBath: {
        title: "Kitchens & Bathrooms",
        desc: "Modern, functional kitchen and bathroom remodels tailored to your budget and style.",
      },
      interior: {
        title: "Interior Renovations",
        desc: "Bedrooms, living rooms, offices — complete renovations for any room and any interior space.",
      },
      basements: {
        title: "Basement Transformations",
        desc: "Full basement transformations, from unfinished space to beautiful, livable rooms.",
      },
      repairs: {
        title: "Small Repairs & Color Matching",
        desc: "Cost-effective local repairs with precise color matching that blends seamlessly into the existing finish.",
      },
    },
  },
  howItWorks: {
    title: "How It Works",
    subtitle: "A simple, transparent process from first call to final walkthrough.",
    stepLabel: "Step",
    steps: {
      inspection: { title: "Inspection", desc: "We assess the property and scope of work in person or via photos." },
      estimate: { title: "Estimate", desc: "You receive a clear, itemized estimate with no hidden surprises." },
      approval: { title: "Approval", desc: "We schedule the work once you and/or your insurer sign off." },
      completion: { title: "Completion", desc: "Our crew completes the job on time, with a final walkthrough." },
    },
  },
  ctaBand: {
    title: "Ready to start your project?",
    subtitle: "Get a rough estimate in minutes with our instant estimate tool, or call us directly.",
    ctaEstimate: "Get an Instant Estimate",
    ctaCall: "Call Now",
  },
  testimonials: {
    title: "What Our Clients Say",
    googleReview: "Google review",
    items: [
      {
        name: "Anahid Vardanian",
        rating: 5,
        quote:
          "Best renovation company! They changed my entire bathroom a week ago. I am very satisfied with the results! Very professional team! Highly recommend.",
      },
      {
        name: "Naira Shukuryan",
        rating: 5,
        quote:
          "We are extremely satisfied with the complete renovation of our bathroom. The team was professional, punctual, and very thorough from start to finish. The site always stayed clean and the final result is beautiful.",
      },
      {
        name: "Firdaous Dahha",
        rating: 5,
        quote:
          "Excellent service! The Renovision AnA team repaired my basement with great professionalism. The work was carried out with care, the site stayed clean throughout the project, and the result is flawless.",
      },
      {
        name: "Gilbert Aoun",
        rating: 5,
        quote:
          "Very good price and very efficient, they did great work in my bathroom, I highly recommend them.",
      },
      {
        name: "Frederic Aoun",
        rating: 5,
        quote:
          "Excellent service! Professional team, great quality work, and completed everything on time. Highly recommend!",
      },
    ],
  },
  partners: {
    title: "Trusted By",
  },
  footer: {
    tagline: "Renovation and water damage restoration you can trust.",
    quickLinks: "Quick Links",
    explore: "Explore",
    contactUs: "Contact Us",
    followUs: "Follow Us",
    viewOnMap: "View on map",
    rights: "All rights reserved.",
  },
  chat: {
    launcherLabel: "Get a Free Estimate",
    title: "Vision AI",
    subtitle: "Get a rough project estimate in minutes",
    welcome:
      "Hi, I'm Vision AI from Renovision AnA! I can give you a rough estimate for your renovation, water damage, or remodeling project. What are you looking to have done?",
    placeholder: "Type your message...",
    uploadLabel: "Attach a photo",
    disclaimer:
      "Vision AI is an automated estimate tool and only discusses renovation, water damage, and remodeling topics.",
    offTopic:
      "I'm just able to help with renovation, water damage restoration, and remodeling questions for Renovision AnA. Could you tell me more about your project?",
    restart: "Start over",
    send: "Send",
    photoAttached: "Photo attached",
    removePhoto: "Remove",
    skip: "Skip",
    projectType: {
      question: "What type of project are you looking to have done?",
      waterDamage: "Water Damage Repair",
      flooring: "Flooring",
      kitchenBath: "Kitchen / Bath Remodel",
      interior: "Interior Renovation",
      basements: "Basement Transformation",
      repairs: "Small Repair / Color Match",
    },
    size: {
      question: "Roughly how big is the project?",
      small: "Small (single room)",
      medium: "Medium (multiple rooms)",
      large: "Large (whole unit / floor)",
    },
    tier: {
      question: "What quality tier are you aiming for?",
      standard: "Standard",
      premium: "Premium",
      luxury: "Luxury",
    },
    photo: {
      question: "You can attach a photo of the space to help refine the estimate (optional).",
    },
    estimate: {
      intro: "Based on what you've shared, here's a rough estimate range:",
      disclaimer:
        "This is an automated approximation, not a final quote. Final pricing depends on an in-person or photo-based inspection.",
    },
    leadCapture: {
      intro: "To send you a more precise quote, could you share a few details?",
      name: "Full name",
      phone: "Phone number",
      email: "Email address",
      submit: "Send me my quote",
      later: "Maybe later",
      success: "Thanks! A member of our team will follow up with your detailed quote shortly.",
    },
  },
};

const fr: typeof en = {
  nav: {
    services: "Services",
    about: "À propos",
    gallery: "Galerie",
    blog: "Blogue",
    contact: "Contact",
    commercial: "Commercial",
    safety: "Sécurité et certifications",
    careers: "Carrières",
    caseStudies: "Études de cas",
    company: "Entreprise",
  },
  header: {
    freeEstimate: "Estimation gratuite",
    callNow: "Appelez maintenant",
  },
  hero: {
    eyebrow: "Rénovations et restauration de dégâts d'eau",
    headlineStart: "Rénovation et restauration de dégâts d'eau",
    headlineAccent: "en qui vous pouvez avoir confiance.",
    subheadline:
      "De la réparation d'urgence des dégâts d'eau aux rénovations complètes de cuisines et salles de bain, Renovision AnA offre un travail fiable pour les gestionnaires immobiliers, les assureurs et les propriétaires.",
    ctaEstimate: "Estimation instantanée",
    ctaCall: "Appelez maintenant",
    beforeLabel: "Avant",
    afterLabel: "Après",
    dragHint: "Glissez pour voir la transformation",
  },
  stats: {
    years: { value: "5+", label: "Années d'expérience" },
    projects: { value: "100+", label: "Projets réalisés" },
    satisfaction: { value: "5★", label: "Avis Google" },
    emergency: { value: "Laval et Montréal", label: "Fièrement local" },
  },
  trustBar: {
    item1: "La confiance des sociétés de gestion immobilière",
    item2: "Réseau approuvé par les assureurs",
    item3: "Licencié et assuré",
  },
  audience: {
    title: "Conçu pour chaque client",
    propertyManagers: {
      title: "Sociétés de gestion immobilière",
      desc: "Des délais de réponse rapides et des équipes fiables pour que vos unités soient remises en état rapidement et que vos locataires restent satisfaits.",
    },
    insurance: {
      title: "Compagnies d'assurance",
      desc: "Expérience des dossiers de réclamation, documentation rigoureuse et preuves photographiques qui facilitent le travail des experts et des assurés.",
    },
    homeowners: {
      title: "Propriétaires",
      desc: "Communication claire et travail de qualité pour votre tranquillité d'esprit, de l'inspection initiale à la visite finale.",
    },
  },
  services: {
    title: "Nos services",
    subtitle: "Tout travail intérieur, grand ou petit — des transformations complètes aux réparations locales économiques.",
    learnMore: "En savoir plus",
    items: {
      waterDamage: {
        title: "Restauration de dégâts d'eau",
        desc: "Extraction d'eau rapide, séchage et réparation pour protéger votre propriété et réduire les interruptions.",
      },
      flooring: {
        title: "Planchers",
        desc: "Céramique, bois franc et vinyle — installation et finition de planchers avec précision, faits pour durer.",
      },
      kitchenBath: {
        title: "Cuisines et salles de bain",
        desc: "Des rénovations de cuisines et salles de bain modernes et fonctionnelles, adaptées à votre budget et à votre style.",
      },
      interior: {
        title: "Rénovations intérieures",
        desc: "Chambres, salons, bureaux — des rénovations complètes pour toute pièce et tout espace intérieur.",
      },
      basements: {
        title: "Transformations de sous-sol",
        desc: "Transformations complètes de sous-sol, d'un espace non aménagé à de belles pièces habitables.",
      },
      repairs: {
        title: "Petites réparations et agencement de couleurs",
        desc: "Réparations locales économiques avec un agencement de couleurs précis qui se fond parfaitement dans le fini existant.",
      },
    },
  },
  howItWorks: {
    title: "Comment ça fonctionne",
    subtitle: "Un processus simple et transparent, du premier appel à la visite finale.",
    stepLabel: "Étape",
    steps: {
      inspection: { title: "Inspection", desc: "Nous évaluons la propriété et l'étendue des travaux, en personne ou par photos." },
      estimate: { title: "Estimation", desc: "Vous recevez une estimation claire et détaillée, sans surprise cachée." },
      approval: { title: "Approbation", desc: "Nous planifions les travaux une fois que vous et/ou votre assureur avez donné votre accord." },
      completion: { title: "Réalisation", desc: "Notre équipe termine les travaux à temps, avec une visite finale." },
    },
  },
  ctaBand: {
    title: "Prêt à commencer votre projet?",
    subtitle: "Obtenez une estimation approximative en quelques minutes avec notre outil d'estimation instantanée, ou appelez-nous directement.",
    ctaEstimate: "Estimation instantanée",
    ctaCall: "Appelez maintenant",
  },
  testimonials: {
    title: "Ce que disent nos clients",
    googleReview: "Avis Google",
    items: [
      {
        name: "Anahid Vardanian",
        rating: 5,
        quote:
          "Meilleure entreprise de rénovation ! Ils ont refait toute ma salle de bain il y a une semaine. Je suis très satisfaite des résultats ! Équipe très professionnelle ! Je recommande vivement.",
      },
      {
        name: "Naira Shukuryan",
        rating: 5,
        quote:
          "Nous sommes extrêmement satisfaits de la rénovation complète de notre salle de bain. L'équipe a été professionnelle, ponctuelle et très minutieuse du début à la fin. Le chantier est toujours resté propre et le résultat final est magnifique.",
      },
      {
        name: "Firdaous Dahha",
        rating: 5,
        quote:
          "Excellent service ! L'équipe de Renovision AnA a réparé mon sous-sol avec beaucoup de professionnalisme. Les travaux ont été réalisés avec soin, le chantier est resté propre tout au long du projet et le résultat est impeccable.",
      },
      {
        name: "Gilbert Aoun",
        rating: 5,
        quote:
          "Très bon prix et très efficace ils ont fait du bon travail dans mes toilettes je le recommande fortement.",
      },
      {
        name: "Frederic Aoun",
        rating: 5,
        quote:
          "Excellent service ! Équipe professionnelle, travail de grande qualité, tout terminé à temps. Je recommande vivement !",
      },
    ],
  },
  partners: {
    title: "Ils nous font confiance",
  },
  footer: {
    tagline: "Rénovation et restauration de dégâts d'eau en qui vous pouvez avoir confiance.",
    quickLinks: "Liens rapides",
    explore: "Explorer",
    contactUs: "Nous joindre",
    followUs: "Suivez-nous",
    viewOnMap: "Voir sur la carte",
    rights: "Tous droits réservés.",
  },
  chat: {
    launcherLabel: "Estimation gratuite",
    title: "Vision IA",
    subtitle: "Obtenez une estimation approximative en quelques minutes",
    welcome:
      "Bonjour, je suis Vision IA de Renovision AnA! Je peux vous donner une estimation approximative pour votre projet de rénovation, de dégâts d'eau ou de remodelage. Que souhaitez-vous faire?",
    placeholder: "Écrivez votre message...",
    uploadLabel: "Joindre une photo",
    disclaimer:
      "Vision IA est un outil d'estimation automatisé qui ne traite que des sujets liés à la rénovation, aux dégâts d'eau et au remodelage.",
    offTopic:
      "Je ne peux vous aider qu'avec des questions sur la rénovation, la restauration de dégâts d'eau et le remodelage pour Renovision AnA. Pouvez-vous m'en dire plus sur votre projet?",
    restart: "Recommencer",
    send: "Envoyer",
    photoAttached: "Photo jointe",
    removePhoto: "Retirer",
    skip: "Passer",
    projectType: {
      question: "Quel type de projet souhaitez-vous réaliser?",
      waterDamage: "Réparation de dégâts d'eau",
      flooring: "Revêtement de sol",
      kitchenBath: "Rénovation cuisine / salle de bain",
      interior: "Rénovation intérieure",
      basements: "Transformation de sous-sol",
      repairs: "Petite réparation / agencement de couleurs",
    },
    size: {
      question: "Quelle est approximativement l'ampleur du projet?",
      small: "Petit (une seule pièce)",
      medium: "Moyen (plusieurs pièces)",
      large: "Grand (unité ou étage complet)",
    },
    tier: {
      question: "Quel niveau de qualité recherchez-vous?",
      standard: "Standard",
      premium: "Premium",
      luxury: "Luxe",
    },
    photo: {
      question: "Vous pouvez joindre une photo de l'espace pour affiner l'estimation (facultatif).",
    },
    estimate: {
      intro: "D'après ce que vous avez partagé, voici une fourchette d'estimation approximative :",
      disclaimer:
        "Il s'agit d'une approximation automatisée, non d'une soumission finale. Le prix final dépend d'une inspection en personne ou par photos.",
    },
    leadCapture: {
      intro: "Pour vous envoyer une soumission plus précise, pourriez-vous partager quelques détails?",
      name: "Nom complet",
      phone: "Numéro de téléphone",
      email: "Adresse courriel",
      submit: "Envoyer ma soumission",
      later: "Peut-être plus tard",
      success: "Merci! Un membre de notre équipe vous enverra sous peu votre soumission détaillée.",
    },
  },
};

export const translations = { en, fr } satisfies Record<Locale, typeof en>;

export type TranslationShape = typeof en;
