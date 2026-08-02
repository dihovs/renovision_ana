// FAQ copy for the /estimation landing page, shared between:
//   - src/components/pages/EstimatorContent.tsx (renders it, client component)
//   - src/app/[lang]/estimation/page.tsx (builds FAQPage JSON-LD from it,
//     server component)
//
// This lives in its own plain module rather than inside EstimatorContent.tsx
// because a "use client" file's named exports get proxied for the RSC
// client-reference boundary in this Next.js fork — a server component
// importing a named (non-component) export from a client file got back a
// reference object instead of the array, breaking `.map()` at build time.
// Keeping the data in a plain module and importing it from both sides avoids
// that boundary entirely, matching how src/lib/serviceAreas.ts feeds both the
// content component and the page's FAQPage schema on the service-area routes.
//
// Also keep this the single source for each language's FAQ so the JSON-LD
// Google indexes never drifts from what that language's visitor actually
// reads — the service-area pages had a bug where FAQ schema was built from
// English strings while French was the served content. Now that English has
// its own URL under /en, both halves need the same treatment.
export type EstimatorFaqItem = { q: string; a: string };

export const estimatorFaqEn: EstimatorFaqItem[] = [
  {
    q: "Is this the final price I'll be quoted?",
    a: "No — and that's deliberate. Think of the estimate as a data-driven preview built on our real price list, not a confirmed bid. It gives you an honest order of magnitude before the first call. Artush confirms the final price once he's seen the project in person — some conditions only show up on site.",
  },
  {
    q: "What does the estimate include and exclude?",
    a: "It prices labour and materials for every stage of the work you describe — demolition, prep, installation, finishing. Licensed plumbing and electrical work, and finish materials you supply yourself (tile, faucets, appliances), are shown as separate line items instead of being guessed at.",
  },
  {
    q: "Is it really free, and do I have to give my contact information?",
    a: "The estimate itself is free and needs no credit card. You can explore pricing without leaving anything behind. To get the full breakdown by email or a callback from Artush, we'll ask for a name and a way to reach you — never before.",
  },
  {
    q: "How long does it take?",
    a: "A few minutes. Describe your project, answer whatever clarifying questions the assistant asks, and the itemized range shows up on screen.",
  },
  {
    q: "What happens after I finish my estimate?",
    a: "If you choose to leave your contact information, Artush receives your estimate and any photos you added, then calls you back to confirm the price — often the same day. If you'd rather just look at the numbers, nothing is sent to anyone.",
  },
  {
    q: "Can the price change after an in-person visit?",
    a: "Yes — and it would with any honest contractor. An opened wall can reveal mould, a floor can hide a subfloor that needs replacing. The range is built on what you describe; Artush confirms the final number once those details are verified on site.",
  },
  {
    q: "What happens to my photos?",
    a: "They're used only to assess the work more accurately, and they're stored on our servers in Quebec.",
  },
];

export const estimatorFaqFr: EstimatorFaqItem[] = [
  {
    q: "Est-ce le prix final que je vais payer?",
    a: "Non — et c'est voulu. Voyez l'estimation comme un aperçu chiffré basé sur des données réelles, pas comme une soumission confirmée. Elle vous donne un ordre de grandeur honnête, construit sur notre vraie liste de prix, avant même le premier appel. Le prix final est confirmé par Artush une fois le projet vu en personne — certaines conditions ne se découvrent qu'une fois sur place.",
  },
  {
    q: "Qu'est-ce que l'estimation inclut et exclut?",
    a: "Elle chiffre la main-d'œuvre et les matériaux pour chaque étape des travaux que vous décrivez — démolition, préparation, installation, finition. La plomberie et l'électricité sous licence, ainsi que les matériaux de finition que vous fournissez vous-même (céramique, robinetterie, électroménagers), sont indiqués comme des postes séparés plutôt qu'estimés à l'aveugle.",
  },
  {
    q: "Est-ce vraiment gratuit et dois-je laisser mes coordonnées?",
    a: "L'estimation elle-même est gratuite et ne demande aucune carte de crédit. Vous pouvez explorer les prix sans rien laisser. Pour recevoir le détail complet par courriel ou être rappelé par Artush, on vous demande un nom et un moyen de vous joindre — jamais avant.",
  },
  {
    q: "Combien de temps ça prend?",
    a: "Quelques minutes. Décrivez votre projet, répondez aux questions de précision que l'assistant pose au besoin, et la fourchette détaillée apparaît à l'écran.",
  },
  {
    q: "Qu'arrive-t-il après avoir terminé mon estimation?",
    a: "Si vous choisissez de laisser vos coordonnées, Artush reçoit votre estimation et les photos ajoutées, puis vous rappelle pour confirmer le prix — souvent le jour même. Si vous préférez seulement consulter les chiffres, rien n'est envoyé à personne.",
  },
  {
    q: "Le prix peut-il changer après une visite en personne?",
    a: "Oui, et c'est le cas avec tout entrepreneur honnête. Un mur ouvert peut révéler de la moisissure, un plancher peut cacher un sous-plancher à refaire. La fourchette est bâtie sur ce que vous décrivez; Artush confirme le prix final une fois ces éléments vérifiés sur place.",
  },
  {
    q: "Qu'arrive-t-il à mes photos?",
    a: "Elles servent uniquement à évaluer les travaux plus précisément et sont conservées sur nos serveurs au Québec.",
  },
];
