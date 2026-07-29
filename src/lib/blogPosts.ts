export type BlogPostSection =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "stats"; items: { value: string; label: string }[] }
  | { type: "linkParagraph"; text: string; linkText: string; href: string }
  | { type: "timeline"; items: { time: string; text: string }[] };

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
  {
    slug: "hidden-water-damage-and-mold-timeline",
    categoryTag: {
      en: "Water Damage · Mold Prevention",
      fr: "Dégât d'eau · Prévention de la moisissure",
    },
    publishedAt: "2026-07-23",
    readTimeMinutes: 6,
    heroImage: "/images/blog/water-damage-humidity-header.png",
    heroStat: {
      value: "24–48h",
      label: {
        en: "How fast mold can begin growing after water exposure — EPA",
        fr: "Délai avant que la moisissure commence à se développer après un dégât d'eau — EPA",
      },
    },
    en: {
      title: "Hidden Water Damage: Why Soaked Floors and Walls Need Fast Action, Not a Wait-and-See",
      excerpt:
        "A small leak doesn't stay small. Here's what's actually happening inside your walls and floors in the hours and days after water exposure — and why waiting to deal with it costs more than acting fast.",
      metaDescription:
        "Mold can start growing within 24-48 hours of water exposure. See the hidden damage timeline, the warning signs to watch for, and why fast action protects your home, your health, and your insurance claim.",
      sections: [
        {
          type: "paragraph",
          text: "A leaking pipe under a sink, a slow roof seep after a storm, a washing machine hose that lets go while you're out — none of these look like emergencies at first. The water gets wiped up, the carpet dries to the touch, and life moves on. The problem is what's happening where you can't see it: inside the subfloor, behind the drywall, inside the insulation. Moisture trapped there doesn't just sit still — it starts a clock, and that clock moves faster than most people expect.",
        },
        { type: "heading", text: "The hidden damage timeline" },
        {
          type: "paragraph",
          text: "According to the U.S. Environmental Protection Agency, if a wet area isn't thoroughly dried within 24 to 48 hours, you should assume mold growth has already begun. Here's roughly how that plays out inside a wall, subfloor, or ceiling cavity once water gets in and isn't fully removed:",
        },
        {
          type: "timeline",
          items: [
            {
              time: "0–24 hours",
              text: "Mold spores that are always present in indoor air land on wet material and start absorbing moisture — the first stage of germination. Nothing is visible yet, but the process has already started inside walls, subfloors, and insulation.",
            },
            {
              time: "24–48 hours",
              text: "Germinating spores transition into active colonies. This is the EPA's benchmark: material that's still wet at this point is very likely growing mold, even if nothing can be seen or smelled from the room.",
            },
            {
              time: "48 hours – 12 days",
              text: "Colonies become visible — small dark or greenish-black spots on drywall, wood framing, baseboards, or carpet backing. A musty smell often shows up before the spots do, especially in enclosed spaces like behind a vanity or under flooring.",
            },
            {
              time: "1–3 weeks",
              text: "Left untreated, colonies keep spreading and established growth can begin breaking down the wood, drywall, and insulation it's feeding on — the point where a moisture problem starts becoming a structural one.",
            },
          ],
        },
        { type: "heading", text: "Where it happens fastest" },
        {
          type: "paragraph",
          text: "Bathrooms, basements, crawl spaces, and any poorly ventilated area are the highest-risk zones — they combine the two conditions mold needs most: moisture that lingers and air that doesn't move. A leak in a well-ventilated, sunlit room can dry out largely on its own; the same amount of water trapped under a vanity or inside a crawl space can sit at high humidity for days with nothing to speed up the drying.",
        },
        { type: "heading", text: "Warning signs worth acting on immediately" },
        {
          type: "list",
          items: [
            "A musty or earthy smell, especially in one specific area — often the first sign, and it can show up before you see anything.",
            "Discoloration or staining on walls or ceilings, even faint yellow-brown patches.",
            "Paint or wallpaper that's bubbling, peeling, or bulging away from the surface.",
            "Flooring that feels soft, spongy, or warped underfoot.",
            "Persistent condensation on windows or unusually high humidity in one room.",
            "Visible spotting — small dark or greenish-black marks on drywall, grout, or baseboards.",
          ],
        },
        { type: "heading", text: "Why fast intervention matters — health, structure, and insurance" },
        {
          type: "paragraph",
          text: "Water damage is already the single most common home insurance claim in Quebec — it accounted for roughly half of all paid claims in 2023. What often determines whether that claim gets paid in full is how quickly the water was addressed. Most Quebec home insurance policies distinguish between a sudden, accidental event (generally covered) and damage from a slow leak, repeated infiltration, or a problem the homeowner knew about and didn't act on (often excluded, or grounds for the insurer to deny the claim as not a covered 'sudden' loss). If an undeclared prior leak contributed to the damage, a policy can even be voided for that specific cause. Beyond the insurance angle, mold exposure can trigger or worsen allergy and respiratory symptoms, and the structural risk is real: wood framing, subfloors, and drywall that stay wet lose strength over time, and insulation that's been soaked typically has to be fully replaced rather than dried out.",
        },
        {
          type: "stats",
          items: [
            { value: "50%", label: "Of all paid home insurance claims in Quebec in 2023 were water-damage related" },
            { value: "24–48h", label: "EPA's window for thorough drying before mold growth should be assumed" },
            { value: "1–3 wks", label: "Typical remediation time once mold reaches structural materials, vs. 3–7 days if caught early" },
          ],
        },
        { type: "heading", text: "How Renovision AnA finds it before it spreads" },
        {
          type: "paragraph",
          text: "The tricky part of hidden water damage is exactly that — it's hidden. A subfloor can be saturated under flooring that looks fine, and insulation can be soaked inside a wall that shows no visible staining yet. We use moisture meters and thermal inspection to find water where you can't see it, not just where it's obvious, then remove and dry out the affected materials — wet insulation, damp drywall, saturated subfloor — before mold has a chance to establish itself. If remediation starts in that early window, most cases resolve in a matter of days; wait until it's reached the structure, and the same job can take weeks and cost significantly more. Every step gets documented with photos and moisture readings — the kind of record that supports an insurance claim instead of giving an adjuster a reason to question it.",
        },
        {
          type: "linkParagraph",
          text: "For urgent situations, our water damage restoration service covers emergency extraction, drying, and full repair — not just the visible damage.",
          linkText: "See our water damage restoration process →",
          href: "/services/water-damage",
        },
        {
          type: "paragraph",
          text: "If you've noticed a musty smell, a stain that wasn't there before, or flooring that feels different underfoot, the 24-to-48-hour window is either already closing or already gone — the next best time to check is now.",
        },
        {
          type: "linkParagraph",
          text: "Renovision AnA responds quickly to water damage across Laval and Montreal, from emergency extraction to full repair.",
          linkText: "Think you might have hidden water damage? Get it checked now →",
          href: "/contact",
        },
      ],
    },
    fr: {
      title: "Dégât d'eau caché : pourquoi les planchers et murs imbibés exigent une action rapide, pas d'attente",
      excerpt:
        "Une petite fuite ne reste jamais petite. Voici ce qui se passe réellement dans vos murs et vos planchers dans les heures et les jours suivant un dégât d'eau — et pourquoi attendre coûte plus cher qu'agir rapidement.",
      metaDescription:
        "La moisissure peut commencer à se développer en 24 à 48 heures après un dégât d'eau. Découvrez l'échéancier des dommages cachés, les signes à surveiller, et pourquoi agir vite protège votre maison, votre santé et votre réclamation d'assurance.",
      sections: [
        {
          type: "paragraph",
          text: "Un tuyau qui coule sous un évier, une infiltration lente après une tempête, un tuyau de laveuse qui lâche pendant votre absence — rien de tout ça ne ressemble à une urgence au premier abord. L'eau est épongée, le tapis semble sec au toucher, et la vie continue. Le problème, c'est ce qui se passe là où vous ne pouvez pas le voir : dans le sous-plancher, derrière le gypse, dans l'isolant. L'humidité qui y reste emprisonnée ne reste pas immobile — elle déclenche un compte à rebours, et ce compte à rebours avance plus vite que la plupart des gens ne le pensent.",
        },
        { type: "heading", text: "L'échéancier des dommages cachés" },
        {
          type: "paragraph",
          text: "Selon l'Environmental Protection Agency (EPA) des États-Unis, si une zone mouillée n'est pas complètement séchée en 24 à 48 heures, il faut présumer que la moisissure a déjà commencé à se développer. Voici, de façon approximative, ce qui se passe à l'intérieur d'un mur, d'un sous-plancher ou d'un plafond une fois que l'eau y est entrée et n'a pas été entièrement retirée :",
        },
        {
          type: "timeline",
          items: [
            {
              time: "0–24 heures",
              text: "Les spores de moisissure, toujours présentes dans l'air intérieur, se déposent sur le matériau mouillé et commencent à absorber l'humidité — la première étape de la germination. Rien n'est encore visible, mais le processus est déjà enclenché à l'intérieur des murs, des sous-planchers et de l'isolant.",
            },
            {
              time: "24–48 heures",
              text: "Les spores en germination se transforment en colonies actives. C'est le seuil de référence de l'EPA : un matériau encore mouillé à ce stade est très probablement en train de développer de la moisissure, même si rien n'est visible ou perceptible à l'odeur depuis la pièce.",
            },
            {
              time: "48 heures – 12 jours",
              text: "Les colonies deviennent visibles — de petites taches foncées ou verdâtres sur le gypse, la charpente de bois, les plinthes ou l'envers du tapis. Une odeur de moisi apparaît souvent avant les taches, surtout dans les espaces fermés comme derrière une vanité ou sous un plancher.",
            },
            {
              time: "1–3 semaines",
              text: "Sans intervention, les colonies continuent de se propager et la croissance établie commence à dégrader le bois, le gypse et l'isolant qui la nourrissent — le moment où un problème d'humidité devient un problème structural.",
            },
          ],
        },
        { type: "heading", text: "Où ça se produit le plus rapidement" },
        {
          type: "paragraph",
          text: "Les salles de bain, les sous-sols, les vides sanitaires et tout espace mal ventilé sont les zones les plus à risque — ils combinent les deux conditions dont la moisissure a le plus besoin : une humidité qui persiste et un air qui ne circule pas. Une fuite dans une pièce bien ventilée et ensoleillée peut sécher en grande partie d'elle-même; la même quantité d'eau emprisonnée sous une vanité ou dans un vide sanitaire peut rester à un taux d'humidité élevé pendant des jours, sans rien pour accélérer le séchage.",
        },
        { type: "heading", text: "Signes à surveiller — et à ne pas ignorer" },
        {
          type: "list",
          items: [
            "Une odeur de moisi ou de terre, surtout localisée à un endroit précis — souvent le premier signe, qui peut apparaître avant même que quelque chose soit visible.",
            "Une décoloration ou des taches sur les murs ou les plafonds, même de légères marques jaune-brun.",
            "De la peinture ou du papier peint qui cloque, s'écaille ou se décolle de la surface.",
            "Un plancher qui semble mou, spongieux ou déformé sous le pied.",
            "De la condensation persistante sur les fenêtres ou une humidité anormalement élevée dans une pièce.",
            "Des taches visibles — de petites marques foncées ou verdâtres sur le gypse, les joints de céramique ou les plinthes.",
          ],
        },
        { type: "heading", text: "Pourquoi agir vite compte — pour la santé, la structure et l'assurance" },
        {
          type: "paragraph",
          text: "Le dégât d'eau est déjà la cause de réclamation la plus fréquente en assurance habitation au Québec — il représentait environ la moitié de tous les sinistres payés en 2023. Ce qui détermine souvent si cette réclamation est payée en entier, c'est la rapidité avec laquelle l'eau a été traitée. La plupart des polices d'assurance habitation au Québec distinguent un événement soudain et accidentel (généralement couvert) d'un dommage causé par une fuite lente, une infiltration répétée ou un problème que le propriétaire connaissait sans agir (souvent exclu, ou un motif pour l'assureur de refuser la réclamation comme n'étant pas une perte « soudaine » couverte). Si une fuite antérieure non déclarée a contribué au dommage, une police peut même être annulée pour cette cause précise. Au-delà de l'aspect assurance, l'exposition à la moisissure peut déclencher ou aggraver des symptômes allergiques et respiratoires, et le risque structural est bien réel : la charpente de bois, le sous-plancher et le gypse qui restent mouillés perdent de leur résistance avec le temps, et un isolant imbibé doit généralement être remplacé au complet plutôt que simplement séché.",
        },
        {
          type: "stats",
          items: [
            { value: "50 %", label: "Des sinistres payés en assurance habitation au Québec en 2023 étaient liés à un dégât d'eau" },
            { value: "24–48 h", label: "Délai de séchage complet de l'EPA avant de présumer une croissance de moisissure" },
            { value: "1–3 sem.", label: "Durée typique de décontamination une fois la structure atteinte, contre 3 à 7 jours si le problème est pris tôt" },
          ],
        },
        { type: "heading", text: "Comment Renovision AnA le détecte avant que ça se propage" },
        {
          type: "paragraph",
          text: "La difficulté avec un dégât d'eau caché, c'est justement qu'il est caché. Un sous-plancher peut être saturé sous un revêtement qui semble parfaitement normal, et un isolant peut être imbibé à l'intérieur d'un mur qui ne présente encore aucune tache visible. Nous utilisons des détecteurs d'humidité et l'inspection thermique pour repérer l'eau là où elle ne se voit pas, pas seulement là où elle est évidente, puis nous retirons et séchons les matériaux touchés — isolant mouillé, gypse humide, sous-plancher saturé — avant que la moisissure ait la chance de s'installer. Une intervention faite dans cette fenêtre précoce se résout la plupart du temps en quelques jours; attendre que le problème atteigne la structure, et le même travail peut prendre des semaines et coûter considérablement plus cher. Chaque étape est documentée par photos et relevés d'humidité — le type de dossier qui appuie une réclamation d'assurance plutôt que de donner à un expert en sinistre une raison de la remettre en question.",
        },
        {
          type: "linkParagraph",
          text: "Pour les situations urgentes, notre service de restauration de dégâts d'eau couvre l'extraction d'urgence, le séchage et la réparation complète — pas seulement les dommages visibles.",
          linkText: "Voir notre processus de restauration de dégâts d'eau →",
          href: "/services/water-damage",
        },
        {
          type: "paragraph",
          text: "Si vous avez remarqué une odeur de moisi, une tache qui n'était pas là avant, ou un plancher qui semble différent sous le pied, la fenêtre de 24 à 48 heures est soit déjà en train de se refermer, soit déjà passée — le meilleur moment pour vérifier, c'est maintenant.",
        },
        {
          type: "linkParagraph",
          text: "Renovision AnA intervient rapidement en cas de dégât d'eau à Laval et à Montréal, de l'extraction d'urgence à la réparation complète.",
          linkText: "Vous pensez avoir un dégât d'eau caché? Faites-le vérifier dès maintenant →",
          href: "/contact",
        },
      ],
    },
  },
  {
    slug: "finishing-a-basement-laval-permits-moisture-radon",
    categoryTag: { en: "Basements", fr: "Sous-sols" },
    publishedAt: "2026-07-29",
    readTimeMinutes: 7,
    heroImage: "/images/blog/basement-finishing-header.png",
    heroStat: {
      value: "200 Bq/m³",
      label: {
        en: "Health Canada's radon guideline — which starts applying to a basement once you finish it",
        fr: "La ligne directrice de Santé Canada sur le radon — qui s'applique au sous-sol dès qu'il est aménagé",
      },
    },
    en: {
      title: "Finishing a Basement in Laval: Permits, Moisture and Radon",
      excerpt:
        "Finishing a basement isn't a cosmetic job. It changes which municipal rules apply and which health guidelines your space falls under — here's what Laval and Health Canada actually require.",
      metaDescription:
        "What Laval requires a permit for in a basement renovation, why insulating a damp basement makes moisture worse, and the radon rule that only starts applying once the space becomes livable.",
      sections: [
        {
          type: "paragraph",
          text: "Most people think of finishing a basement as decorating — flooring, drywall, paint, lighting. The work looks cosmetic. But the moment that space becomes somewhere people actually spend time, two things change that have nothing to do with how it looks: what the city requires of you, and which health guidelines your basement now falls under. Both catch homeowners out, and both are easier to handle before the work starts than after.",
        },
        { type: "heading", text: "When Laval requires a permit" },
        {
          type: "paragraph",
          text: "Ville de Laval's rule for basement renovation is short: a permit is required when the number of rooms or the structure is modified. The underlying test, set out in the city's Code de l'urbanisme, is clearer still — the maintenance exemption is lost if any one of three things happens: foundations or load-bearing components are modified, floor area increases, or the number of dwelling units or bedrooms changes.",
        },
        {
          type: "paragraph",
          text: "That last item is the one that surprises people. Adding a bedroom counts, and Laval lists it explicitly as requiring a permit. So does adding a bathroom — though renovating a bathroom that already exists does not. Moving or rebuilding the basement staircase requires one too, which catches a lot of basement projects.",
        },
        {
          type: "list",
          items: [
            "Permit required: adding a bedroom, adding a bathroom, adding a dwelling unit, modifying an interior staircase, changing the structure",
            "No municipal permit listed: painting, renovating an existing bathroom, kitchen renovation, replacing an electrical panel, modifying wiring inside walls, replacing plumbing",
            "Laval gives an approximate 30-day processing time — and the clock only starts once every required document is in",
          ],
        },
        {
          type: "paragraph",
          text: "One caution: \"no municipal permit\" is not the same as \"no rules.\" Licensing requirements and the Quebec construction code still apply to the work itself regardless of whether the city needs to issue a piece of paper.",
        },
        { type: "heading", text: "Why finishing a damp basement makes it worse" },
        {
          type: "paragraph",
          text: "This is the part that costs people real money, and the mechanism is genuinely counterintuitive. Natural Resources Canada puts it plainly: adding insulation to the inside makes the foundation walls even colder, and any humid air that reaches those colder walls will condense. So a basement that seemed merely a bit damp before can develop an active moisture problem after it's finished — created by the finishing itself.",
        },
        {
          type: "paragraph",
          text: "Their instruction is unambiguous: do not insulate a basement that has moisture problems from the inside. If you must, eliminate the moisture first, or the new walls will rot. Persistent leaks, spring flooding, and any trouble with sump pumps or sewer backup get corrected before insulation goes anywhere near the wall.",
        },
        {
          type: "list",
          items: [
            "Staining or mould growth on foundations or finishes",
            "Blistering or peeling paint",
            "Efflorescence — a whitish mineral deposit on the surface",
            "Spalling, where the concrete surface itself is deteriorating",
            "A musty smell",
          ],
        },
        {
          type: "paragraph",
          text: "One more timing note worth knowing if the foundation is new: NRCan puts the drying time for new concrete at roughly a year before it should be finished.",
        },
        {
          type: "linkParagraph",
          text: "This is the same reason we open up enough of a wall or floor to see what's actually wet before quoting restoration work, rather than drying what's visible and hoping.",
          linkText: "How we approach water damage",
          href: "/services/water-damage",
        },
        { type: "heading", text: "Radon: the rule that switches on when you finish" },
        {
          type: "paragraph",
          text: "Health Canada's radon guideline is 200 Bq/m³, and it applies to what they call a normal occupancy area — anywhere someone is likely to spend more than four hours a day. An unfinished basement is explicitly excluded from that definition. A finished basement with a family room, office or guest room is explicitly included, as is a basement apartment.",
        },
        {
          type: "paragraph",
          text: "Read those two sentences together and the implication is clear: finishing a basement converts space the guideline ignores into space the guideline governs. Health Canada's own measurement guide anticipates exactly this, naming basement renovation before adding a bedroom as a reason to test in advance.",
        },
        {
          type: "stats",
          items: [
            { value: "200 Bq/m³", label: "Health Canada's action level" },
            { value: "12.1%", label: "Laval-region homes above it in Health Canada's cross-Canada survey" },
            { value: "91 days", label: "Minimum test duration, during heating season" },
          ],
        },
        {
          type: "paragraph",
          text: "That Laval figure deserves its caveat: it comes from a survey run in 2009–2011 with 107 participating homes in the Laval health region, so it's indicative rather than a precise current rate. It is, for context, higher than the 6.9% recorded for Montréal and above the provincial figure. Quebec's own guidance puts the average basement concentration around 37 Bq/m³ while noting that levels can occasionally exceed 1,000. Levels vary widely between homes on the same street, which is why testing your specific house is the only way to know.",
        },
        {
          type: "paragraph",
          text: "Testing is slow rather than difficult: a detector must sit on the lowest lived-in level for at least 91 days, with those days falling in the heating season — October through April in practice. That's a long enough window that it's worth starting before the renovation, not after. Health Canada also recommends re-testing the following heating season after any renovation that changes the structure or ventilation of a home, and basement work is on their list of examples.",
        },
        {
          type: "paragraph",
          text: "There's a code angle too, and it cuts the opposite way to what you might expect. Since June 2022, Quebec's construction code has required soil-gas protection measures across the whole province for new construction and transformations. A newly built Laval home should already have those provisions. An older home having its basement finished has no equivalent code trigger — which means testing is the only route to knowing.",
        },
        { type: "heading", text: "The order that saves money" },
        {
          type: "paragraph",
          text: "None of this makes finishing a basement a bad idea. It's usually the cheapest square footage you'll ever add to a house, and it's most of what we've been building this year. But the sequence matters more here than in any other room: establish whether the space is dry, start a radon test early because it takes a season, confirm what the city needs before the layout is settled, and only then start choosing finishes.",
        },
        {
          type: "linkParagraph",
          text: "Get that order right and a basement is a straightforward project. Get it wrong and you find out a year later, behind a wall you've already paid to build.",
          linkText: "See our basement work",
          href: "/services/basements",
        },
        {
          type: "paragraph",
          text: "Sources: Ville de Laval, Permis de rénovation résidentielle intérieure and Code de l'urbanisme article 2072; Natural Resources Canada, Keeping the Heat In, Section 6; Health Canada, Government of Canada radon guideline, Guide for radon measurements in homes, and the Cross-Canada Survey of Radon Concentrations in Homes; Gouvernement du Québec, Residential radon; Régie du bâtiment du Québec, on soil-gas protection measures. Permit rules and fees change and fees are indexed annually — confirm current requirements with Ville de Laval for your own project.",
        },
      ],
    },
    fr: {
      title: "Aménager un sous-sol à Laval : permis, humidité et radon",
      excerpt:
        "Aménager un sous-sol n'est pas un travail cosmétique. Cela change les règles municipales qui s'appliquent et les lignes directrices sanitaires qui régissent la pièce — voici ce qu'exigent réellement Laval et Santé Canada.",
      metaDescription:
        "Ce qui exige un permis à Laval pour un sous-sol, pourquoi isoler un sous-sol humide aggrave le problème, et la règle sur le radon qui ne s'applique qu'une fois la pièce habitable.",
      sections: [
        {
          type: "paragraph",
          text: "La plupart des gens voient l'aménagement d'un sous-sol comme de la décoration : plancher, gypse, peinture, éclairage. Le travail a l'air cosmétique. Mais dès que cette pièce devient un endroit où l'on passe réellement du temps, deux choses changent qui n'ont rien à voir avec l'apparence : ce que la ville exige de vous, et les lignes directrices sanitaires qui régissent désormais votre sous-sol. Les deux prennent les propriétaires au dépourvu, et les deux sont plus faciles à gérer avant le début des travaux qu'après.",
        },
        { type: "heading", text: "Quand Laval exige un permis" },
        {
          type: "paragraph",
          text: "La règle de la Ville de Laval pour la rénovation d'un sous-sol est brève : un permis est requis lorsque le nombre de pièces ou la structure est modifié. Le critère de fond, énoncé dans le Code de l'urbanisme de la ville, est encore plus clair — l'exemption pour entretien normal est perdue si l'une de trois choses se produit : les fondations ou les composantes portantes sont modifiées, la superficie de plancher augmente, ou le nombre de logements ou de chambres change.",
        },
        {
          type: "paragraph",
          text: "C'est ce dernier point qui surprend. L'ajout d'une chambre compte, et Laval l'inscrit explicitement comme exigeant un permis. L'ajout d'une salle de bain aussi — alors que la rénovation d'une salle de bain existante, non. Déplacer ou reconstruire l'escalier du sous-sol en exige également un, ce qui touche beaucoup de projets de sous-sol.",
        },
        {
          type: "list",
          items: [
            "Permis requis : ajout d'une chambre, ajout d'une salle de bain, ajout d'un logement, modification d'un escalier intérieur, modification de la structure",
            "Aucun permis municipal inscrit : peinture, rénovation d'une salle de bain existante, rénovation de cuisine, remplacement du panneau électrique, modification du filage dans les murs, remplacement de la plomberie",
            "Laval indique un délai approximatif de 30 jours — et le compte à rebours ne commence qu'une fois tous les documents reçus",
          ],
        },
        {
          type: "paragraph",
          text: "Une mise en garde : « aucun permis municipal » ne veut pas dire « aucune règle ». Les exigences de licence et le Code de construction du Québec s'appliquent aux travaux eux-mêmes, que la ville ait ou non un papier à délivrer.",
        },
        { type: "heading", text: "Pourquoi aménager un sous-sol humide empire les choses" },
        {
          type: "paragraph",
          text: "C'est la partie qui coûte réellement de l'argent, et le mécanisme est vraiment contre-intuitif. Ressources naturelles Canada le dit simplement : ajouter de l'isolant à l'intérieur rend les murs de fondation encore plus froids, et tout air humide qui atteint ces murs froids va s'y condenser. Un sous-sol qui ne semblait qu'un peu humide peut donc développer un véritable problème d'humidité après son aménagement — créé par l'aménagement lui-même.",
        },
        {
          type: "paragraph",
          text: "Leur consigne est sans ambiguïté : ne pas isoler par l'intérieur un sous-sol qui présente des problèmes d'humidité. Si vous devez le faire, éliminez l'humidité d'abord, sinon vos nouveaux murs pourriront. Les infiltrations persistantes, les inondations printanières et tout problème de pompe de puisard ou de refoulement d'égout se corrigent avant que l'isolant n'approche du mur.",
        },
        {
          type: "list",
          items: [
            "Taches ou moisissures sur les fondations ou les finis",
            "Peinture qui cloque ou qui pèle",
            "Efflorescence — un dépôt minéral blanchâtre à la surface",
            "Écaillage, quand la surface du béton se détériore",
            "Une odeur de moisi",
          ],
        },
        {
          type: "paragraph",
          text: "Autre point de calendrier utile si la fondation est neuve : RNCan évalue le temps de séchage d'un béton neuf à environ un an avant qu'il ne soit fini.",
        },
        {
          type: "linkParagraph",
          text: "C'est la même raison pour laquelle nous ouvrons suffisamment de mur ou de plancher pour voir ce qui est réellement mouillé avant de chiffrer une restauration, plutôt que d'assécher ce qui est visible en espérant.",
          linkText: "Notre approche des dégâts d'eau",
          href: "/services/water-damage",
        },
        { type: "heading", text: "Radon : la règle qui s'active à l'aménagement" },
        {
          type: "paragraph",
          text: "La ligne directrice de Santé Canada sur le radon est de 200 Bq/m³, et elle s'applique à ce qu'on appelle une aire normalement occupée — tout endroit où une personne est susceptible de passer plus de quatre heures par jour. Un sous-sol non aménagé en est explicitement exclu. Un sous-sol aménagé avec une salle familiale, un bureau ou une chambre d'invités y est explicitement inclus, tout comme un logement au sous-sol.",
        },
        {
          type: "paragraph",
          text: "Lisez ces deux phrases ensemble et l'implication est claire : aménager un sous-sol convertit un espace que la ligne directrice ignore en un espace qu'elle régit. Le guide de mesure de Santé Canada prévoit exactement ce cas, citant la rénovation d'un sous-sol avant l'ajout d'une chambre comme motif de tester à l'avance.",
        },
        {
          type: "stats",
          items: [
            { value: "200 Bq/m³", label: "Le seuil d'intervention de Santé Canada" },
            { value: "12,1 %", label: "Domiciles de la région de Laval au-dessus du seuil dans l'enquête pancanadienne" },
            { value: "91 jours", label: "Durée minimale du test, en saison de chauffage" },
          ],
        },
        {
          type: "paragraph",
          text: "Ce chiffre lavallois mérite sa nuance : il provient d'une enquête menée de 2009 à 2011 auprès de 107 domiciles participants dans la région sociosanitaire de Laval — il est donc indicatif plutôt qu'un taux actuel précis. À titre de comparaison, il est supérieur au 6,9 % relevé pour Montréal et au chiffre provincial. Le gouvernement du Québec situe la concentration moyenne dans les sous-sols autour de 37 Bq/m³, tout en notant que les niveaux peuvent parfois dépasser 1 000. Les niveaux varient beaucoup d'une maison à l'autre sur une même rue, et c'est pourquoi tester votre maison précise est la seule façon de savoir.",
        },
        {
          type: "paragraph",
          text: "Le test est long plutôt que difficile : un détecteur doit demeurer au niveau habité le plus bas pendant au moins 91 jours, ces jours devant se situer en saison de chauffage — d'octobre à avril en pratique. C'est une fenêtre assez longue pour valoir la peine d'être amorcée avant la rénovation, pas après. Santé Canada recommande aussi de refaire le test la saison de chauffage suivante après toute rénovation qui modifie la structure ou la ventilation d'une maison, et les travaux de sous-sol figurent dans leurs exemples.",
        },
        {
          type: "paragraph",
          text: "Il y a aussi un volet réglementaire, et il joue à l'inverse de ce qu'on pourrait croire. Depuis juin 2022, le Code de construction du Québec exige des mesures de protection contre les gaz souterrains sur tout le territoire, pour les constructions neuves et les transformations. Une maison lavalloise récente devrait déjà les avoir. Une maison plus ancienne dont on aménage le sous-sol n'a aucun déclencheur équivalent — ce qui fait du test la seule voie pour savoir.",
        },
        { type: "heading", text: "L'ordre qui fait économiser" },
        {
          type: "paragraph",
          text: "Rien de tout cela ne fait de l'aménagement d'un sous-sol une mauvaise idée. C'est habituellement la superficie la moins chère que vous ajouterez à une maison, et c'est l'essentiel de ce que nous avons construit cette année. Mais la séquence compte ici plus que dans toute autre pièce : établir si l'espace est sec, amorcer un test de radon tôt puisqu'il prend une saison, confirmer ce qu'exige la ville avant d'arrêter l'aménagement, et seulement ensuite choisir les finis.",
        },
        {
          type: "linkParagraph",
          text: "Respectez cet ordre et un sous-sol est un projet simple. Manquez-le et vous l'apprenez un an plus tard, derrière un mur que vous avez déjà payé pour construire.",
          linkText: "Voir nos projets de sous-sol",
          href: "/services/basements",
        },
        {
          type: "paragraph",
          text: "Sources : Ville de Laval, Permis de rénovation résidentielle intérieure et Code de l'urbanisme article 2072; Ressources naturelles Canada, Garder la chaleur, section 6; Santé Canada, Ligne directrice du gouvernement du Canada sur le radon, Guide sur les mesures de radon dans les habitations, et l'Enquête pancanadienne sur les concentrations de radon dans les habitations; Gouvernement du Québec, Radon résidentiel; Régie du bâtiment du Québec, sur les mesures de protection contre les gaz souterrains. Les règles et tarifs de permis changent et les tarifs sont indexés annuellement — confirmez les exigences courantes auprès de la Ville de Laval pour votre projet.",
        },
      ],
    },
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
