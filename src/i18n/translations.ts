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
    steps: Record<"inspection" | "estimate" | "approval" | "completion", { title: string; desc: string }>;
  };
  testimonials: { title: string };
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
    projectType: Record<"question" | "renovations" | "waterDamage" | "kitchenBath", string>;
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
  },
  stats: {
    years: { value: "15+", label: "Years of Experience" },
    projects: { value: "500+", label: "Projects Completed" },
    satisfaction: { value: "98%", label: "Client Satisfaction" },
    emergency: { value: "24/7", label: "Emergency Response" },
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
    steps: {
      inspection: { title: "Inspection", desc: "We assess the property and scope of work in person or via photos." },
      estimate: { title: "Estimate", desc: "You receive a clear, itemized estimate with no hidden surprises." },
      approval: { title: "Approval", desc: "We schedule the work once you and/or your insurer sign off." },
      completion: { title: "Completion", desc: "Our crew completes the job on time, with a final walkthrough." },
    },
  },
  testimonials: {
    title: "What Our Clients Say",
  },
  partners: {
    title: "Trusted By",
  },
  footer: {
    tagline: "Renovation and water damage restoration you can trust.",
    quickLinks: "Quick Links",
    contactUs: "Contact Us",
    rights: "All rights reserved.",
  },
  chat: {
    launcherLabel: "Get a Free Estimate",
    title: "Renovision AnA Assistant",
    subtitle: "Get a rough project estimate in minutes",
    welcome:
      "Hi! I can give you a rough estimate for your renovation, water damage, or remodeling project. What are you looking to have done?",
    placeholder: "Type your message...",
    uploadLabel: "Attach a photo",
    disclaimer:
      "This is an automated estimate tool and only discusses renovation, water damage, and remodeling topics.",
    offTopic:
      "I'm just able to help with renovation, water damage restoration, and remodeling questions for Renovision AnA. Could you tell me more about your project?",
    restart: "Start over",
    send: "Send",
    photoAttached: "Photo attached",
    removePhoto: "Remove",
    skip: "Skip",
    projectType: {
      question: "What type of project are you looking to have done?",
      renovations: "Renovation",
      waterDamage: "Water Damage Repair",
      kitchenBath: "Kitchen / Bath Remodel",
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
  },
  stats: {
    years: { value: "15+", label: "Années d'expérience" },
    projects: { value: "500+", label: "Projets réalisés" },
    satisfaction: { value: "98%", label: "Satisfaction client" },
    emergency: { value: "24/7", label: "Intervention d'urgence" },
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
    steps: {
      inspection: { title: "Inspection", desc: "Nous évaluons la propriété et l'étendue des travaux, en personne ou par photos." },
      estimate: { title: "Estimation", desc: "Vous recevez une estimation claire et détaillée, sans surprise cachée." },
      approval: { title: "Approbation", desc: "Nous planifions les travaux une fois que vous et/ou votre assureur avez donné votre accord." },
      completion: { title: "Réalisation", desc: "Notre équipe termine les travaux à temps, avec une visite finale." },
    },
  },
  testimonials: {
    title: "Ce que disent nos clients",
  },
  partners: {
    title: "Ils nous font confiance",
  },
  footer: {
    tagline: "Rénovation et restauration de dégâts d'eau en qui vous pouvez avoir confiance.",
    quickLinks: "Liens rapides",
    contactUs: "Nous joindre",
    rights: "Tous droits réservés.",
  },
  chat: {
    launcherLabel: "Estimation gratuite",
    title: "Assistant Renovision AnA",
    subtitle: "Obtenez une estimation approximative en quelques minutes",
    welcome:
      "Bonjour! Je peux vous donner une estimation approximative pour votre projet de rénovation, de dégâts d'eau ou de remodelage. Que souhaitez-vous faire?",
    placeholder: "Écrivez votre message...",
    uploadLabel: "Joindre une photo",
    disclaimer:
      "Cet outil d'estimation automatisé ne traite que des sujets liés à la rénovation, aux dégâts d'eau et au remodelage.",
    offTopic:
      "Je ne peux vous aider qu'avec des questions sur la rénovation, la restauration de dégâts d'eau et le remodelage pour Renovision AnA. Pouvez-vous m'en dire plus sur votre projet?",
    restart: "Recommencer",
    send: "Envoyer",
    photoAttached: "Photo jointe",
    removePhoto: "Retirer",
    skip: "Passer",
    projectType: {
      question: "Quel type de projet souhaitez-vous réaliser?",
      renovations: "Rénovation",
      waterDamage: "Réparation de dégâts d'eau",
      kitchenBath: "Rénovation cuisine / salle de bain",
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
