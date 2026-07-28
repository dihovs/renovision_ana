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
    overallRatingLabel: (ratingText: string, count: number) => string;
    items: Array<{ name: string; rating: number; quote: string }>;
  };
  partners: { title: string; primePartner: string };
  footer: Record<string, string>;
  chat: {
    launcherLabel: string;
    title: string;
    subtitle: string;
    welcome: string;
    placeholder: string;
    uploadLabel: string;
    photoHint: string;
    disclaimer: string;
    offTopic: string;
    restart: string;
    send: string;
    photoAttached: string;
    removePhoto: string;
    skip: string;
    track: Record<"question" | "handyman" | "renovation", string>;
    handyman: Record<
      | "intro"
      | "hoursLabel"
      | "minimumNote"
      | "materialsNote"
      | "labourLabel"
      | "calculate"
      | "estimateIntro"
      | "postalCodeLabel"
      | "postalCodePlaceholder"
      | "postalCodeAutoCorrected"
      | "checkTripFee"
      | "checking"
      | "tripFeeLabel"
      | "tripFeeFree"
      | "tripFeeTrafficNote"
      | "tripFeeError"
      | "tripFeeNotConfigured"
      | "minDriveSuffix"
      | "estimatedTotalLabel",
      string
    >;
    projectType: Record<
      "question" | "waterDamage" | "flooring" | "kitchenBath" | "interior" | "basements" | "repairs",
      string
    >;
    size: Record<"question" | "small" | "medium" | "large", string>;
    tier: Record<"question" | "standard" | "premium" | "luxury", string>;
    photo: Record<"question", string>;
    estimate: Record<"intro" | "disclaimer", string>;
    leadCapture: Record<
      | "intro"
      | "questionsPrompt"
      | "getDetails"
      | "name"
      | "phone"
      | "email"
      | "address"
      | "consent"
      | "submit"
      | "later"
      | "success",
      string
    >;
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
    overallRatingLabel: (ratingText, count) => `${ratingText} based on ${count} Google reviews`,
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
      {
        name: "Tatoul Tatoian",
        rating: 5,
        quote:
          "We hired Renovision AnA to completely renovate our basement, and from the first estimate to the final walkthrough, the experience was 5-star all the way. Their team was professional, on time, and clearly took pride in their work. They handled everything: framing, electrical, plumbing, insulation, drywall, flooring, lighting, and finishing touches.",
      },
      {
        name: "MissArmine",
        rating: 5,
        quote:
          "Renovision AnA renovated my parents' basement completely. What a beautiful job they did! They are super meticulous and detailed and very professional! Artush was beyond helpful with all recommendations and we trusted him with everything from A-Z. My family is very satisfied with the job their team did. I 100% recommend them for all your renovation projects.",
      },
      {
        name: "Sabrina Mohamed",
        rating: 5,
        quote:
          "Excellent experience! The team was professional, reliable, and did an amazing job on our bathroom renovation. The quality of the work exceeded our expectations, and we couldn't be happier with the final result. Highly recommend!",
      },
      {
        name: "Louso S",
        rating: 5,
        quote:
          "We recently had our parents' basement and bathroom renovated, and we couldn't be happier with the results. From start to finish, the team was professional, reliable, and paid close attention to every detail. The quality of the workmanship exceeded our expectations, and they kept the project organized and communicated with us throughout the entire process.",
      },
      {
        name: "Mariia Voropai",
        rating: 5,
        quote: "Very good services, totally recommend!",
      },
      {
        name: "Lianne Sargsyan",
        rating: 5,
        quote:
          "They did a fantastic job; after 20 years, I can finally enjoy my basement. Maria demonstrated great professionalism and skill; my basement is unrecognizable.",
      },
    ],
  },
  partners: {
    title: "Trusted By",
    primePartner: "Prime Partner",
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
    launcherLabel: "Get an Instant Estimate",
    title: "Vision AI",
    subtitle: "Get a rough project estimate in minutes",
    welcome:
      "Hi, I'm Vision AI from Renovision AnA! I can give you a rough estimate for your project. First, let's figure out what kind of help you need.",
    placeholder: "Type your message...",
    uploadLabel: "Attach a photo",
    photoHint: "Tip: attach a photo (📎) for a more accurate estimate — optional.",
    disclaimer:
      "Vision AI is an automated estimate tool and only discusses renovation, water damage, and remodeling topics.",
    offTopic:
      "I'm just able to help with renovation, water damage restoration, and remodeling questions for Renovision AnA. Could you tell me more about your project?",
    restart: "Start over",
    send: "Send",
    photoAttached: "Photo attached",
    removePhoto: "Remove",
    skip: "Skip",
    track: {
      question: "What do you need help with?",
      handyman: "Handyman Services",
      renovation: "Full Renovation / Water Damage Restoration",
    },
    handyman: {
      intro:
        "Handyman work is billed at $80/hour with a 2-hour minimum, and materials are billed separately at cost (they're not included in this estimate). Use the calculator below to get a rough labour cost — roughly how many hours do you think the job will take?",
      hoursLabel: "Estimated hours",
      minimumNote: "2-hour minimum applies.",
      materialsNote: "Materials billed separately, at cost — not included in this estimate.",
      labourLabel: "Estimated labour",
      calculate: "Get this estimate",
      estimateIntro: "Here's your estimated labour cost:",
      postalCodeLabel: "Postal code (for your trip fee)",
      postalCodePlaceholder: "e.g. H7N 2A3",
      postalCodeAutoCorrected: "Adjusted to a valid format — Canadian postal codes use 0/1, not the letters O/I.",
      checkTripFee: "Check trip fee",
      checking: "Checking…",
      tripFeeLabel: "Trip fee",
      tripFeeFree: "You're within our free travel zone — no trip fee.",
      tripFeeTrafficNote: "Includes a current-traffic adjustment.",
      tripFeeError: "Couldn't calculate a trip fee for that postal code — we'll confirm it when we call you.",
      tripFeeNotConfigured: "Trip fee: to be confirmed when we call you.",
      minDriveSuffix: "min drive",
      estimatedTotalLabel: "Estimated total (labour + trip fee)",
    },
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
      questionsPrompt:
        "Any questions about this estimate? Ask away — or when you're ready, tap below to book your free in-person visit and get an exact, guaranteed quote.",
      getDetails: "Book my free in-person estimate",
      intro: "Let's book your free in-person visit for an exact quote:",
      name: "Full name",
      phone: "Phone number",
      email: "Email address",
      address: "Address (optional — helps us refine pricing)",
      consent: "Send me occasional tips and promotions from Renovision AnA.",
      submit: "Book my free visit",
      later: "Maybe later",
      success: "Thanks! A confirmation email is on its way, and a member of our team will reach out shortly to schedule your free in-person visit.",
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
    overallRatingLabel: (ratingText, count) => `${ratingText} basé sur ${count} avis Google`,
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
      {
        name: "Tatoul Tatoian",
        rating: 5,
        quote:
          "Nous avons engagé Renovision AnA pour rénover complètement notre sous-sol, et de la première estimation à la visite finale, l'expérience a été exceptionnelle du début à la fin. Leur équipe a été professionnelle, ponctuelle et a clairement mis un point d'honneur à bien faire le travail. Ils se sont occupés de tout : charpente, électricité, plomberie, isolation, gypse, plancher, éclairage et finitions.",
      },
      {
        name: "MissArmine",
        rating: 5,
        quote:
          "Renovision AnA a complètement rénové le sous-sol de mes parents. Quel beau travail ! Ils sont super méticuleux, minutieux et très professionnels ! Artush nous a énormément aidés avec ses recommandations et nous lui avons fait confiance de A à Z. Ma famille est très satisfaite du travail de leur équipe. Je les recommande à 100 % pour tous vos projets de rénovation.",
      },
      {
        name: "Sabrina Mohamed",
        rating: 5,
        quote:
          "Expérience excellente ! L'équipe a été professionnelle, fiable, et a fait un travail incroyable dans la rénovation de notre salle de bain. La qualité du travail a dépassé nos attentes et nous sommes ravis du résultat final. Je recommande vivement !",
      },
      {
        name: "Louso S",
        rating: 5,
        quote:
          "Nous avons récemment fait rénover le sous-sol et la salle de bain de nos parents, et nous sommes ravis du résultat. Du début à la fin, l'équipe a été professionnelle, fiable, et très attentive aux détails. La qualité du travail a dépassé nos attentes, et ils ont gardé le projet bien organisé en communiquant avec nous tout au long du processus.",
      },
      {
        name: "Mariia Voropai",
        rating: 5,
        quote: "Très bons services, je recommande totalement !",
      },
      {
        name: "Lianne Sargsyan",
        rating: 5,
        quote:
          "Ils ont fait un travail fantastique ; après 20 ans, je peux enfin profiter de mon sous-sol. Maria a fait preuve d'un grand professionnalisme et d'un vrai savoir-faire ; mon sous-sol est méconnaissable.",
      },
    ],
  },
  partners: {
    title: "Ils nous font confiance",
    primePartner: "Partenaire Privilégié",
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
    launcherLabel: "Estimation instantanée",
    title: "Vision IA",
    subtitle: "Obtenez une estimation approximative en quelques minutes",
    welcome:
      "Bonjour, je suis Vision IA de Renovision AnA! Je peux vous donner une estimation approximative pour votre projet. D'abord, voyons de quel type d'aide vous avez besoin.",
    placeholder: "Écrivez votre message...",
    uploadLabel: "Joindre une photo",
    photoHint: "Astuce : joignez une photo (📎) pour une estimation plus précise — facultatif.",
    disclaimer:
      "Vision IA est un outil d'estimation automatisé qui ne traite que des sujets liés à la rénovation, aux dégâts d'eau et au remodelage.",
    offTopic:
      "Je ne peux vous aider qu'avec des questions sur la rénovation, la restauration de dégâts d'eau et le remodelage pour Renovision AnA. Pouvez-vous m'en dire plus sur votre projet?",
    restart: "Recommencer",
    send: "Envoyer",
    photoAttached: "Photo jointe",
    removePhoto: "Retirer",
    skip: "Passer",
    track: {
      question: "De quel type d'aide avez-vous besoin?",
      handyman: "Services de bricolage (handyman)",
      renovation: "Rénovation complète / dégâts d'eau",
    },
    handyman: {
      intro:
        "Les travaux de bricolage sont facturés 80 $/heure, avec un minimum de 2 heures, et les matériaux sont facturés séparément, au coût réel (ils ne sont pas inclus dans cette estimation). Utilisez la calculatrice ci-dessous pour obtenir un coût de main-d'œuvre approximatif — environ combien d'heures pensez-vous que ce travail prendra?",
      hoursLabel: "Heures estimées",
      minimumNote: "Un minimum de 2 heures s'applique.",
      materialsNote: "Matériaux facturés séparément, au coût réel — non inclus dans cette estimation.",
      labourLabel: "Main-d'œuvre estimée",
      calculate: "Obtenir cette estimation",
      estimateIntro: "Voici votre coût de main-d'œuvre estimé :",
      postalCodeLabel: "Code postal (pour vos frais de déplacement)",
      postalCodePlaceholder: "ex. H7N 2A3",
      postalCodeAutoCorrected:
        "Ajusté au format valide — les codes postaux canadiens utilisent 0/1, et non les lettres O/I.",
      checkTripFee: "Vérifier les frais de déplacement",
      checking: "Vérification…",
      tripFeeLabel: "Frais de déplacement",
      tripFeeFree: "Vous êtes dans notre zone de déplacement gratuite — aucuns frais.",
      tripFeeTrafficNote: "Inclut un ajustement selon la circulation actuelle.",
      tripFeeError:
        "Impossible de calculer les frais de déplacement pour ce code postal — nous les confirmerons lors de notre appel.",
      tripFeeNotConfigured: "Frais de déplacement : à confirmer lors de notre appel.",
      minDriveSuffix: "min de route",
      estimatedTotalLabel: "Total estimé (main-d'œuvre + déplacement)",
    },
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
      questionsPrompt:
        "Des questions sur cette estimation? N'hésitez pas — ou, quand vous êtes prêt, appuyez ci-dessous pour réserver votre visite gratuite sur place et obtenir un prix exact et garanti.",
      getDetails: "Réserver ma visite gratuite sur place",
      intro: "Réservons votre visite gratuite sur place pour un prix exact :",
      name: "Nom complet",
      phone: "Numéro de téléphone",
      email: "Adresse courriel",
      address: "Adresse (facultatif — aide à préciser le prix)",
      consent: "Envoyez-moi des conseils et promotions de Renovision AnA à l'occasion.",
      submit: "Réserver ma visite gratuite",
      later: "Peut-être plus tard",
      success: "Merci! Un courriel de confirmation s'en vient, et un membre de notre équipe communiquera avec vous sous peu pour planifier votre visite gratuite.",
    },
  },
};

export const translations = { en, fr } satisfies Record<Locale, typeof en>;

export type TranslationShape = typeof en;
