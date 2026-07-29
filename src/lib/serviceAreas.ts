/**
 * Hyper-local service-area pages.
 *
 * Every fact in the `context` sections below came from a real, citable source
 * (listed per area in `sources`) — Ville de Laval's own municipal-history
 * pages, Statistics Canada 2021 census figures, and public community profiles.
 * Nothing here is invented, and no area is a template-swap of another: the
 * whole point of these pages is that a competitor in Ontario could not publish
 * the same text with the city name changed.
 *
 * `whatThisMeans` is different in kind: it is Renovision AnA's professional
 * read on what a given construction era typically implies for renovation and
 * water-damage work. It is written as general trade expertise about that
 * housing type, never as a claim about any specific address or building.
 */

export type ServiceAreaFaq = { question: string; answer: string };

export type ServiceAreaLocaleContent = {
  /** Display name as it should read in running text. */
  name: string;
  tagline: string;
  metaDescription: string;
  /** Sourced local context — real facts about the area. */
  context: string[];
  /** Trade read on what that housing stock means for our work. */
  whatThisMeansHeading: string;
  whatThisMeans: string[];
  faq: ServiceAreaFaq[];
};

export type ServiceArea = {
  slug: string;
  /**
   * Service pages genuinely relevant to this area's housing stock, so internal
   * links mirror the real service hierarchy rather than linking everything to
   * everything (which is what the SEO roadmap warns against).
   */
  relatedServices: { labelEn: string; labelFr: string; href: string }[];
  sources: { label: string; url: string }[];
  en: ServiceAreaLocaleContent;
  fr: ServiceAreaLocaleContent;
};

const WATER_DAMAGE = {
  labelEn: "Water damage restoration",
  labelFr: "Restauration après dégât d'eau",
  href: "/services/water-damage",
};
const BASEMENTS = {
  labelEn: "Basement finishing",
  labelFr: "Aménagement de sous-sol",
  href: "/services/basements",
};
const FLOORING = { labelEn: "Flooring", labelFr: "Revêtements de sol", href: "/services/flooring" };
const KITCHEN_BATH = {
  labelEn: "Kitchen & bathroom",
  labelFr: "Cuisine et salle de bain",
  href: "/services/kitchen-bath",
};
const RENOVATIONS = {
  labelEn: "General renovations",
  labelFr: "Rénovations générales",
  href: "/services/renovations",
};
const REPAIRS = { labelEn: "Small repairs", labelFr: "Petites réparations", href: "/services/repairs" };
// Drywall and painting appear on every area, which is deliberate rather than
// blanket linking: they are finishing trades that follow the work already
// listed for each sector — wet board comes out and goes back in after water
// damage, a finished basement is boarded and painted, a renovation ends in
// paint. They are ordered per area by how directly they follow that area's
// primary work, not appended in a fixed position.
const DRYWALL = {
  labelEn: "Drywall installation & finishing",
  labelFr: "Installation et finition de gypse",
  href: "/services/drywall",
};
const PAINTING = {
  labelEn: "Interior painting",
  labelFr: "Peinture intérieure",
  href: "/services/painting",
};

export const serviceAreas: ServiceArea[] = [
  {
    slug: "chomedey",
    // Multiplex water-damage work here is largely a board-and-paint job once
    // the wet material is out, and tenant turnover drives repainting.
    relatedServices: [WATER_DAMAGE, DRYWALL, KITCHEN_BATH, FLOORING, PAINTING, REPAIRS],
    sources: [
      {
        label: "Ville de Laval — Chomedey municipal history",
        url: "https://www.laval.ca/en/culture/heritage-history/municipal-history/chomedey/",
      },
      {
        label: "Centris — Laval (Chomedey) community profile",
        url: "https://www.centris.ca/en/tools/community-profile/laval/laval-chomedey",
      },
    ],
    en: {
      name: "Chomedey",
      tagline: "Renovation and water damage restoration in Chomedey, Laval",
      metaDescription:
        "Renovation and water damage restoration in Chomedey, Laval. Multiplex and apartment work, bathroom and kitchen remodels, flooring — for owners, tenants-in-place, and property managers.",
      context: [
        "Chomedey is the most populous sector of Laval, occupying the western part of Île Jésus. It is also one of the densest: roughly 45% of its dwellings are small apartment buildings, with larger apartment buildings and single detached homes making up most of the rest.",
        "Its housing stock spans several distinct waves of construction. About a third of homes here were built between 1960 and 1980, and most of the remainder date either from before 1960 or from the 1980s.",
      ],
      whatThisMeansHeading: "What that means for renovation work here",
      whatThisMeans: [
        "A high share of small apartment buildings means much of our Chomedey work is for landlords and property managers rather than single-family owners — units that have to be turned over on a schedule, often with neighbours still living on the other side of the wall.",
        "In buildings of this era, supply lines, shut-off valves, and original bathroom waterproofing are commonly at or past the end of their service life. That is the most frequent origin of the water-damage calls we take in dense Laval sectors — a failure inside one unit that reaches the units below before anyone notices.",
        "Because units share stacks and structure, we plan containment and access before demolition starts, and document conditions in writing for insurers and syndicates.",
      ],
      faq: [
        {
          question: "Do you work in occupied apartment buildings?",
          answer:
            "Yes. A large share of Chomedey's housing is small apartment buildings, and much of our work there happens with neighbouring units occupied. We set up containment, protect shared corridors, and schedule the noisy phases around agreed hours.",
        },
        {
          question: "Can you coordinate with a property manager or syndicate?",
          answer:
            "That is a routine part of our commercial work. We provide written scope, photo documentation before and after, and invoicing that matches what a manager or insurer needs to process a claim.",
        },
      ],
    },
    fr: {
      name: "Chomedey",
      tagline: "Rénovation et restauration après dégât d'eau à Chomedey, Laval",
      metaDescription:
        "Rénovation et restauration après dégât d'eau à Chomedey, Laval. Travaux en multiplex et en immeuble, salles de bain et cuisines, revêtements de sol — pour propriétaires et gestionnaires immobiliers.",
      context: [
        "Chomedey est le secteur le plus peuplé de Laval et occupe la partie ouest de l'île Jésus. C'est aussi l'un des plus denses : environ 45 % des logements s'y trouvent dans de petits immeubles à appartements, le reste étant surtout composé de grands immeubles et de maisons unifamiliales détachées.",
        "Le parc immobilier y couvre plusieurs vagues de construction distinctes. Environ un tiers des logements ont été construits entre 1960 et 1980, et la majeure partie du reste date soit d'avant 1960, soit des années 1980.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour les travaux ici",
      whatThisMeans: [
        "La forte proportion de petits immeubles fait qu'une grande partie de nos travaux à Chomedey est réalisée pour des propriétaires-bailleurs et des gestionnaires immobiliers — des logements à remettre en état selon un échéancier, souvent avec des voisins toujours sur place de l'autre côté du mur.",
        "Dans les immeubles de cette époque, les conduites d'alimentation, les valves d'arrêt et l'imperméabilisation d'origine des salles de bain arrivent souvent en fin de vie utile. C'est l'origine la plus fréquente des appels de dégât d'eau que nous recevons dans les secteurs denses de Laval : une défaillance dans un logement qui atteint ceux du dessous avant que quiconque s'en aperçoive.",
        "Comme les logements partagent colonnes et structure, nous planifions le confinement et les accès avant le début de la démolition, et documentons les conditions par écrit pour les assureurs et les syndicats.",
      ],
      faq: [
        {
          question: "Travaillez-vous dans des immeubles occupés ?",
          answer:
            "Oui. Une grande partie du parc de Chomedey est constituée de petits immeubles, et une bonne part de nos travaux s'y déroule avec les logements voisins occupés. Nous installons le confinement, protégeons les corridors communs et planifions les phases bruyantes selon des heures convenues.",
        },
        {
          question: "Pouvez-vous coordonner avec un gestionnaire ou un syndicat ?",
          answer:
            "C'est une partie courante de nos mandats commerciaux. Nous fournissons une portée de travaux écrite, une documentation photo avant et après, et une facturation conforme à ce qu'un gestionnaire ou un assureur doit traiter.",
        },
      ],
    },
  },

  {
    slug: "sainte-rose",
    relatedServices: [WATER_DAMAGE, BASEMENTS, DRYWALL, RENOVATIONS, KITCHEN_BATH, PAINTING],
    sources: [
      {
        // Laval abbreviates this sector's slug to "ste-rose" — the spelled-out
        // "sainte-rose" path 404s.
        label: "Ville de Laval — Sainte-Rose municipal history",
        url: "https://www.laval.ca/en/culture/heritage-history/municipal-history/ste-rose/",
      },
      { label: "Sainte-Rose (Laval) — Wikipédia", url: "https://fr.wikipedia.org/wiki/Sainte-Rose_(Laval)" },
    ],
    en: {
      name: "Sainte-Rose",
      tagline: "Renovation and water damage restoration in Sainte-Rose, Laval",
      metaDescription:
        "Renovation and water damage restoration in Sainte-Rose, Laval. Work on older homes in the Vieux Sainte-Rose core and family homes in the Champfleury and Champenois sectors.",
      context: [
        "Sainte-Rose sits along the Rivière des Mille Îles in northern Laval and joined the City of Laval at its founding in 1965. Its historic core, Vieux Sainte-Rose, runs along Boulevard Sainte-Rose and includes the Sainte-Rose-de-Lima church.",
        "The sector did not grow outward from its church the way many Quebec parishes did. Two river crossings shaped it instead, producing two separate development nodes — one along Rue des Patriotes and Boulevard Sainte-Rose, another around Boulevard Sainte-Rose and Boulevard Curé-Labelle. South of the old core lie the Champenois and Champfleury sectors, split by Boulevard Curé-Labelle.",
        "Statistics Canada's 2021 census counted roughly 35,000 residents here, with a median age of 44.5 — an established, family-heavy population.",
      ],
      whatThisMeansHeading: "What that means for renovation work here",
      whatThisMeans: [
        "Sainte-Rose is really two renovation markets in one sector. In and around the old core, we work on genuinely older houses where framing, floor levels, and existing finishes rarely match modern standard dimensions, and where matching what is already there matters more than installing the fastest product.",
        "In the Champfleury and Champenois sectors the stock is more uniformly suburban and family-sized, where the common projects are basement finishing, bathroom updates, and flooring replacement.",
        "Proximity to the Rivière des Mille Îles makes basement water management a live concern rather than a theoretical one, particularly around spring melt. When we finish a basement here, we address the moisture path first — because finishing over an unresolved source is how a small problem becomes a full restoration two years later.",
      ],
      faq: [
        {
          question: "Do you work on older homes in Vieux Sainte-Rose?",
          answer:
            "Yes. Older houses need a different approach: we expect out-of-square framing and non-standard dimensions, and we plan for matching existing finishes rather than assuming stock sizes will fit.",
        },
        {
          question: "Is it worth finishing a basement near the river?",
          answer:
            "Often yes — but only after the moisture source is understood and addressed. We look at drainage and any history of infiltration before quoting finishes, and we will tell you if that work needs to come first.",
        },
      ],
    },
    fr: {
      name: "Sainte-Rose",
      tagline: "Rénovation et restauration après dégât d'eau à Sainte-Rose, Laval",
      metaDescription:
        "Rénovation et restauration après dégât d'eau à Sainte-Rose, Laval. Travaux sur les maisons anciennes du Vieux Sainte-Rose et les maisons familiales des secteurs Champfleury et Champenois.",
      context: [
        "Sainte-Rose borde la rivière des Mille Îles, au nord de Laval, et s'est jointe à la Ville de Laval lors de sa fondation en 1965. Son noyau historique, le Vieux Sainte-Rose, s'étend le long du boulevard Sainte-Rose et comprend l'église Sainte-Rose-de-Lima.",
        "Le secteur ne s'est pas développé autour de son église comme beaucoup de paroisses québécoises. Deux ponts ont plutôt façonné sa croissance, produisant deux pôles distincts — l'un le long de la rue des Patriotes et du boulevard Sainte-Rose, l'autre autour des boulevards Sainte-Rose et Curé-Labelle. Au sud du vieux noyau se trouvent les secteurs Champenois et Champfleury, séparés par le boulevard Curé-Labelle.",
        "Le recensement de Statistique Canada de 2021 y dénombrait environ 35 000 résidents, avec un âge médian de 44,5 ans — une population établie, à forte présence familiale.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour les travaux ici",
      whatThisMeans: [
        "Sainte-Rose représente en réalité deux marchés de rénovation dans un même secteur. Dans le vieux noyau et ses environs, nous travaillons sur des maisons réellement anciennes où la charpente, les niveaux de plancher et les finis existants correspondent rarement aux dimensions standard modernes, et où l'agencement avec l'existant compte davantage que la rapidité de pose.",
        "Dans les secteurs Champfleury et Champenois, le parc est plus uniformément banlieusard et familial : les projets courants y sont l'aménagement de sous-sol, la mise à jour des salles de bain et le remplacement des revêtements de sol.",
        "La proximité de la rivière des Mille Îles fait de la gestion de l'eau au sous-sol une préoccupation concrète, particulièrement à la fonte printanière. Quand nous aménageons un sous-sol ici, nous traitons d'abord le chemin de l'humidité — parce que finir par-dessus une source non résolue, c'est transformer un petit problème en restauration complète deux ans plus tard.",
      ],
      faq: [
        {
          question: "Travaillez-vous sur les maisons anciennes du Vieux Sainte-Rose ?",
          answer:
            "Oui. Les maisons anciennes exigent une autre approche : nous prévoyons une charpente hors d'équerre et des dimensions non standard, et nous planifions l'agencement avec les finis existants plutôt que de présumer que les formats courants s'ajusteront.",
        },
        {
          question: "Vaut-il la peine d'aménager un sous-sol près de la rivière ?",
          answer:
            "Souvent oui — mais seulement après avoir compris et traité la source d'humidité. Nous examinons le drainage et l'historique d'infiltration avant de chiffrer les finis, et nous vous dirons si ces travaux doivent passer en premier.",
        },
      ],
    },
  },

  {
    slug: "vimont",
    // Bungalow basement finishing is board, tape and paint more than anything
    // else, so those two sit high in this sector's list.
    relatedServices: [BASEMENTS, DRYWALL, RENOVATIONS, PAINTING, FLOORING, KITCHEN_BATH],
    sources: [
      {
        label: "Ville de Laval — Vimont municipal history",
        url: "https://www.laval.ca/en/culture/heritage-history/municipal-history/vimont/",
      },
      { label: "Vimont (Laval) — Wikipédia", url: "https://fr.wikipedia.org/wiki/Vimont_(Laval)" },
    ],
    en: {
      name: "Vimont",
      tagline: "Renovation and water damage restoration in Vimont, Laval",
      metaDescription:
        "Renovation and water damage restoration in Vimont, Laval. Specialists in 1950s–60s bungalow renovation: basement finishing, opening up closed layouts, flooring and kitchens.",
      context: [
        "Vimont sits at the geographic centre of Île Jésus and is sometimes called the heart of Laval. It is the only Laval sector that does not border a waterway.",
        "The area stayed agricultural into the 1950s before developing as a residential suburb. Its architecture is defined by single-storey homes — bungalows — built mostly during the 1950s and 1960s, and those bungalows still characterise the sector today.",
      ],
      whatThisMeansHeading: "What that means for renovation work here",
      whatThisMeans: [
        "Vimont has one of the most consistent housing profiles we work in. When a homeowner here describes their house, we usually already know the general layout, the ceiling height we will be working under, and the era of the systems behind the walls.",
        "That consistency is an advantage for estimating: comparable bungalow projects in this sector price more predictably than mixed-era stock elsewhere in Laval.",
        "The two most common projects we see here follow directly from the housing type. First, basements — many were either never finished or finished decades ago in a style and standard that no longer suits how the space is used. Second, the closed room-by-room layouts typical of the period, which owners frequently want opened up.",
        "Being away from any waterway does not remove water risk. In homes of this age the water damage we respond to more often starts inside the house — aging plumbing, a failed water heater, or a slow leak behind a 1960s bathroom — than from outside it.",
      ],
      faq: [
        {
          question: "Can you open up a bungalow's closed floor plan?",
          answer:
            "It is one of the most common requests we get in Vimont. Whether a specific wall can come out depends on whether it is load-bearing, which we confirm on site before quoting — and structural work is handled accordingly, not guessed at.",
        },
        {
          question: "My basement was finished in the 1970s. Can it be redone?",
          answer:
            "Yes, and it is frequent work here. We look at what is behind the existing finishes first — insulation, moisture, and wiring from that era often need attention before new finishes go on.",
        },
      ],
    },
    fr: {
      name: "Vimont",
      tagline: "Rénovation et restauration après dégât d'eau à Vimont, Laval",
      metaDescription:
        "Rénovation et restauration après dégât d'eau à Vimont, Laval. Spécialistes de la rénovation de bungalows des années 1950-60 : sous-sols, ouverture des aires fermées, planchers et cuisines.",
      context: [
        "Vimont se situe au centre géographique de l'île Jésus et est parfois appelé le cœur de Laval. C'est le seul secteur lavallois qui ne borde aucun cours d'eau.",
        "Le secteur est demeuré agricole jusque dans les années 1950 avant de se développer en banlieue résidentielle. Son architecture est marquée par les maisons de plain-pied — les bungalows — construites majoritairement durant les années 1950 et 1960, et ces bungalows caractérisent encore le quartier aujourd'hui.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour les travaux ici",
      whatThisMeans: [
        "Vimont présente l'un des profils résidentiels les plus homogènes parmi les secteurs où nous travaillons. Quand un propriétaire d'ici nous décrit sa maison, nous connaissons généralement déjà l'agencement général, la hauteur de plafond sous laquelle nous travaillerons et l'époque des systèmes derrière les murs.",
        "Cette homogénéité est un avantage pour l'estimation : des projets de bungalow comparables se chiffrent ici de façon plus prévisible qu'un parc d'époques mélangées ailleurs à Laval.",
        "Les deux projets les plus courants ici découlent directement du type d'habitation. D'abord les sous-sols : beaucoup n'ont jamais été finis, ou l'ont été il y a des décennies selon un style et un standard qui ne correspondent plus à l'usage actuel. Ensuite les aires fermées pièce par pièce, typiques de l'époque, que les propriétaires souhaitent fréquemment ouvrir.",
        "Être éloigné de tout cours d'eau n'élimine pas le risque d'eau. Dans les maisons de cet âge, les dégâts d'eau auxquels nous répondons proviennent plus souvent de l'intérieur — plomberie vieillissante, chauffe-eau défaillant, fuite lente derrière une salle de bain des années 1960 — que de l'extérieur.",
      ],
      faq: [
        {
          question: "Pouvez-vous ouvrir l'aménagement fermé d'un bungalow ?",
          answer:
            "C'est l'une des demandes les plus fréquentes que nous recevons à Vimont. Qu'un mur précis puisse être retiré dépend de son caractère porteur, que nous confirmons sur place avant de chiffrer — les travaux structuraux sont traités en conséquence, jamais présumés.",
        },
        {
          question: "Mon sous-sol a été fini dans les années 1970. Peut-on le refaire ?",
          answer:
            "Oui, et c'est un travail fréquent ici. Nous examinons d'abord ce qui se trouve derrière les finis existants — l'isolation, l'humidité et le filage de cette époque demandent souvent une intervention avant la pose de nouveaux finis.",
        },
      ],
    },
  },

  {
    slug: "fabreville",
    relatedServices: [RENOVATIONS, KITCHEN_BATH, FLOORING, BASEMENTS, DRYWALL, PAINTING],
    sources: [
      {
        label: "Ville de Laval — Fabreville municipal history",
        url: "https://www.laval.ca/en/culture/heritage-history/municipal-history/fabreville/",
      },
      { label: "Fabreville — Wikipédia", url: "https://fr.wikipedia.org/wiki/Fabreville" },
    ],
    en: {
      name: "Fabreville",
      tagline: "Renovation and water damage restoration in Fabreville, Laval",
      metaDescription:
        "Renovation and water damage restoration in Fabreville, Laval. Single-family, semi-detached and townhouse renovation across a sector with housing from the 1950s to new construction.",
      context: [
        "Fabreville occupies the northwest of Laval. It was its own municipality — Ville de Fabreville, named for Mgr Édouard-Charles Fabre — from 1957 until the 1965 merger that created Laval, and the sector name was formally adopted on 5 December 1968.",
        "It has been in continuous development since. The housing is mainly single-family homes, along with semi-detached houses, townhouses, and a growing share of newer residential units.",
      ],
      whatThisMeansHeading: "What that means for renovation work here",
      whatThisMeans: [
        "Fabreville is the opposite of a single-era sector. Because it has been built out continuously rather than in one wave, two houses a few streets apart can be separated by decades of construction practice — different framing standards, different insulation, different plumbing and electrical of their day.",
        "That is why we do not quote Fabreville work from an address and a square footage alone. The construction era changes both what we find behind the walls and what the job actually costs, so the site visit does real work here.",
        "The mix also means the full range of projects: newer homes typically want finish-level upgrades — kitchens, bathrooms, flooring — while the older stock more often needs the systems behind those finishes addressed at the same time.",
      ],
      faq: [
        {
          question: "How do I know what my Fabreville house needs?",
          answer:
            "The honest answer is that the construction era matters more than the address. Housing here ranges from the 1950s to new builds, and that difference changes the scope. A site visit tells us what is actually behind the finishes before anyone commits to a number.",
        },
        {
          question: "Do you handle townhouses and semi-detached homes?",
          answer:
            "Yes — both are common in Fabreville. Shared walls change how we plan dust control, noise, and access, and we account for that in the schedule rather than discovering it mid-job.",
        },
      ],
    },
    fr: {
      name: "Fabreville",
      tagline: "Rénovation et restauration après dégât d'eau à Fabreville, Laval",
      metaDescription:
        "Rénovation et restauration après dégât d'eau à Fabreville, Laval. Rénovation de maisons unifamiliales, jumelées et de ville dans un secteur bâti des années 1950 à aujourd'hui.",
      context: [
        "Fabreville occupe le nord-ouest de Laval. Le secteur a été une municipalité à part entière — la ville de Fabreville, nommée en l'honneur de Mgr Édouard-Charles Fabre — de 1957 jusqu'à la fusion de 1965 qui a créé Laval, et son nom a été officialisé le 5 décembre 1968.",
        "Le secteur est en développement continu depuis. L'habitation y est principalement composée de maisons unifamiliales, auxquelles s'ajoutent des maisons jumelées, des maisons de ville et une proportion croissante d'unités résidentielles plus récentes.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour les travaux ici",
      whatThisMeans: [
        "Fabreville est l'inverse d'un secteur d'une seule époque. Comme il s'est bâti en continu plutôt qu'en une seule vague, deux maisons situées à quelques rues l'une de l'autre peuvent être séparées par des décennies de pratiques de construction — normes de charpente, isolation, plomberie et électricité de leur temps.",
        "C'est pourquoi nous ne chiffrons pas un projet à Fabreville à partir d'une adresse et d'une superficie seulement. L'époque de construction change à la fois ce que nous trouvons derrière les murs et le coût réel des travaux : la visite sur place a ici une véritable utilité.",
        "Cette diversité amène aussi toute la gamme de projets : les maisons récentes demandent surtout des mises à niveau de finition — cuisines, salles de bain, planchers — tandis que le parc plus ancien exige plus souvent d'intervenir en même temps sur les systèmes derrière ces finis.",
      ],
      faq: [
        {
          question: "Comment savoir ce dont ma maison de Fabreville a besoin ?",
          answer:
            "La réponse honnête est que l'époque de construction compte davantage que l'adresse. Le parc va ici des années 1950 aux constructions neuves, et cet écart change la portée des travaux. Une visite sur place nous dit ce qui se trouve réellement derrière les finis avant que quiconque s'engage sur un montant.",
        },
        {
          question: "Faites-vous les maisons de ville et les jumelées ?",
          answer:
            "Oui — les deux sont courantes à Fabreville. Les murs mitoyens changent la planification du contrôle de la poussière, du bruit et des accès, et nous en tenons compte dans l'échéancier plutôt que de le découvrir en cours de chantier.",
        },
      ],
    },
  },

  {
    slug: "duvernay",
    // Flat-roof infiltration in the El Rancho stock lands on ceilings and
    // walls first, which is drywall work before it is anything else.
    relatedServices: [WATER_DAMAGE, DRYWALL, RENOVATIONS, BASEMENTS, PAINTING, FLOORING],
    sources: [
      {
        label: "Ville de Laval — Duvernay municipal history",
        url: "https://www.laval.ca/en/culture/heritage-history/municipal-history/duvernay/",
      },
      { label: "Duvernay (Laval) — Wikipédia", url: "https://fr.wikipedia.org/wiki/Duvernay_(Laval)" },
    ],
    en: {
      name: "Duvernay",
      tagline: "Renovation and water damage restoration in Duvernay, Laval",
      metaDescription:
        "Renovation and water damage restoration in Duvernay, Laval — including the mid-century El Rancho ranch houses, where flat roofs create a distinct water infiltration profile.",
      context: [
        "Duvernay's residential growth came mainly in its southwest, part of the broader wave of suburb-building across the Montreal region in the post-war decades. Through the 1960s the municipality added modern infrastructure of its own, including a municipal garage, a water treatment plant, and a town hall broken ground on 14 January 1961.",
        "Its most distinctive housing came from Maurice Joubert, mayor of Duvernay from 1957 to 1959 and a builder himself, who developed a residential enclave he named El Rancho after the mid-century modern style then popular on the American west coast. Those ranch-style houses, built between 1954 and 1963, are recognisable by their single storey and their flat roofs finished in cedar shingles.",
      ],
      whatThisMeansHeading: "What that means for renovation work here",
      whatThisMeans: [
        "Duvernay is the one Laval sector where roof type changes our water-damage conversation before we have even seen the house. A flat roof sheds water completely differently from a pitched one: drainage matters more, ponding is possible, and infiltration tends to appear on the interior some distance from where it actually got in.",
        "That gap between where water shows up and where it entered is the single most expensive misunderstanding in this kind of house. Chasing the stain instead of the source is how the same ceiling gets repaired twice.",
        "The El Rancho houses also carry real architectural character. When we repair or renovate one, the aim is work that reads as original rather than a patch — which is a different standard than simply making it watertight, and we price it as such.",
        "Beyond that enclave, Duvernay's broader post-war stock brings the usual work of homes of that age: dated finishes over systems that have reached the end of their service life.",
      ],
      faq: [
        {
          question: "Do you have experience with flat roofs and the El Rancho houses?",
          answer:
            "Yes. Flat-roof water infiltration behaves differently from a pitched roof — the interior damage often shows up well away from the entry point, so we trace the source rather than just repairing the visible stain.",
        },
        {
          question: "Can a mid-century house be renovated without losing its character?",
          answer:
            "That is usually the goal here. These homes have a recognisable style, and work that ignores it is obvious afterward. We discuss up front where matching the original matters to you and where a modern solution is the better call.",
        },
      ],
    },
    fr: {
      name: "Duvernay",
      tagline: "Rénovation et restauration après dégât d'eau à Duvernay, Laval",
      metaDescription:
        "Rénovation et restauration après dégât d'eau à Duvernay, Laval — incluant les maisons El Rancho d'époque moderne, dont les toits plats créent un profil d'infiltration distinct.",
      context: [
        "La croissance résidentielle de Duvernay s'est faite principalement dans le sud-ouest, dans la foulée de la multiplication des secteurs de banlieue partout dans la région de Montréal durant l'après-guerre. Au cours des années 1960, la municipalité se dote d'installations modernes : garage municipal, usine d'épuration et hôtel de ville, dont la première pelletée de terre a lieu le 14 janvier 1961.",
        "Son habitation la plus distinctive vient de Maurice Joubert, maire de Duvernay de 1957 à 1959 et entrepreneur, qui a développé un secteur résidentiel baptisé El Rancho, inspiré du style mid-century modern alors en vogue sur la côte ouest américaine. Ces maisons d'allure ranch, construites entre 1954 et 1963, sont reconnaissables à leur unique étage et à leur toit plat recouvert de bardeaux de cèdre.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour les travaux ici",
      whatThisMeans: [
        "Duvernay est le secteur lavallois où le type de toiture change notre conversation sur les dégâts d'eau avant même d'avoir vu la maison. Un toit plat évacue l'eau tout autrement qu'un toit en pente : le drainage compte davantage, l'accumulation est possible, et l'infiltration se manifeste souvent à l'intérieur à bonne distance de son point d'entrée réel.",
        "Cet écart entre l'endroit où l'eau apparaît et celui où elle est entrée est le malentendu le plus coûteux dans ce type de maison. Poursuivre la tache plutôt que la source, c'est réparer deux fois le même plafond.",
        "Les maisons El Rancho ont aussi un véritable caractère architectural. Quand nous en réparons ou en rénovons une, l'objectif est un travail qui se lit comme l'original plutôt que comme une rustine — un standard différent de la simple étanchéité, et nous le chiffrons comme tel.",
        "Au-delà de ce secteur, le parc d'après-guerre plus large de Duvernay amène les travaux habituels des maisons de cet âge : des finis datés par-dessus des systèmes arrivés en fin de vie utile.",
      ],
      faq: [
        {
          question: "Avez-vous de l'expérience avec les toits plats et les maisons El Rancho ?",
          answer:
            "Oui. L'infiltration par toit plat se comporte autrement que sur un toit en pente — les dommages intérieurs apparaissent souvent loin du point d'entrée, alors nous remontons à la source plutôt que de réparer seulement la tache visible.",
        },
        {
          question: "Peut-on rénover une maison d'époque sans lui faire perdre son caractère ?",
          answer:
            "C'est habituellement l'objectif ici. Ces maisons ont un style reconnaissable, et un travail qui l'ignore se voit après coup. Nous discutons dès le départ des endroits où respecter l'original compte pour vous et de ceux où une solution moderne est le meilleur choix.",
        },
      ],
    },
  },
];

export function getServiceArea(slug: string): ServiceArea | undefined {
  return serviceAreas.find((area) => area.slug === slug);
}
