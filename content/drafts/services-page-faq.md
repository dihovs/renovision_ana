# Services Page — FAQ Section Content

**Target:** Add to `/services` (the main services listing page) as a FAQ section below the service card grid.

**Format:** Same Q&A pattern as all other pages — visible FAQ section + matching FAQPage schema in the page.tsx server component.

**Rationale:** The /services page ranks for discovery queries like "rénovation Laval" and "services après sinistre Montréal." FAQ content here captures broad PAA questions that don't belong to a single service page.

---

## FR

Questions:

1. "Quels sont vos délais d'intervention pour un dégât d'eau ?"
   Notre ligne est répondue 24/7. Pour une urgence dégât d'eau à Laval ou Montréal, on envoie une équipe le jour même. Le délai dépend de la distance, mais on priorise toujours les appels d'urgence.

2. "Travaillez-vous avec mon assureur ?"
   Oui. Nous documentons les dégâts avec photos et relevés d'humidité dès la première visite, et fournissons une portée écrite que votre expert en sinistre peut traiter sans appel de suivi. Nous ne décidons pas ce que votre police couvre, mais nous faisons en sorte que votre dossier contienne tout ce qu'il faut.

3. "Offrez-vous une garantie sur vos travaux ?"
   Oui. Chaque projet est accompagné d'une garantie écrite d'un an sur la main-d'œuvre. L'assurance responsabilité civile est en vigueur sur chaque chantier, avec attestations disponibles sur demande.

4. "Desservez-vous tout Laval et Montréal ?"
   Oui. Nous couvrons l'ensemble de Laval (Chomedey, Sainte-Rose, Vimont, Fabreville, Duvernay, Laval-des-Rapides, Pont-Viau) et plusieurs secteurs de Montréal (Ahuntsic-Cartierville, Saint-Laurent, Montréal-Nord, LaSalle) ainsi que Terrebonne et la Rive-Nord. Chaque secteur a ses particularités — nous adaptons nos méthodes à son type de construction.

5. "Faites-vous aussi la rénovation sans lien avec un sinistre ?"
   Oui. Nous faisons des rénovations intérieures complètes : cuisines, salles de bain, sous-sols, planchers, gypse, peinture. Tout ce qui se trouve à l'intérieur des murs.

---

## EN

Questions:

1. "How fast can you respond to a water damage emergency?"
   Our line is answered 24/7. For a water damage emergency in Laval or Montreal, we dispatch a crew the same day. Response time depends on distance, but emergency calls are always prioritized.

2. "Do you work with my insurance company?"
   Yes. We document damage with photos and moisture readings from the first visit and provide a written scope your adjuster can process without a follow-up call. We don't decide what your policy covers, but we make sure your file has everything it needs.

3. "Do you offer a warranty on your work?"
   Yes. Every project comes with a one-year written workmanship warranty. General liability insurance is in place on every job, with certificates available on request.

4. "Do you serve all of Laval and Montreal?"
   Yes. We cover all of Laval (Chomedey, Sainte-Rose, Vimont, Fabreville, Duvernay, Laval-des-Rapides, Pont-Viau) and several Montreal sectors (Ahuntsic-Cartierville, Saint-Laurent, Montréal-Nord, LaSalle) as well as Terrebonne and the North Shore. Each sector has its own housing characteristics — we adapt our methods to the construction type.

5. "Do you also do renovations that aren't linked to a disaster?"
   Yes. We do full interior renovations: kitchens, bathrooms, basements, flooring, drywall, painting. Everything inside the walls.

---

## Implementation instructions for developer

For the /services page:
1. Add the FAQ items to `serviceFaq.ts` as `SERVICES_PAGE_FAQ` export (optional — can also be local to the page component)
2. In `src/app/[lang]/services/page.tsx`, add a second `<script type="application/ld+json">` for the FAQPage schema
3. In `src/components/pages/ServicesContent.tsx`, add a FAQ section after the card grid, following the same markup as ServiceDetailContent (lines 277-296 of that component)

The FAQ schema should match the visible text exactly.