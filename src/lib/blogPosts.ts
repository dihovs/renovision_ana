export type BlogPostSection =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "stats"; items: { value: string; label: string }[] }
  | { type: "linkParagraph"; text: string; linkText: string; href: string };

export type BlogPostLocaleContent = {
  title: string;
  excerpt: string;
  metaDescription: string;
  sections: BlogPostSection[];
};

export type BlogPost = {
  slug: string;
  categoryTag: { en: string; fr: string };
  publishedAt: string; // ISO date
  readTimeMinutes: number;
  /** Real photo, preferred when present. */
  heroImage?: string;
  /** Designed stat graphic — fallback for posts with no photo yet. */
  heroStat: { value: string; label: { en: string; fr: string } };
  en: BlogPostLocaleContent;
  fr: BlogPostLocaleContent;
};

/** `publishedAt` is a bare YYYY-MM-DD date with no time zone. `new Date(iso)`
 * parses that as UTC midnight, so formatting it in a zone behind UTC (e.g.
 * Quebec) rolls it back to the previous day. Parse the parts as local instead. */
export function parseBlogDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export const blogPosts: BlogPost[] = [
  {
    slug: "bathroom-renovation-roi-laval-montreal",
    categoryTag: {
      en: "Bathroom Renovation · Market Trends",
      fr: "Rénovation de salle de bain · Tendances du marché",
    },
    publishedAt: "2026-07-22",
    readTimeMinutes: 6,
    heroImage: "/images/blog/bathroom-renovation-roi-hero.jpeg",
    heroStat: {
      value: "+16%",
      label: {
        en: "Average home value increase from a bathroom renovation (Royal LePage)",
        fr: "Hausse moyenne de la valeur d'une maison grâce à une rénovation de salle de bain (Royal LePage)",
      },
    },
    en: {
      title: "Bathroom Renovations and Home Value: What Laval & Montreal Homeowners Should Know",
      excerpt:
        "A well-planned bathroom renovation is one of the highest-return projects you can do to a home — here's what the latest Canadian data says, and what it actually means in dollars for Laval and Montreal.",
      metaDescription:
        "See what recent Royal LePage and RE/MAX data says about bathroom renovation ROI, and what a 16% value increase looks like in dollar terms for homes in Laval and Montreal.",
      sections: [
        {
          type: "paragraph",
          text: "If you're weighing which renovation to tackle first, the numbers keep pointing to the same room: the bathroom. National data from two of Canada's largest brokerages puts bathrooms among the top three renovations for return on investment — and in a Quebec market that's becoming more selective, a dated bathroom is often the first thing that gives a buyer pause.",
        },
        { type: "heading", text: "What the numbers say" },
        {
          type: "paragraph",
          text: "Royal LePage's Home Renovation ROI Report found that a bathroom renovation can increase a home's value by an average of 16% — behind only kitchens (20%) and ahead of finished basements (15%) and outdoor living spaces (10%). Separately, RE/MAX Canada estimates that a well-executed bathroom renovation recoups roughly 50 to 85% of its cost at resale, averaging around 62%, and reports that bathrooms ranked among the top three ROI renovations in 17 housing markets across the country, including Toronto and Vancouver.",
        },
        {
          type: "stats",
          items: [
            { value: "16%", label: "Average home value increase from a bathroom renovation — Royal LePage" },
            { value: "50–85%", label: "Renovation cost recouped at resale — RE/MAX Canada" },
            { value: "Top 3", label: "Bathrooms rank among the top 3 ROI renovations nationally" },
          ],
        },
        { type: "heading", text: "What that looks like in Laval and Montreal" },
        {
          type: "paragraph",
          text: "Applied to local numbers, that 16% is real money. The median price of a single-family home in Laval sits around $580,000 in 2026 — a 16% lift is roughly $93,000 in added value. In Montreal, where the median single-family home runs closer to $797,000, the same 16% works out to about $127,000. These are directional averages, not guarantees — the actual return depends on your neighbourhood, the quality of the work, and the state of your bathroom before you start — but they show why this particular project keeps showing up at the top of renovation-ROI lists.",
        },
        { type: "heading", text: "What a bathroom renovation actually costs here" },
        {
          type: "paragraph",
          text: "In Quebec, a full bathroom renovation typically runs $16,000 to $55,000, with most homeowners landing between $20,000 and $25,000 for a complete redo — new tile, vanity, tub or shower, plumbing, and lighting. A lighter refresh (paint, a new vanity, updated fixtures and accessories) can run as little as $5,000 to $12,000. RE/MAX's data suggests the sweet spot for resale value is the middle of that range: a $15,000–$35,000 renovation with a new vanity, modern tile, updated fixtures, and improved lighting tends to return 70–85% of its cost — often outperforming ultra-premium, highly customized builds.",
        },
        { type: "heading", text: "Why bathrooms matter more in today's market" },
        {
          type: "paragraph",
          text: "Quebec's real estate market is moderating in 2026 after several exceptionally active years, and the province's real estate brokers association (APCIQ) reports buyers acting with more caution and selectivity, particularly for single-family homes. In a market like that, a renovated bathroom does double duty: it adds resale value, and it removes one of the easiest reasons for a cautious buyer to walk away or negotiate the price down. If your renovation also touches ventilation, insulation, or heating, it's worth checking whether it qualifies for provincial programs like Rénoclimat or the Canada Greener Homes Loan — they won't fund a purely cosmetic refresh, but they can offset the cost of the mechanical upgrades that often go along with a full remodel.",
        },
        { type: "heading", text: "Getting the most out of your investment" },
        {
          type: "list",
          items: [
            "Prioritize the vanity, tile, fixtures, and lighting — RE/MAX's data shows this combination drives most of the resale return.",
            "Stay in the mid-range. A $15,000–$35,000 renovation historically recoups more of its cost, percentage-wise, than an ultra-premium build.",
            "Choose finishes a broad range of buyers will like, not just what suits your own taste — neutral, timeless choices hold value better at resale.",
            "Keep documentation. Photos, permits, and receipts support both a future sale and any insurance claim if water damage is ever involved.",
            "If you're renovating after water damage, make sure the underlying issue is fixed first — cosmetic work on top of a moisture problem won't hold its value.",
          ],
        },
        {
          type: "paragraph",
          text: "Whether you're renovating to enjoy the space yourselves or preparing to sell in the next few years, a bathroom renovation remains one of the more reliable ways to put money back into your home. Renovision AnA plans and builds kitchen and bathroom remodels across Laval and Montreal, from a quick refresh to a full gut renovation — get a rough estimate in minutes with our chat tool, or give us a call.",
        },
      ],
    },
    fr: {
      title:
        "Rénovation de salle de bain et valeur immobilière : ce que les propriétaires de Laval et Montréal devraient savoir",
      excerpt:
        "Une rénovation de salle de bain bien planifiée est l'un des projets les plus rentables pour une maison — voici ce que disent les données canadiennes récentes, et ce que cela représente concrètement en dollars pour Laval et Montréal.",
      metaDescription:
        "Découvrez ce que les données récentes de Royal LePage et RE/MAX révèlent sur le rendement d'une rénovation de salle de bain, et ce qu'une hausse de valeur de 16 % représente pour les propriétés de Laval et Montréal.",
      sections: [
        {
          type: "paragraph",
          text: "Si vous hésitez sur la rénovation à entreprendre en premier, les chiffres pointent constamment vers la même pièce : la salle de bain. Les données nationales de deux des plus grandes bannières immobilières au Canada placent la salle de bain parmi les trois rénovations offrant le meilleur rendement — et dans un marché québécois qui devient plus sélectif, une salle de bain désuète est souvent la première chose qui fait hésiter un acheteur.",
        },
        { type: "heading", text: "Ce que disent les chiffres" },
        {
          type: "paragraph",
          text: "Le rapport sur le rendement des rénovations de Royal LePage révèle qu'une rénovation de salle de bain peut augmenter la valeur d'une maison de 16 % en moyenne — derrière la cuisine (20 %), mais devant les sous-sols aménagés (15 %) et les espaces extérieurs (10 %). De son côté, RE/MAX Canada estime qu'une rénovation de salle de bain bien exécutée récupère de 50 % à 85 % de son coût à la revente, avec une moyenne d'environ 62 %, et souligne que la salle de bain figure parmi les trois rénovations les plus rentables dans 17 marchés immobiliers au pays, incluant Toronto et Vancouver.",
        },
        {
          type: "stats",
          items: [
            {
              value: "16 %",
              label: "Augmentation moyenne de la valeur d'une maison grâce à une rénovation de salle de bain — Royal LePage",
            },
            { value: "50–85 %", label: "Du coût de rénovation récupéré à la revente — RE/MAX Canada" },
            { value: "Top 3", label: "La salle de bain figure parmi les 3 meilleures rénovations pour le rendement" },
          ],
        },
        { type: "heading", text: "Ce que cela représente à Laval et à Montréal" },
        {
          type: "paragraph",
          text: "Appliqué aux chiffres locaux, ce 16 % représente de l'argent bien réel. Le prix médian d'une maison unifamiliale à Laval se situe autour de 580 000 $ en 2026 — une hausse de 16 % correspond à environ 93 000 $ de valeur ajoutée. À Montréal, où le prix médian d'une maison unifamiliale avoisine plutôt 797 000 $, le même 16 % représente environ 127 000 $. Ce sont des moyennes indicatives, pas des garanties — le rendement réel dépend de votre quartier, de la qualité des travaux et de l'état de la salle de bain au départ — mais elles expliquent pourquoi ce projet revient constamment en tête des palmarès de rendement en rénovation.",
        },
        { type: "heading", text: "Ce que coûte réellement une rénovation de salle de bain ici" },
        {
          type: "paragraph",
          text: "Au Québec, une rénovation complète de salle de bain coûte généralement entre 16 000 $ et 55 000 $, la plupart des propriétaires se situant entre 20 000 $ et 25 000 $ pour une reprise complète : nouvelle céramique, vanité, baignoire ou douche, plomberie et éclairage. Un rafraîchissement plus léger (peinture, nouvelle vanité, robinetterie et accessoires mis à jour) peut coûter aussi peu que 5 000 $ à 12 000 $. Les données de RE/MAX suggèrent que le point optimal pour la valeur de revente se situe au milieu de cette fourchette : une rénovation de 15 000 $ à 35 000 $ avec nouvelle vanité, céramique moderne, robinetterie et éclairage mis à jour tend à récupérer de 70 % à 85 % de son coût — souvent plus qu'une construction ultra-haut de gamme et très personnalisée.",
        },
        { type: "heading", text: "Pourquoi la salle de bain compte encore plus dans le marché actuel" },
        {
          type: "paragraph",
          text: "Le marché immobilier québécois se modère en 2026 après plusieurs années d'activité exceptionnelle, et l'Association professionnelle des courtiers immobiliers du Québec (APCIQ) rapporte que les acheteurs agissent avec plus de prudence et de sélectivité, particulièrement pour les maisons unifamiliales. Dans un tel marché, une salle de bain rénovée joue un double rôle : elle ajoute de la valeur à la revente, et elle élimine l'une des raisons les plus faciles pour un acheteur prudent de se désister ou de négocier le prix à la baisse. Si votre rénovation touche aussi la ventilation, l'isolation ou le chauffage, il vaut la peine de vérifier son admissibilité à des programmes provinciaux comme Rénoclimat ou le prêt Canada pour des maisons plus vertes — ils ne financeront pas un rafraîchissement purement esthétique, mais ils peuvent réduire le coût des mises à niveau mécaniques qui accompagnent souvent une rénovation complète.",
        },
        { type: "heading", text: "Maximiser le rendement de votre investissement" },
        {
          type: "list",
          items: [
            "Priorisez la vanité, la céramique, la robinetterie et l'éclairage — les données de RE/MAX montrent que cette combinaison génère la majeure partie du rendement à la revente.",
            "Restez dans la gamme intermédiaire. Une rénovation de 15 000 $ à 35 000 $ récupère historiquement une plus grande proportion de son coût qu'une construction ultra-haut de gamme.",
            "Choisissez des finitions qui plairont à un large éventail d'acheteurs, pas seulement à votre goût personnel — les choix neutres et intemporels conservent mieux leur valeur à la revente.",
            "Conservez vos documents. Photos, permis et factures appuient autant une vente future qu'une réclamation d'assurance si un dégât d'eau survient un jour.",
            "Si vous rénovez à la suite d'un dégât d'eau, assurez-vous d'abord de régler le problème sous-jacent — des travaux esthétiques par-dessus un problème d'humidité ne conserveront pas leur valeur.",
          ],
        },
        {
          type: "paragraph",
          text: "Que vous rénoviez pour profiter vous-même de l'espace ou que vous vous prépariez à vendre dans les prochaines années, la rénovation de salle de bain demeure l'un des moyens les plus fiables de réinvestir dans votre propriété. Renovision AnA planifie et réalise des rénovations de cuisine et de salle de bain à Laval et à Montréal, d'un simple rafraîchissement à une rénovation complète — obtenez une estimation approximative en quelques minutes avec notre outil de clavardage, ou appelez-nous.",
        },
      ],
    },
  },
  {
    slug: "quebec-bill-16-condo-contingency-fund-study",
    categoryTag: {
      en: "Condo & Property Management · Regulatory Compliance",
      fr: "Copropriété et gestion immobilière · Conformité réglementaire",
    },
    publishedAt: "2026-07-22",
    readTimeMinutes: 7,
    heroImage: "/images/blog/condo-contingency-fund-header.png",
    heroStat: {
      value: "2028",
      label: {
        en: "Deadline for existing Quebec condo syndicates to obtain their first contingency fund study",
        fr: "Échéance pour les syndicats de copropriété existants du Québec pour obtenir leur première étude du fonds de prévoyance",
      },
    },
    en: {
      title:
        "Quebec's Bill 16: What the New Contingency Fund Study Requirement Means for Your Condo Syndicate",
      excerpt:
        "Every condo syndicate in Quebec now has a legal deadline to get a contingency fund study — and the data shows most aren't financially ready for what it will find. Here's what Bill 16 requires, and what happens once your building has a repair timeline.",
      metaDescription:
        "Quebec's Bill 16 now requires every condo syndicate to get a contingency fund study by August 2028. Here's what the law requires, why nearly 4 in 10 syndicates are underfunded, and what to do once your study identifies major repairs.",
      sections: [
        {
          type: "paragraph",
          text: "If you sit on a condo board, manage a syndicate, or simply own a unit in Quebec, a change to the Civil Code now affects you directly. Bill 16 — adopted in December 2019 and now fully in force — requires every syndicate of co-owners in the province to obtain a contingency fund study, with a hard deadline of August 14, 2028 for buildings that don't already have one. For boards used to setting contribution levels by instinct or habit, this is the first time the law forces a real, professional number onto the table — and for many buildings, that number is going to be uncomfortable.",
        },
        { type: "heading", text: "What Bill 16 actually requires" },
        {
          type: "paragraph",
          text: "Bill 16 amended article 1071 of the Civil Code of Québec to require every syndicate of co-owners to commission a contingency fund study (étude du fonds de prévoyance) — a technical and financial report that inventories the building's common-area components, estimates their remaining useful life, projects repair and replacement costs over a minimum 25-year horizon, and calculates the annual contributions needed to cover them without a shortfall. The study builds on another new requirement, the maintenance logbook (carnet d'entretien), which documents the building's condition and repair history and feeds directly into the study's projections.",
        },
        {
          type: "list",
          items: [
            "Existing syndicates have until August 14, 2028 to obtain their first compliant study — new syndicates must have one from the outset.",
            "The study must be renewed at least every five years.",
            "Only professionals from specific regulated orders can legally perform it: engineers (OIQ), architects (OAQ), certified appraisers (OEAQ), professional technologists (OTPQ), or CPAs (Ordre des CPA du Québec) — and they must be independent from the syndicate.",
            "Since August 2025, sellers must also provide buyers a syndicate compliance certificate (attestation du syndicat) covering the fund's balance, completed and planned major work, past inspections, and any ongoing disputes — the syndicate has 15 days to produce it once requested.",
          ],
        },
        { type: "heading", text: "Why this matters more than another compliance checkbox" },
        {
          type: "paragraph",
          text: "Quebec isn't legislating this in a vacuum. A 2015 survey by the APCHQ, in partnership with the Fédération des chambres immobilières du Québec and the RGCQ, found that 41% of respondents discovered their contingency fund was insufficient only once they needed it — when major repairs or an end-of-life common-area replacement forced a special assessment. That's the exact scenario Bill 16 is designed to prevent: a board finding out its building needs a new roof or a structural repair only after the money isn't there. The risk is compounded in older buildings, where roofing, mechanical systems, and building envelopes are more likely to be approaching the end of their service life at the same time the fund is being assessed for the first time. And internationally, the consequences of deferred building maintenance have been made starkly clear: the 2021 collapse of Champlain Towers South in Surfside, Florida — which killed 98 people — was later linked by federal investigators to structural deterioration that had gone unaddressed for years. Quebec's reform is a financial planning law, not a structural inspection mandate, but the underlying lesson is the same: buildings that don't fund their own maintenance eventually present the bill in the worst possible way.",
        },
        {
          type: "stats",
          items: [
            { value: "25 years", label: "Minimum horizon the study must project repair and replacement costs over" },
            { value: "5 years", label: "Maximum interval before the study must be renewed" },
            {
              value: "41%",
              label: "Of surveyed condo owners found their fund insufficient only once major work was needed — APCHQ/FCIQ/RGCQ survey",
            },
          ],
        },
        { type: "heading", text: "What happens after the study — and where we come in" },
        {
          type: "paragraph",
          text: "Once your syndicate has a contingency fund study in hand, you have something most boards never had before: a documented, professionally estimated timeline of exactly which major repairs are coming, roughly when, and roughly what they'll cost. That's valuable for budgeting — but a study is a financial and technical report, not a construction plan, and the professionals who prepare it (engineers, architects, appraisers, technologists, accountants) aren't the ones who pick up tools and do the work. That's where a contractor comes in. Renovision AnA works with condo boards and property managers across Laval and Montreal to plan and execute the major repairs these studies identify, on the timeline your study calls for, with the kind of documentation your syndicate will want on file for the next study, the next sale, and the next board.",
        },
        {
          type: "list",
          items: [
            "Roofing repair and replacement",
            "Plumbing and mechanical system upgrades",
            "Structural repairs identified in engineering assessments",
            "Common-area renovations — lobbies, corridors, parking structures, and building envelopes",
          ],
        },
        {
          type: "linkParagraph",
          text: "If you manage multiple properties or sit on more than one board, our commercial and property management page covers how we work with portfolios, not just single buildings.",
          linkText: "See how we work with property managers →",
          href: "/commercial",
        },
        {
          type: "paragraph",
          text: "Your syndicate's contingency fund study will tell you what needs to happen and roughly when. What it won't do is show up with a crew. If your building's study has flagged upcoming roofing, plumbing, structural, or common-area work — or you expect it will once you commission one — it's worth lining up a contractor before the timeline forces your hand.",
        },
        {
          type: "linkParagraph",
          text: "Renovision AnA plans and executes major repair and renovation projects for condo syndicates and property managers across Laval and Montreal.",
          linkText: "Get a quote for your syndicate's upcoming major repairs →",
          href: "/contact",
        },
      ],
    },
    fr: {
      title:
        "Loi 16 au Québec : ce que la nouvelle étude du fonds de prévoyance signifie pour votre syndicat de copropriété",
      excerpt:
        "Chaque syndicat de copropriété au Québec a désormais une échéance légale pour obtenir une étude du fonds de prévoyance — et les données montrent que la plupart ne sont pas financièrement prêts pour ce qu'elle révélera. Voici ce qu'exige la Loi 16, et ce qui se passe une fois que votre immeuble a un échéancier de travaux.",
      metaDescription:
        "La Loi 16 du Québec oblige désormais chaque syndicat de copropriété à obtenir une étude du fonds de prévoyance d'ici août 2028. Voici ce que la loi exige, pourquoi près de 4 syndicats sur 10 sont sous-financés, et quoi faire une fois les travaux majeurs identifiés.",
      sections: [
        {
          type: "paragraph",
          text: "Si vous siégez au conseil d'administration d'une copropriété, gérez un syndicat ou possédez simplement une unité au Québec, une modification au Code civil vous concerne désormais directement. La Loi 16 — adoptée en décembre 2019 et maintenant pleinement en vigueur — oblige chaque syndicat de copropriétaires de la province à obtenir une étude du fonds de prévoyance, avec une échéance ferme au 14 août 2028 pour les immeubles qui n'en ont pas encore une. Pour les conseils habitués à fixer les cotisations par instinct ou par habitude, c'est la première fois que la loi impose un chiffre professionnel réel sur la table — et pour bien des immeubles, ce chiffre sera difficile à entendre.",
        },
        { type: "heading", text: "Ce qu'exige réellement la Loi 16" },
        {
          type: "paragraph",
          text: "La Loi 16 a modifié l'article 1071 du Code civil du Québec pour obliger chaque syndicat de copropriétaires à commander une étude du fonds de prévoyance — un rapport technique et financier qui inventorie les composantes des parties communes de l'immeuble, estime leur durée de vie utile restante, projette les coûts de réparation et de remplacement sur un horizon d'au moins 25 ans, et détermine les cotisations annuelles nécessaires pour les couvrir sans déficit. L'étude s'appuie sur une autre nouvelle obligation, le carnet d'entretien, qui documente l'état de l'immeuble et son historique de réparations et alimente directement les projections de l'étude.",
        },
        {
          type: "list",
          items: [
            "Les syndicats existants ont jusqu'au 14 août 2028 pour obtenir leur première étude conforme — les nouveaux syndicats doivent en avoir une dès le départ.",
            "L'étude doit être renouvelée au moins tous les cinq ans.",
            "Seuls les professionnels de certains ordres réglementés peuvent légalement la réaliser : ingénieurs (OIQ), architectes (OAQ), évaluateurs agréés (OEAQ), technologues professionnels (OTPQ) ou CPA (Ordre des CPA du Québec) — et ils doivent être indépendants du syndicat.",
            "Depuis août 2025, les vendeurs doivent aussi fournir aux acheteurs une attestation du syndicat couvrant le solde du fonds, les travaux majeurs réalisés et prévus, les inspections passées et les litiges en cours — le syndicat dispose de 15 jours pour la produire une fois la demande faite.",
          ],
        },
        { type: "heading", text: "Pourquoi c'est plus qu'une simple case à cocher" },
        {
          type: "paragraph",
          text: "Le Québec ne légifère pas dans le vide. Un sondage de 2015 mené par l'APCHQ, en partenariat avec la Fédération des chambres immobilières du Québec et le RGCQ, a révélé que 41 % des répondants avaient découvert que leur fonds de prévoyance était insuffisant seulement au moment d'en avoir besoin — lorsque des réparations majeures ou le remplacement de parties communes en fin de vie utile ont forcé une cotisation spéciale. C'est exactement le scénario que la Loi 16 vise à prévenir : un conseil qui découvre que son immeuble a besoin d'une nouvelle toiture ou d'une réparation structurale seulement après que l'argent n'y soit plus. Le risque est amplifié dans les immeubles plus âgés, où la toiture, les systèmes mécaniques et l'enveloppe du bâtiment sont plus susceptibles d'approcher la fin de leur durée de vie utile au moment même où le fonds est évalué pour la première fois. Et à l'international, les conséquences d'un entretien de bâtiment négligé ont été démontrées de façon brutale : l'effondrement en 2021 de la Champlain Towers South à Surfside, en Floride — qui a fait 98 morts — a plus tard été lié par les enquêteurs fédéraux à une détérioration structurale négligée pendant des années. La réforme québécoise est une loi de planification financière, pas une obligation d'inspection structurale, mais la leçon de fond est la même : les immeubles qui ne financent pas leur propre entretien finissent par en payer la facture de la pire façon possible.",
        },
        {
          type: "stats",
          items: [
            { value: "25 ans", label: "Horizon minimal sur lequel l'étude doit projeter les coûts de réparation et de remplacement" },
            { value: "5 ans", label: "Intervalle maximal avant le renouvellement obligatoire de l'étude" },
            {
              value: "41 %",
              label: "Des copropriétaires sondés ont découvert un fonds insuffisant seulement au moment des travaux majeurs — sondage APCHQ/FCIQ/RGCQ",
            },
          ],
        },
        { type: "heading", text: "Ce qui se passe après l'étude — et où nous entrons en jeu" },
        {
          type: "paragraph",
          text: "Une fois que votre syndicat a une étude du fonds de prévoyance en main, vous avez quelque chose que la plupart des conseils n'ont jamais eu auparavant : un échéancier documenté et estimé par un professionnel, indiquant précisément quels travaux majeurs s'en viennent, à quel moment approximatif et à quel coût approximatif. C'est précieux pour la budgétisation — mais une étude est un rapport financier et technique, pas un plan de construction, et les professionnels qui la préparent (ingénieurs, architectes, évaluateurs, technologues, comptables) ne sont pas ceux qui prennent les outils et exécutent les travaux. C'est là qu'un entrepreneur entre en jeu. Renovision AnA travaille avec des conseils d'administration de copropriétés et des gestionnaires immobiliers à Laval et à Montréal pour planifier et réaliser les travaux majeurs identifiés par ces études, selon l'échéancier que dicte votre étude, avec le type de documentation que votre syndicat voudra avoir en dossier pour la prochaine étude, la prochaine vente et le prochain conseil.",
        },
        {
          type: "list",
          items: [
            "Réparation et remplacement de toiture",
            "Mise à niveau de la plomberie et des systèmes mécaniques",
            "Réparations structurales identifiées dans les évaluations d'ingénierie",
            "Rénovations des parties communes — halls d'entrée, corridors, stationnements et enveloppe du bâtiment",
          ],
        },
        {
          type: "linkParagraph",
          text: "Si vous gérez plusieurs propriétés ou siégez à plus d'un conseil, notre page dédiée aux entreprises et à la gestion immobilière explique comment nous travaillons avec des portefeuilles complets, pas seulement des immeubles isolés.",
          linkText: "Voir comment nous travaillons avec les gestionnaires immobiliers →",
          href: "/commercial",
        },
        {
          type: "paragraph",
          text: "L'étude du fonds de prévoyance de votre syndicat vous dira ce qui doit être fait et à peu près quand. Ce qu'elle ne fera pas, c'est se présenter avec une équipe. Si l'étude de votre immeuble a signalé des travaux de toiture, de plomberie, de structure ou de parties communes à venir — ou que vous prévoyez que ce sera le cas une fois l'étude commandée — il vaut mieux avoir un entrepreneur en main avant que l'échéancier ne vous presse.",
        },
        {
          type: "linkParagraph",
          text: "Renovision AnA planifie et réalise des projets de réparation majeure et de rénovation pour les syndicats de copropriété et les gestionnaires immobiliers à Laval et à Montréal.",
          linkText: "Obtenez une soumission pour les travaux majeurs à venir de votre syndicat →",
          href: "/contact",
        },
      ],
    },
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
