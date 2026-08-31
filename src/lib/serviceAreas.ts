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
  /**
   * Compact SERP title (the layout template appends " | Renovision AnA").
   * The tagline stays as the on-page H1; at 56-78 chars it was getting
   * truncated in Google results once the brand suffix was added.
   */
  metaTitle: string;
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
   * Slugs of nearby served sectors, rendered as a "nearby areas" block so the
   * local pages link laterally instead of only up to the index. Loose
   * geographic proximity, not strict adjacency.
   */
  neighbors: string[];
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
/**
 * Sewer backup. Listed only on the four Montréal boroughs, and that restraint
 * is the point: the sewer-backup page's local content is built on Ville de
 * Montréal's backwater-valve by-law and its Rénoplex subsidy, neither of which
 * applies in Laval. Adding it to the Laval sectors would put a link there that
 * the destination page cannot yet speak to specifically — the same "curated per
 * housing stock, not blanket-linked" rule the rest of this file follows.
 *
 * Add the Laval sectors once someone has confirmed Laval's own requirement
 * against a primary ville.laval.qc.ca source and the page says what it is.
 */
const SEWER_BACKUP = {
  labelEn: "Sewer backup cleanup",
  labelFr: "Nettoyage après refoulement d'égout",
  href: "/services/sewer-backup",
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
    neighbors: ["fabreville", "vimont", "saint-laurent"],
    // Multiplex water-damage work here is largely a board-and-paint job once
    // the wet material is out, and tenant turnover drives repainting.
    relatedServices: [WATER_DAMAGE, SEWER_BACKUP, DRYWALL, KITCHEN_BATH, FLOORING, PAINTING],
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
      metaTitle: "Water Damage & Renovation in Chomedey, Laval",
      metaDescription:
        "Renovation and water damage restoration in Chomedey. Multiplex and apartment work, bathroom and kitchen remodels, flooring — for owners and property managers.",
      context: [
        "Chomedey is the most populous sector of Laval, occupying the western part of Île Jésus. It is also one of the densest: roughly 45% of its dwellings are small apartment buildings, with larger apartment buildings and single detached homes making up most of the rest.",
        "Its housing stock spans several distinct waves of construction. About a third of homes here were built between 1960 and 1980, and most of the remainder date either from before 1960 or from the 1980s.",
      ],
      whatThisMeansHeading: "What that means for renovation and water damage in Chomedey",
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
      metaTitle: "Dégât d'eau et rénovation à Chomedey, Laval",
      metaDescription:
        "Rénovation et dégât d'eau à Chomedey, Laval. Multiplex et immeubles, salles de bain et cuisines, planchers — pour propriétaires et gestionnaires immobiliers.",
      context: [
        "Chomedey est le secteur le plus peuplé de Laval et occupe la partie ouest de l'île Jésus. C'est aussi l'un des plus denses : environ 45 % des logements s'y trouvent dans de petits immeubles à appartements, le reste étant surtout composé de grands immeubles et de maisons unifamiliales détachées.",
        "Le parc immobilier y couvre plusieurs vagues de construction distinctes. Environ un tiers des logements ont été construits entre 1960 et 1980, et la majeure partie du reste date soit d'avant 1960, soit des années 1980.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour la rénovation et les dégâts d'eau à Chomedey",
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
    neighbors: ["fabreville", "vimont", "terrebonne"],
    relatedServices: [WATER_DAMAGE, SEWER_BACKUP, BASEMENTS, DRYWALL, RENOVATIONS, PAINTING],
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
      metaTitle: "Water Damage & Renovation in Sainte-Rose, Laval",
      metaDescription:
        "Renovation and water damage restoration in Sainte-Rose, Laval: older homes of Vieux Sainte-Rose, family homes in Champfleury and Champenois.",
      context: [
        "Sainte-Rose sits along the Rivière des Mille Îles in northern Laval and joined the City of Laval at its founding in 1965. Its historic core, Vieux Sainte-Rose, runs along Boulevard Sainte-Rose and includes the Sainte-Rose-de-Lima church.",
        "The sector did not grow outward from its church the way many Quebec parishes did. Two river crossings shaped it instead, producing two separate development nodes — one along Rue des Patriotes and Boulevard Sainte-Rose, another around Boulevard Sainte-Rose and Boulevard Curé-Labelle. South of the old core lie the Champenois and Champfleury sectors, split by Boulevard Curé-Labelle.",
        "Statistics Canada's 2021 census counted roughly 35,000 residents here, with a median age of 44.5 — an established, family-heavy population.",
      ],
      whatThisMeansHeading: "What that means for renovation and water damage in Sainte-Rose",
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
      metaTitle: "Dégât d'eau et rénovation à Sainte-Rose, Laval",
      metaDescription:
        "Rénovation et dégât d'eau à Sainte-Rose, Laval : maisons anciennes du Vieux Sainte-Rose, maisons familiales de Champfleury et Champenois.",
      context: [
        "Sainte-Rose borde la rivière des Mille Îles, au nord de Laval, et s'est jointe à la Ville de Laval lors de sa fondation en 1965. Son noyau historique, le Vieux Sainte-Rose, s'étend le long du boulevard Sainte-Rose et comprend l'église Sainte-Rose-de-Lima.",
        "Le secteur ne s'est pas développé autour de son église comme beaucoup de paroisses québécoises. Deux ponts ont plutôt façonné sa croissance, produisant deux pôles distincts — l'un le long de la rue des Patriotes et du boulevard Sainte-Rose, l'autre autour des boulevards Sainte-Rose et Curé-Labelle. Au sud du vieux noyau se trouvent les secteurs Champenois et Champfleury, séparés par le boulevard Curé-Labelle.",
        "Le recensement de Statistique Canada de 2021 y dénombrait environ 35 000 résidents, avec un âge médian de 44,5 ans — une population établie, à forte présence familiale.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour la rénovation et les dégâts d'eau à Sainte-Rose",
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
    neighbors: ["sainte-rose", "duvernay", "chomedey"],
    // Bungalow basement finishing is board, tape and paint more than anything
    // else, so those two sit high in this sector's list.
    // Water damage was missing here while the page's title, H1, meta description
    // and section heading all promised it, and its own copy carries a paragraph
    // on interior water risk in 1950s-60s stock. The list was simply wrong.
    // FLOORING makes way because it is the one service Vimont's four paragraphs
    // never mention; KITCHEN_BATH stays because the "fuite lente derrière une
    // salle de bain des années 1960" is precisely that job.
    //
    // Deliberately NOT SEWER_BACKUP, even though the Laval by-law applies and
    // listing water damage now makes it eligible under the rule used elsewhere:
    // this sector's water story is explicitly interior — "plus souvent de
    // l'intérieur" — aging plumbing and failed water heaters, not backups.
    relatedServices: [WATER_DAMAGE, BASEMENTS, DRYWALL, RENOVATIONS, KITCHEN_BATH, PAINTING],
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
      metaTitle: "Water Damage & Renovation in Vimont, Laval",
      metaDescription:
        "Renovation and water damage restoration in Vimont, Laval. 1950s–60s bungalow specialists: basements, opening closed layouts, flooring and kitchens.",
      context: [
        "Vimont sits at the geographic centre of Île Jésus and is sometimes called the heart of Laval. It is the only Laval sector that does not border a waterway.",
        "The area stayed agricultural into the 1950s before developing as a residential suburb. Its architecture is defined by single-storey homes — bungalows — built mostly during the 1950s and 1960s, and those bungalows still characterise the sector today.",
      ],
      whatThisMeansHeading: "What that means for renovation and water damage in Vimont",
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
      metaTitle: "Dégât d'eau et rénovation à Vimont, Laval",
      metaDescription:
        "Rénovation et dégât d'eau à Vimont, Laval. Spécialistes des bungalows 1950-60 : sous-sols, ouverture des aires fermées, planchers et cuisines.",
      context: [
        "Vimont se situe au centre géographique de l'île Jésus et est parfois appelé le cœur de Laval. C'est le seul secteur lavallois qui ne borde aucun cours d'eau.",
        "Le secteur est demeuré agricole jusque dans les années 1950 avant de se développer en banlieue résidentielle. Son architecture est marquée par les maisons de plain-pied — les bungalows — construites majoritairement durant les années 1950 et 1960, et ces bungalows caractérisent encore le quartier aujourd'hui.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour la rénovation et les dégâts d'eau à Vimont",
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
    neighbors: ["sainte-rose", "chomedey"],
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
      metaTitle: "Water Damage & Renovation in Fabreville, Laval",
      metaDescription:
        "Renovation and water damage restoration in Fabreville, Laval. Single-family, semi-detached and townhouse work, from 1950s stock to new builds.",
      context: [
        "Fabreville occupies the northwest of Laval. It was its own municipality — Ville de Fabreville, named for Mgr Édouard-Charles Fabre — from 1957 until the 1965 merger that created Laval, and the sector name was formally adopted on 5 December 1968.",
        "It has been in continuous development since. The housing is mainly single-family homes, along with semi-detached houses, townhouses, and a growing share of newer residential units.",
      ],
      whatThisMeansHeading: "What that means for renovation work in Fabreville",
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
      metaTitle: "Dégât d'eau et rénovation à Fabreville, Laval",
      metaDescription:
        "Rénovation et dégât d'eau à Fabreville, Laval. Maisons unifamiliales, jumelées et de ville, du parc des années 1950 aux constructions neuves.",
      context: [
        "Fabreville occupe le nord-ouest de Laval. Le secteur a été une municipalité à part entière — la ville de Fabreville, nommée en l'honneur de Mgr Édouard-Charles Fabre — de 1957 jusqu'à la fusion de 1965 qui a créé Laval, et son nom a été officialisé le 5 décembre 1968.",
        "Le secteur est en développement continu depuis. L'habitation y est principalement composée de maisons unifamiliales, auxquelles s'ajoutent des maisons jumelées, des maisons de ville et une proportion croissante d'unités résidentielles plus récentes.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour les travaux de rénovation à Fabreville",
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
    neighbors: ["vimont", "montreal-nord", "terrebonne"],
    // Flat-roof infiltration in the El Rancho stock lands on ceilings and
    // walls first, which is drywall work before it is anything else.
    relatedServices: [WATER_DAMAGE, SEWER_BACKUP, DRYWALL, RENOVATIONS, BASEMENTS, PAINTING],
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
      metaTitle: "Water Damage & Renovation in Duvernay, Laval",
      metaDescription:
        "Renovation and water damage restoration in Duvernay, Laval — including El Rancho's flat-roofed ranch houses and their distinct infiltration profile.",
      context: [
        "Duvernay's residential growth came mainly in its southwest, part of the broader wave of suburb-building across the Montreal region in the post-war decades. Through the 1960s the municipality added modern infrastructure of its own, including a municipal garage, a water treatment plant, and a town hall broken ground on 14 January 1961.",
        "Its most distinctive housing came from Maurice Joubert, mayor of Duvernay from 1957 to 1959 and a builder himself, who developed a residential enclave he named El Rancho after the mid-century modern style then popular on the American west coast. Those ranch-style houses, built between 1954 and 1963, are recognisable by their single storey and their flat roofs finished in cedar shingles.",
      ],
      whatThisMeansHeading: "What that means for renovation and water damage in Duvernay",
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
      metaTitle: "Dégât d'eau et rénovation à Duvernay, Laval",
      metaDescription:
        "Rénovation et dégât d'eau à Duvernay, Laval — incluant les maisons El Rancho à toit plat et leur profil d'infiltration distinct.",
      context: [
        "La croissance résidentielle de Duvernay s'est faite principalement dans le sud-ouest, dans la foulée de la multiplication des secteurs de banlieue partout dans la région de Montréal durant l'après-guerre. Au cours des années 1960, la municipalité se dote d'installations modernes : garage municipal, usine d'épuration et hôtel de ville, dont la première pelletée de terre a lieu le 14 janvier 1961.",
        "Son habitation la plus distinctive vient de Maurice Joubert, maire de Duvernay de 1957 à 1959 et entrepreneur, qui a développé un secteur résidentiel baptisé El Rancho, inspiré du style mid-century modern alors en vogue sur la côte ouest américaine. Ces maisons d'allure ranch, construites entre 1954 et 1963, sont reconnaissables à leur unique étage et à leur toit plat recouvert de bardeaux de cèdre.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour la rénovation et les dégâts d'eau à Duvernay",
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

  // ---------------------------------------------------------------------
  // Montreal boroughs. Same sourcing rule as the Laval sectors above: the
  // `context` facts come from Ville de Montréal's own borough pages and
  // published borough histories, never from pattern-matching one borough
  // onto another. Ahuntsic-Cartierville and Montréal-Nord both sit on the
  // south bank of the Rivière des Prairies, directly opposite Laval.
  // ---------------------------------------------------------------------

  {
    slug: "ahuntsic-cartierville",
    neighbors: ["saint-laurent", "montreal-nord", "chomedey"],
    relatedServices: [WATER_DAMAGE, SEWER_BACKUP, DRYWALL, RENOVATIONS, KITCHEN_BATH, PAINTING],
    sources: [
      { label: "Ville de Montréal — Ahuntsic-Cartierville", url: "https://montreal.ca/ahuntsic-cartierville" },
      {
        label: "Ahuntsic-Cartierville — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Ahuntsic-Cartierville",
      },
    ],
    en: {
      name: "Ahuntsic-Cartierville",
      tagline: "Renovation and water damage restoration in Ahuntsic-Cartierville, Montreal",
      metaTitle: "Water Damage & Renovation in Ahuntsic-Cartierville",
      metaDescription:
        "Renovation and water damage restoration in Ahuntsic-Cartierville: post-war brick duplexes and triplexes, kitchens, bathrooms, Sault-au-Récollet homes.",
      context: [
        "Ahuntsic-Cartierville sits on the south bank of the Rivière des Prairies, directly across the water from Laval. Its oldest core, Sault-au-Récollet, grew from a Sulpician settlement established in 1696 and still holds houses dating from the 18th and 19th centuries.",
        "Cartierville developed later and for a different reason: it became the northern terminus of the Montreal Park and Island Railway tramway line in 1898 and was incorporated as a village in 1906, named for Sir George-Étienne Cartier. Most of the borough's current housing came later still, in the post-war push northward — solid brick duplexes and triplexes, bungalows, and two-storey homes.",
      ],
      whatThisMeansHeading: "What that means for renovation work in Ahuntsic-Cartierville",
      whatThisMeans: [
        "This is really two housing stocks in one borough, and they call for different work. A 19th-century house in Sault-au-Récollet and a 1950s brick triplex a few streets away have almost nothing in common once the walls are open.",
        "The post-war duplexes and triplexes are the bulk of it, and their units are typically larger than the narrow Plateau format — which means full kitchen and bathroom renovations are common rather than the compact reworks that tighter floor plans force.",
        "In a triplex, work in one unit is work in a shared building. We plan containment and access before demolition starts, the same way we do in Laval's multiplex sectors across the river.",
      ],
      faq: [
        {
          question: "Do you work on older houses in Sault-au-Récollet?",
          answer:
            "Yes. Housing of that age needs decisions made deliberately — what gets restored, what gets replaced, and where a modern assembly is genuinely the better answer. We raise those before demolition, not after.",
        },
        {
          question: "How quickly can you get here from Laval?",
          answer:
            "The borough is directly across the Rivière des Prairies from us, so it is one of the closest areas we serve. For water damage that matters, because the useful window is measured in hours.",
        },
      ],
    },
    fr: {
      name: "Ahuntsic-Cartierville",
      tagline: "Rénovation et restauration après dégât d'eau à Ahuntsic-Cartierville, Montréal",
      metaTitle: "Dégât d'eau et rénovation à Ahuntsic-Cartierville",
      metaDescription:
        "Rénovation et dégât d'eau à Ahuntsic-Cartierville : duplex et triplex de brique, cuisines et salles de bain, maisons du Sault-au-Récollet.",
      context: [
        "Ahuntsic-Cartierville borde la rive sud de la rivière des Prairies, directement en face de Laval. Son noyau le plus ancien, le Sault-au-Récollet, est né d'un établissement sulpicien fondé en 1696 et conserve encore des maisons des XVIIIe et XIXe siècles.",
        "Cartierville s'est développé plus tard et pour une autre raison : le secteur est devenu en 1898 le terminus nord de la ligne de tramway du Montreal Park and Island Railway, puis un village en 1906, nommé en l'honneur de sir George-Étienne Cartier. L'essentiel du parc actuel est toutefois plus récent, issu de l'expansion d'après-guerre vers le nord — duplex et triplex de brique massive, bungalows et maisons à deux étages.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour les travaux de rénovation à Ahuntsic-Cartierville",
      whatThisMeans: [
        "Il s'agit en réalité de deux parcs immobiliers dans un même arrondissement, et ils appellent des travaux différents. Une maison du XIXe siècle au Sault-au-Récollet et un triplex de brique des années 1950 à quelques rues de là n'ont pratiquement rien en commun une fois les murs ouverts.",
        "Les duplex et triplex d'après-guerre forment le gros du parc, et leurs logements sont généralement plus grands que l'étroit format du Plateau — ce qui rend courantes les rénovations complètes de cuisine et de salle de bain, plutôt que les réaménagements compacts qu'imposent des plans plus serrés.",
        "Dans un triplex, intervenir dans un logement, c'est intervenir dans un immeuble partagé. Nous planifions le confinement et les accès avant le début de la démolition, comme nous le faisons dans les secteurs de multiplex de Laval, de l'autre côté de la rivière.",
      ],
      faq: [
        {
          question: "Travaillez-vous sur les maisons anciennes du Sault-au-Récollet ?",
          answer:
            "Oui. Un parc de cet âge exige des décisions prises délibérément : ce qu'on restaure, ce qu'on remplace, et les endroits où un assemblage moderne est réellement la meilleure réponse. Nous soulevons ces questions avant la démolition, pas après.",
        },
        {
          question: "Combien de temps pour vous rendre depuis Laval ?",
          answer:
            "L'arrondissement est directement de l'autre côté de la rivière des Prairies : c'est l'un des secteurs les plus proches que nous desservons. Pour un dégât d'eau, cela compte, car la fenêtre utile se mesure en heures.",
        },
      ],
    },
  },

  {
    slug: "montreal-nord",
    neighbors: ["ahuntsic-cartierville", "duvernay"],
    // 70% of households here rent, so the work skews heavily to landlord and
    // property-manager turnover rather than owner-occupier projects.
    relatedServices: [WATER_DAMAGE, SEWER_BACKUP, DRYWALL, PAINTING, REPAIRS, FLOORING],
    sources: [
      { label: "Ville de Montréal — Montréal-Nord", url: "https://montreal.ca/montreal-nord" },
      { label: "Montréal-Nord — Britannica", url: "https://www.britannica.com/place/Montreal-Nord" },
    ],
    en: {
      name: "Montréal-Nord",
      tagline: "Renovation and water damage restoration in Montréal-Nord",
      metaTitle: "Water Damage & Renovation in Montréal-Nord",
      metaDescription:
        "Renovation and water damage restoration in Montréal-Nord. Apartment and duplex turnovers, water damage repair, drywall and painting for landlords.",
      context: [
        "Montréal-Nord follows the south shore of the Rivière des Prairies, across the water from Laval. It was incorporated as a town in 1915, grew quickly after the Second World War, became a city in 1959, and was merged into Montreal as a borough in 2002.",
        "About half its buildings went up in the 1960s and 1970s, with most of the remainder predating 1960. Small apartment buildings are the most common housing type, duplexes are common too, and roughly 70% of households here rent rather than own.",
      ],
      whatThisMeansHeading: "What that means for renovation and water damage in Montréal-Nord",
      whatThisMeans: [
        "A borough where seven households in ten are renters produces a particular kind of work: turnover between tenants, scheduled against lease dates rather than preference, and priced to be worth doing repeatedly. Patch, prime, paint and flooring make up a large share of it.",
        "The 1960s-70s stock that dominates here is the same era we work in constantly across the river in Chomedey, and it fails in the same places — supply lines, shut-off valves, and original bathroom waterproofing at or past the end of their service life.",
        "In a small apartment building, one failure rarely stays in one unit. Water finds the units below before anyone notices, which is why we document conditions in writing for owners and insurers from the first visit.",
      ],
      faq: [
        {
          question: "Do you handle turnover work between tenants?",
          answer:
            "Regularly. It is one of the most common reasons we are called in this borough. We work backwards from the date the next tenant moves in, and tell you upfront if that date is not realistic rather than discovering it halfway through.",
        },
        {
          question: "Can you work in an occupied building?",
          answer:
            "Yes. Most of the buildings here are occupied while we work. We set up containment, protect shared corridors, and keep the noisy phases inside agreed hours.",
        },
      ],
    },
    fr: {
      name: "Montréal-Nord",
      tagline: "Rénovation et restauration après dégât d'eau à Montréal-Nord",
      metaTitle: "Dégât d'eau et rénovation à Montréal-Nord",
      metaDescription:
        "Rénovation et dégât d'eau à Montréal-Nord. Remise en état entre locataires, gypse et peinture — pour propriétaires-bailleurs et gestionnaires.",
      context: [
        "Montréal-Nord longe la rive sud de la rivière des Prairies, en face de Laval. L'arrondissement a été constitué en ville en 1915, a connu une croissance rapide après la Seconde Guerre mondiale, est devenu une cité en 1959, puis a été fusionné à Montréal comme arrondissement en 2002.",
        "Environ la moitié des bâtiments datent des années 1960 et 1970, et la majeure partie du reste est antérieure à 1960. Les petits immeubles à logements y sont le type d'habitation le plus courant, les duplex sont fréquents, et environ 70 % des ménages y sont locataires plutôt que propriétaires.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour la rénovation et les dégâts d'eau à Montréal-Nord",
      whatThisMeans: [
        "Un arrondissement où sept ménages sur dix sont locataires génère un type de travail bien précis : la remise en état entre deux locataires, planifiée en fonction des dates de bail et non des préférences, et chiffrée pour valoir la peine d'être refaite souvent. Rebouchage, apprêt, peinture et revêtements de sol en composent une grande part.",
        "Le parc des années 1960-70 qui domine ici correspond à l'époque dans laquelle nous travaillons constamment de l'autre côté de la rivière, à Chomedey, et il cède aux mêmes endroits : conduites d'alimentation, valves d'arrêt et imperméabilisation d'origine des salles de bain en fin de vie utile.",
        "Dans un petit immeuble, une défaillance reste rarement dans un seul logement. L'eau atteint les unités du dessous avant que quiconque s'en aperçoive : c'est pourquoi nous documentons les conditions par écrit pour les propriétaires et les assureurs dès la première visite.",
      ],
      faq: [
        {
          question: "Faites-vous la remise en état entre deux locataires ?",
          answer:
            "Régulièrement. C'est l'une des raisons les plus fréquentes pour lesquelles on nous appelle dans cet arrondissement. Nous remontons le calendrier à partir de la date d'entrée du prochain locataire, et nous vous disons d'avance si cette date n'est pas réaliste plutôt que de le découvrir à mi-chemin.",
        },
        {
          question: "Pouvez-vous travailler dans un immeuble occupé ?",
          answer:
            "Oui. La plupart des immeubles ici sont occupés pendant nos travaux. Nous installons le confinement, protégeons les corridors communs et gardons les phases bruyantes dans des heures convenues.",
        },
      ],
    },
  },

  {
    slug: "saint-laurent",
    neighbors: ["ahuntsic-cartierville", "lasalle", "chomedey"],
    relatedServices: [RENOVATIONS, KITCHEN_BATH, BASEMENTS, DRYWALL, FLOORING, PAINTING],
    sources: [
      { label: "Ville de Montréal — Saint-Laurent", url: "https://montreal.ca/en/about/saint-laurent" },
      {
        label: "Saint-Laurent, Quebec — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Saint-Laurent,_Quebec",
      },
    ],
    en: {
      name: "Saint-Laurent",
      tagline: "Renovation and water damage restoration in Saint-Laurent, Montreal",
      metaTitle: "Water Damage & Renovation in Saint-Laurent, Montreal",
      metaDescription:
        "Renovation and water damage restoration in Saint-Laurent: wartime-house renovations, kitchens, bathrooms and basements in Norvick and Bois-Franc.",
      context: [
        "Saint-Laurent's residential character was shaped by the Second World War. Wartime Housing Limited, created by the federal government to house workers supporting the war effort, built several hundred modest, near-identical houses here — including 248 single-family homes in the Norvick sector beginning in 1942.",
        "After the war the borough boomed, becoming Quebec's second industrial city behind Montreal itself, helped by available land near Dorval and highway access. Its neighbourhoods have genuinely different origins: the historic Vieux-Saint-Laurent core, the 1940s wartime housing, and Bois-Franc, a residential development launched in 1993 on the former Cartierville Airport grounds.",
      ],
      whatThisMeansHeading: "What that means for renovation work in Saint-Laurent",
      whatThisMeans: [
        "The wartime houses were built quickly, modestly, and to a common plan. That standardization is useful for estimating in the same way Vimont's bungalows are — comparable projects price predictably. It also means the same constraints recur: small footprints, tight room dimensions, and original systems now more than eighty years old.",
        "Houses built as modest wartime dwellings are frequently the ones where owners want space opened up. That is a structural question first, so we establish what is load-bearing before anyone starts choosing finishes.",
        "Bois-Franc is a different proposition entirely. Housing from the mid-1990s onward is now reaching its first real renovation cycle — kitchens and bathrooms dated rather than failing, and systems that are aging rather than finished.",
      ],
      faq: [
        {
          question: "Can you open up the layout in a small wartime-era house?",
          answer:
            "Often, yes — it is one of the most common requests in this borough. Whether a specific wall can come out is a structural question, and we answer it before finishes are chosen rather than after.",
        },
        {
          question: "Do you work in the newer Bois-Franc area?",
          answer:
            "Yes. That housing is now old enough for a first significant renovation, which is usually kitchens, bathrooms and flooring rather than the deeper structural work the older stock needs.",
        },
      ],
    },
    fr: {
      name: "Saint-Laurent",
      tagline: "Rénovation et restauration après dégât d'eau à Saint-Laurent, Montréal",
      metaTitle: "Dégât d'eau et rénovation à Saint-Laurent, Montréal",
      metaDescription:
        "Rénovation et dégât d'eau à Saint-Laurent : maisons de guerre, cuisines, salles de bain et sous-sols — Norvick, Vieux-Saint-Laurent, Bois-Franc.",
      context: [
        "Le caractère résidentiel de Saint-Laurent a été façonné par la Seconde Guerre mondiale. Wartime Housing Limited, société créée par le gouvernement fédéral pour loger les travailleurs de l'effort de guerre, y a construit plusieurs centaines de maisons modestes et quasi identiques — dont 248 maisons unifamiliales dans le secteur Norvick à partir de 1942.",
        "Après la guerre, l'arrondissement a connu un essor considérable, devenant la deuxième ville industrielle du Québec derrière Montréal, favorisé par les terrains disponibles près de Dorval et l'accès aux autoroutes. Ses quartiers ont des origines réellement distinctes : le noyau historique du Vieux-Saint-Laurent, les maisons de guerre des années 1940, et Bois-Franc, un projet résidentiel lancé en 1993 sur les anciens terrains de l'aéroport de Cartierville.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour les travaux de rénovation à Saint-Laurent",
      whatThisMeans: [
        "Les maisons de guerre ont été bâties rapidement, modestement et sur un plan commun. Cette standardisation aide à l'estimation, comme pour les bungalows de Vimont : des projets comparables se chiffrent de façon prévisible. Elle signifie aussi que les mêmes contraintes reviennent — petites superficies, pièces exiguës et systèmes d'origine aujourd'hui vieux de plus de quatre-vingts ans.",
        "Les maisons conçues comme logements de guerre modestes sont souvent celles où les propriétaires souhaitent ouvrir l'espace. C'est d'abord une question structurale : nous déterminons ce qui est porteur avant que quiconque choisisse des finis.",
        "Bois-Franc est tout autre chose. Le parc bâti à partir du milieu des années 1990 atteint maintenant son premier véritable cycle de rénovation — des cuisines et des salles de bain démodées plutôt que défaillantes, et des systèmes qui vieillissent sans être finis.",
      ],
      faq: [
        {
          question: "Pouvez-vous ouvrir l'aménagement d'une petite maison de guerre ?",
          answer:
            "Souvent, oui — c'est l'une des demandes les plus fréquentes dans cet arrondissement. Savoir si un mur précis peut être retiré est une question structurale, et nous y répondons avant le choix des finis, pas après.",
        },
        {
          question: "Travaillez-vous dans le secteur plus récent de Bois-Franc ?",
          answer:
            "Oui. Ce parc a maintenant l'âge d'une première rénovation d'importance, généralement cuisines, salles de bain et revêtements de sol plutôt que les travaux structuraux plus profonds qu'exige le parc ancien.",
        },
      ],
    },
  },

  {
    slug: "lasalle",
    neighbors: ["saint-laurent", "ahuntsic-cartierville"],
    relatedServices: [WATER_DAMAGE, SEWER_BACKUP, RENOVATIONS, KITCHEN_BATH, DRYWALL, PAINTING],
    sources: [
      { label: "Ville de Montréal — LaSalle", url: "https://montreal.ca/lasalle" },
      { label: "LaSalle, Quebec — Wikipedia", url: "https://en.wikipedia.org/wiki/LaSalle,_Quebec" },
      {
        label: "Ville de Montréal — Clapet antiretour",
        url: "https://montreal.ca/articles/clapet-antiretour-la-cle-pour-prevenir-refoulement-degout-et-inondation-27249",
      },
    ],
    en: {
      name: "LaSalle",
      tagline: "Renovation and water damage restoration in LaSalle, Montreal",
      metaTitle: "Water Damage & Renovation in LaSalle, Montreal",
      metaDescription:
        "Renovation and water damage restoration in LaSalle: post-war bungalows, duplexes and low-rise apartments, plus riverside and condo properties.",
      context: [
        "LaSalle formed part of Lachine from 1669 until 1848 and became an independent city in 1912, named for the explorer René-Robert Cavelier de La Salle. It was merged into Montreal as a borough in 2002.",
        "The Lachine Canal, cut in the 1820s to bypass the rapids, brought industry and the workers who settled beside it — modest workers' housing, early duplexes, and stone houses along the river. After the Second World War the borough grew quickly into a family-oriented suburb of bungalows, duplexes, triplexes and low-rise apartment buildings, and since the early 2000s former industrial land has been redeveloped with new low-rise condominiums near the water.",
      ],
      whatThisMeansHeading: "What that means for renovation and water damage in LaSalle",
      whatThisMeans: [
        "Three eras sit side by side here, and the right approach differs sharply between them. Canal-era workers' housing and riverside stone, post-war suburban bungalows and triplexes, and 2000s condominium stock are effectively three different trades.",
        "The post-war suburban housing is the volume of it, and it behaves the way that stock does everywhere on the island: dated finishes over systems that have reached the end of their service life, and closed layouts owners want opened.",
        "The finished basement is what makes water damage different here. The post-war stock was built with basements finished as living space, and that is where the water ends up — through infiltration, through a pipe that lets go upstairs, or through a sewer backup. On the island a backwater valve is not optional: Ville de Montréal's municipal by-law makes them mandatory, and every building built since 2011 has to have one. The city also notes that a valve has to stay accessible and be serviced about twice a year — and that flooring laid over the access point is one of the most common reasons it isn't. That is a renovation mistake, not a plumbing one, and it is why we keep the hatch reachable when we put a basement floor back.",
        "The newer condominium stock brings syndicate work with it. Quebec's Bill 16 requires every syndicate to obtain a contingency fund study by August 2028, and buildings that have one tend to plan common-area work rather than defer it.",
      ],
      faq: [
        {
          question: "Do you work on older stone houses near the river?",
          answer:
            "Yes, and they need decisions made deliberately. What gets restored versus replaced is worth settling before demolition, because the wrong call is visible afterwards and expensive to undo.",
        },
        {
          question: "Can you work with a condo syndicate on common areas?",
          answer:
            "That is a routine part of our commercial work. We provide written scope, photo documentation before and after, and invoicing in the form a syndicate or insurer needs.",
        },
      ],
    },
    fr: {
      name: "LaSalle",
      tagline: "Rénovation et restauration après dégât d'eau à LaSalle, Montréal",
      metaTitle: "Dégât d'eau et rénovation à LaSalle, Montréal",
      metaDescription:
        "Rénovation et dégât d'eau à LaSalle : bungalows, duplex et petits immeubles d'après-guerre, propriétés riveraines et copropriétés.",
      context: [
        "LaSalle a fait partie de Lachine de 1669 à 1848 avant de devenir une ville indépendante en 1912, nommée en l'honneur de l'explorateur René-Robert Cavelier de La Salle. Le territoire a été fusionné à Montréal comme arrondissement en 2002.",
        "Le canal de Lachine, creusé dans les années 1820 pour contourner les rapides, a amené l'industrie et les travailleurs qui se sont installés à proximité — logements ouvriers modestes, premiers duplex et maisons de pierre le long du fleuve. Après la Seconde Guerre mondiale, l'arrondissement est rapidement devenu une banlieue familiale de bungalows, duplex, triplex et petits immeubles à logements; depuis le début des années 2000, d'anciens terrains industriels ont été réaménagés en copropriétés de faible hauteur près de l'eau.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour la rénovation et les dégâts d'eau à LaSalle",
      whatThisMeans: [
        "Trois époques cohabitent ici, et l'approche appropriée diffère nettement de l'une à l'autre. Les logements ouvriers de l'époque du canal et la pierre riveraine, les bungalows et triplex de banlieue d'après-guerre, et le parc de copropriétés des années 2000 constituent en pratique trois métiers différents.",
        "Le parc de banlieue d'après-guerre représente le volume, et il se comporte comme partout ailleurs sur l'île : des finis désuets par-dessus des systèmes arrivés en fin de vie utile, et des aménagements fermés que les propriétaires veulent ouvrir.",
        "Le sous-sol fini est ce qui distingue le dégât d'eau ici. Le parc d'après-guerre a été bâti avec des sous-sols aménagés en pièces habitables, et c'est là que l'eau se retrouve — par infiltration, par un tuyau qui cède à l'étage, ou par un refoulement d'égout. Sur l'île, le clapet antiretour n'est pas optionnel : le règlement municipal de la Ville de Montréal le rend obligatoire, et tout bâtiment construit depuis 2011 doit en être muni. La Ville rappelle aussi qu'un clapet doit rester accessible et être entretenu environ deux fois par année — et qu'un plancher posé par-dessus le point d'accès est l'une des causes les plus fréquentes d'inaccessibilité. C'est une erreur de rénovation, pas de plomberie, et c'est pourquoi nous gardons la trappe atteignable quand nous reposons un plancher de sous-sol.",
        "Le parc de copropriétés plus récent amène avec lui le travail avec les syndicats. La loi 16 du Québec exige que chaque syndicat obtienne une étude du fonds de prévoyance d'ici août 2028, et les immeubles qui en disposent tendent à planifier les travaux des parties communes plutôt qu'à les reporter.",
      ],
      faq: [
        {
          question: "Travaillez-vous sur les maisons de pierre anciennes près du fleuve ?",
          answer:
            "Oui, et elles exigent des décisions délibérées. Ce qu'on restaure et ce qu'on remplace mérite d'être tranché avant la démolition, car un mauvais choix se voit après coup et coûte cher à corriger.",
        },
        {
          question: "Pouvez-vous travailler avec un syndicat de copropriété sur les parties communes ?",
          answer:
            "C'est une partie courante de nos mandats commerciaux. Nous fournissons une portée de travaux écrite, une documentation photo avant et après, et une facturation dans la forme dont un syndicat ou un assureur a besoin.",
        },
      ],
    },
  },

  /**
   * Terrebonne is the first area page outside Laval and the island, and the
   * first that closes a gap rather than opening one: `areaServed` in
   * LocalBusinessSchema has claimed Terrebonne all along with no page to
   * demonstrate it.
   *
   * The angle is that this is not one housing stock but three, for an
   * administrative reason — Lachenaie, La Plaine and Terrebonne merged on
   * 22 August 2001. Competitors here rank with template city pages
   * (/zone/terrebonne, /villes/terrebonne/degat-eau); knowing the merger is
   * what a swapped template cannot express.
   *
   * NOT claimed, deliberately: the 43,149 (2001) to 106,322 (2011) population
   * figures that the source calls a 146% increase. The 2001 census predates the
   * August 2001 merger, so that is three municipalities becoming one on paper,
   * not houses being built. See content/briefs/terrebonne.md.
   */
  {
    slug: "terrebonne",
    // Across the Rivière des Mille-Îles from Laval's north shore. Both link
    // back, so the lateral path works in either direction.
    neighbors: ["sainte-rose", "duvernay"],
    // Curated for suburban stock with finished basements and a 1990s-2000s
    // first renovation cycle. Deliberately not SEWER_BACKUP: that page's local
    // content is Ville de Montréal's by-law, which does not apply here.
    relatedServices: [WATER_DAMAGE, BASEMENTS, KITCHEN_BATH, RENOVATIONS, DRYWALL, PAINTING],
    sources: [
      { label: "Ville de Terrebonne", url: "https://terrebonne.ca/" },
      { label: "Terrebonne, Quebec — Wikipedia", url: "https://en.wikipedia.org/wiki/Terrebonne,_Quebec" },
    ],
    en: {
      name: "Terrebonne",
      tagline: "Renovation and water damage restoration in Terrebonne",
      metaTitle: "Water Damage & Renovation in Terrebonne",
      metaDescription:
        "Renovation and water damage restoration in Terrebonne, Lachenaie and La Plaine: finished basements, kitchens and bathrooms, full rebuild. Answered 24/7.",
      context: [
        "Terrebonne as it exists today dates from 22 August 2001, when three municipalities merged: Lachenaie, founded in 1683, La Plaine in 1830, and Terrebonne itself, incorporated in 1860. With 119,944 residents at the 2021 census, it is Quebec's tenth largest city.",
        "The city sits on the Rivière des Mille-Îles, and its historic core is built around Île-des-Moulins, where the saw mill and flour mill were built in 1804 and 1846 and the Moulin neuf in 1850. The site has been classified a historic site of national interest by the Government of Quebec since 1973.",
      ],
      whatThisMeansHeading: "What that means for renovation and water damage in Terrebonne",
      whatThisMeans: [
        "One city, three housing stocks. The 2001 merger did not standardise the building: old Terrebonne and its surroundings keep an older fabric, while the former Lachenaie and La Plaine sectors grew as newer, more standardised family suburbs. Those are two different ways of working, and knowing which applies before pricing is what avoids the unpleasant surprises.",
        "In the suburban stock the finished basement is the norm, and that is where most water damage ends up — through a line that lets go upstairs, through infiltration, or through a backup. The EPA's 24-to-48-hour benchmark for mould on wet material runs from day one, and in a finished basement the damage is almost always hidden behind something: subfloor under the laminate, insulation behind the strapping. We open up enough to see what is actually wet rather than drying what is visible.",
        "Being close to the Rivière des Mille-Îles changes the shape of spring calls. Infiltration doesn't behave like a burst line: it arrives more slowly, from below or through the envelope, and it repeats if the cause isn't addressed. We document where the water got in, not only what it damaged — that is the difference between a repair and the same repair done again next year.",
      ],
      faq: [
        {
          question: "Do you cover Lachenaie and La Plaine?",
          answer:
            "Yes. All three sectors have been part of Terrebonne since 2001 and we work in all of them. The building stock isn't the same from one to the next, which is exactly why we ask before pricing.",
        },
        {
          question: "How quickly can you get to Terrebonne?",
          answer:
            "Our line is answered 24/7 and we plan the response from that call. We don't promise a fixed time: anyone guaranteeing a number of minutes without knowing what is happening at your address is guessing. What we can say is that drying starts before the liability question is settled, because the material isn't waiting.",
        },
      ],
    },
    fr: {
      name: "Terrebonne",
      tagline: "Rénovation et restauration après dégât d'eau à Terrebonne",
      metaTitle: "Dégât d'eau et rénovation à Terrebonne",
      metaDescription:
        "Rénovation et dégât d'eau à Terrebonne, Lachenaie et La Plaine : sous-sols finis, cuisines et salles de bain, remise en état après sinistre. Répondu 24/7.",
      context: [
        "Terrebonne telle qu'on la connaît aujourd'hui date du 22 août 2001, quand trois municipalités ont fusionné : Lachenaie, fondée en 1683, La Plaine, en 1830, et Terrebonne elle-même, constituée en 1860. Avec 119 944 habitants au recensement de 2021, c'est la dixième ville en importance au Québec.",
        "La ville borde la rivière des Mille Îles, et son noyau ancien s'organise autour de l'Île-des-Moulins, où le moulin à scie et le moulin à farine ont été construits en 1804 et 1846, et le Moulin neuf en 1850. Le site est classé lieu historique d'intérêt national par le gouvernement du Québec depuis 1973.",
      ],
      whatThisMeansHeading: "Ce que cela implique pour la rénovation et les dégâts d'eau à Terrebonne",
      whatThisMeans: [
        "Une ville, trois parcs immobiliers. La fusion de 2001 n'a pas uniformisé le bâti : le vieux Terrebonne et ses abords conservent un cadre ancien, tandis que les secteurs des anciennes Lachenaie et La Plaine se sont développés en banlieue familiale, plus récente et plus standardisée. Ce sont deux façons de travailler, et savoir laquelle s'applique avant de chiffrer évite les mauvaises surprises.",
        "Dans le parc de banlieue, le sous-sol fini est la norme et c'est là que l'essentiel des dégâts d'eau aboutit — par une conduite qui cède à l'étage, par une infiltration, ou par un refoulement. Le seuil de 24 à 48 heures de l'EPA pour la moisissure sur un matériau mouillé court dès le premier jour, et dans un sous-sol aménagé le dommage est presque toujours caché derrière quelque chose : sous-plancher sous le flottant, isolant derrière la fourrure. Nous ouvrons assez pour voir ce qui est réellement mouillé plutôt que de sécher ce qui se voit.",
        "La proximité de la rivière des Mille Îles change le profil des appels au printemps. Une infiltration ne se comporte pas comme une conduite éclatée : elle arrive plus lentement, par le bas ou par l'enveloppe, et elle se répète si la cause n'est pas traitée. Nous documentons d'où l'eau est entrée, pas seulement ce qu'elle a abîmé — c'est la différence entre une réparation et la même réparation refaite l'an prochain.",
      ],
      faq: [
        {
          question: "Couvrez-vous Lachenaie et La Plaine ?",
          answer:
            "Oui. Les trois secteurs font partie de Terrebonne depuis 2001 et nous y travaillons tous. Le bâti n'est pas le même d'un secteur à l'autre, et c'est justement pour ça qu'on le demande avant de chiffrer.",
        },
        {
          question: "En combien de temps pouvez-vous venir à Terrebonne ?",
          answer:
            "Notre ligne est répondue 24/7 et nous planifions l'intervention à partir de cet appel. Nous ne promettons pas un délai fixe : quelqu'un qui garantit un nombre de minutes sans savoir ce qui se passe chez vous devine. Ce que nous pouvons dire, c'est que l'assèchement commence avant que la question de la responsabilité soit réglée, parce que le matériau, lui, n'attend pas.",
        },
      ],
    },
  },
];

export function getServiceArea(slug: string): ServiceArea | undefined {
  return serviceAreas.find((area) => area.slug === slug);
}

/**
 * The reverse of `relatedServices`: which areas list a given service page.
 *
 * Derived from the same data rather than maintained as a second list, so the
 * two directions cannot drift apart — a service added to an area shows up
 * here automatically, and one removed disappears. A service no area lists
 * returns an empty array and the linking section simply doesn't render.
 */
export function getAreasForService(serviceHref: string): ServiceArea[] {
  return serviceAreas.filter((area) =>
    area.relatedServices.some((service) => service.href === serviceHref),
  );
}
