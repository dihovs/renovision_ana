export type BlogPostSection =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "stats"; items: { value: string; label: string }[] }
  | { type: "linkParagraph"; text: string; linkText: string; href: string }
  | { type: "timeline"; items: { time: string; text: string }[] };

export type BlogPostLocaleContent = {
  title: string;
  /**
   * Compact SERP title (the layout template appends " | Renovision AnA").
   * The full editorial title stays as the H1 and card headline; at 56-114
   * chars those were getting truncated in Google results.
   */
  metaTitle: string;
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
    slug: "frozen-pipe-water-heater-winter-leaks",
    categoryTag: { en: "Winter water damage · Emergency response", fr: "Dégâts d'eau d'hiver · Intervention d'urgence" },
    publishedAt: "2026-08-31",
    readTimeMinutes: 5,
    heroStat: {
      value: "10 °C",
      label: { en: "The minimum indoor temperature CAA-Québec recommends holding in a home left empty in winter", fr: "La température intérieure minimale que CAA-Québec recommande de maintenir dans une maison inoccupée l'hiver" },
    },
    en: {
      title: "Frozen Pipes and Leaking Water Heaters: Winter's Two Calls, and What Comes After",
      metaTitle: "Frozen Pipe or Leaking Water Heater: What to Do",
      excerpt: "The tap gives nothing, or a puddle is spreading under the tank. How to spot and thaw a frozen pipe without starting a fire — and, more importantly, what happens after it bursts.",
      metaDescription: "Frozen pipes and leaking water heaters in Quebec: the warning signs, how to thaw safely, and the first hour after a burst. Line answered 24/7.",
      sections: [
        { type: "paragraph", text: "Winter produces two calls, and they don't look alike. The first arrives fast: a tap that gives nothing, then a pipe that lets go as the ice expands. The second arrives slowly: a puddle under the water heater that has been growing for weeks before anyone notices. The end damage looks the same — wet drywall, a soaked subfloor, a finished basement to redo — but from your insurer's point of view they are opposite stories." },
        { type: "heading", text: "Spotting a frozen pipe before it bursts" },
        { type: "paragraph", text: "CAA-Québec gives three signs, and they usually show up before the rupture. The most vulnerable pipes are those in above-grade exterior walls or in unheated spaces; a crawl space is less exposed, being warmed from above." },
        { type: "list", items: ["Reduced or absent flow when you open a tap — often the very first sign, on a cold morning.", "Unusual noises in the piping.", "A section of pipe that feels abnormally cold compared with the ones beside it."] },
        { type: "heading", text: "Thawing it without setting the house on fire" },
        { type: "paragraph", text: "Open the tap first: running water tells you it's working, and lets pressure escape rather than build behind the ice plug. Then warm the line gently with a hair dryer, moving it slowly toward the frozen section so the heat spreads. A heating blanket, a small radiator or a heat lamp will also do it. Be patient — it takes time, and that's normal. What you must never use is a blowtorch or propane torch. CAA-Québec is categorical: the flame damages plastic pipe and soldered joints, and it can start a fire. A frozen pipe is one expensive problem; a house fire is another." },
        { type: "heading", text: "If it has already burst: the first hour" },
        {
          type: "timeline",
          items: [
            { time: "Immediately", text: "Close the main water supply. The CMMTQ puts this first for a reason: while the line is still feeding, everything else is just managing damage in progress." },
            { time: "2 minutes", text: "Cut power to the affected area at the panel, not at the wall switch. Water crossing a ceiling finds the electrical boxes before it finds the floor." },
            { time: "5 minutes", text: "Photograph before moving anything. That record only exists once, and it's the one your insurer works from." },
            { time: "15 minutes", text: "Call a licensed plumber for the line. Repairing the pipe is their trade, not ours." },
            { time: "Then", text: "Call us for the water. Our line is answered 24/7, and the EPA's 24-to-48-hour mould window starts when the pipe let go, not when the plumber leaves." },
          ],
        },
        { type: "heading", text: "The water heater, winter's other call" },
        { type: "paragraph", text: "A water heater rarely announces its end. It weeps first — a rust trace on the base, a ring on the slab, a damp smell in a finished basement — and those weeks matter, because Quebec home insurance policies generally distinguish a sudden, accidental event, which is covered, from a slow leak or a problem the owner knew about and didn't act on, which is often excluded. A pipe bursting on the night of 12 January is a date. A tank that has been seeping since November is a history. If you can see a trace under yours, photograph it today and have it looked at: that is the only window where the information still works in your favour." },
        {
          type: "stats",
          items: [
            { value: "10 °C", label: "Minimum indoor temperature recommended for an unoccupied home (CAA-Québec)" },
            { value: "24–48 h", label: "The EPA's window before wet material is very likely to grow mould" },
            { value: "No flame", label: "Blowtorch and propane torch: never, on any pipe" },
          ],
        },
        {
          type: "linkParagraph",
          text: "Once the water is off, what decides the rest isn't the size of the damage but the quality of the file: dated moisture readings, photographs, and a written scope the adjuster can process without a follow-up call.",
          linkText: "What actually moves an insurance claim, seen from the job site",
          href: "/blog/insurance-claim-water-damage-quebec",
        },
        { type: "paragraph", text: "The plumber fixes the line and leaves, and that is where our part starts: the water that went into the walls, the ceiling below, and the finished basement. We dry to moisture readings rather than to a date, document what got wet, and put back the drywall, insulation, flooring and paint. Our line is answered 24/7 — and in January that is rarely a figure of speech." },
      ],
    },
    fr: {
      title: "Tuyau gelé, chauffe-eau qui coule : les deux appels d'hiver, et ce qui vient après",
      metaTitle: "Tuyau gelé ou chauffe-eau qui coule : quoi faire",
      excerpt: "Le robinet ne donne rien, ou une flaque s'élargit sous le réservoir. Comment reconnaître et dégeler un tuyau sans mettre le feu — et surtout, ce qui se passe après qu'il a éclaté.",
      metaDescription: "Tuyau gelé ou chauffe-eau qui fuit au Québec : les signes, comment dégeler sans danger, et la première heure après un éclatement. Ligne répondue 24/7.",
      sections: [
        { type: "paragraph", text: "L'hiver produit deux appels chez nous, et ils ne se ressemblent pas. Le premier arrive vite : un robinet qui ne donne rien, puis un tuyau qui cède quand la glace se dilate. Le second arrive lentement : une flaque sous le chauffe-eau qui grandit depuis des semaines avant que quelqu'un la remarque. Le dégât final se ressemble — du gypse mouillé, un sous-plancher imbibé, un sous-sol fini à refaire — mais du point de vue de votre assurance, ce sont deux histoires opposées." },
        { type: "heading", text: "Reconnaître un tuyau gelé avant qu'il éclate" },
        { type: "paragraph", text: "CAA-Québec donne trois indices, et ils apparaissent souvent avant la rupture. Les tuyaux les plus vulnérables sont ceux situés dans des murs extérieurs hors-sol ou dans un espace non chauffé; un vide sanitaire l'est moins, parce qu'il est réchauffé par le dessus." },
        { type: "list", items: ["Un débit d'eau réduit ou absent quand vous ouvrez un robinet — souvent le tout premier signe, un matin.", "Des bruits inhabituels dans la tuyauterie.", "Une section de tuyau anormalement froide par rapport aux conduites voisines."] },
        { type: "heading", text: "Le dégeler sans mettre le feu à la maison" },
        { type: "paragraph", text: "Ouvrez le robinet en premier : l'eau qui recommence à couler vous dira que ça fonctionne, et laisse la pression s'échapper au lieu de s'accumuler derrière le bouchon de glace. Puis réchauffez doucement la conduite avec un séchoir à cheveux, en déplaçant lentement l'appareil vers la zone gelée pour répartir la chaleur. Une couverture chauffante, un petit radiateur ou une lampe chauffante font aussi le travail. Soyez patient : ça prend du temps, et c'est normal. Ce qu'il ne faut jamais utiliser, c'est une lampe à souder ou un chalumeau au propane — CAA-Québec est catégorique là-dessus, parce que la flamme endommage les tuyaux de plastique et les joints soudés, et peut provoquer un incendie. Un tuyau gelé est un problème coûteux; une maison en feu en est un autre." },
        { type: "heading", text: "S'il a déjà éclaté : la première heure" },
        {
          type: "timeline",
          items: [
            { time: "Tout de suite", text: "Fermez l'entrée d'eau principale. La CMMTQ le place en premier pour une raison : tant que la conduite alimente, tout le reste ne fait que gérer les dégâts en cours." },
            { time: "2 minutes", text: "Coupez le courant de la zone touchée au panneau, pas à l'interrupteur du mur. De l'eau qui traverse un plafond trouve les boîtes électriques avant de trouver le plancher." },
            { time: "5 minutes", text: "Photographiez avant de déplacer quoi que ce soit. Ce dossier n'existe qu'une fois, et c'est celui que votre assureur regardera." },
            { time: "15 minutes", text: "Appelez un plombier licencié pour la conduite. La réparation du tuyau est son métier, pas le nôtre." },
            { time: "Ensuite", text: "Appelez-nous pour l'eau. Notre ligne est répondue 24/7, et le seuil de 24 à 48 heures de l'EPA pour la moisissure commence à courir au moment où le tuyau a cédé, pas au moment où le plombier repart." },
          ],
        },
        { type: "heading", text: "Le chauffe-eau, l'autre appel d'hiver" },
        { type: "paragraph", text: "Un chauffe-eau annonce rarement sa fin. Il suinte d'abord — une trace de rouille sur la base, un cerne sur la dalle, une odeur d'humidité dans un sous-sol fini — et ces semaines-là comptent, parce que les polices d'assurance habitation au Québec distinguent généralement un événement soudain et accidentel, couvert, d'une fuite lente ou d'un problème que le propriétaire connaissait sans agir, souvent exclu. Un tuyau qui éclate la nuit du 12 janvier est une date. Un réservoir qui coule depuis novembre est un historique. Si vous voyez une trace sous le vôtre, photographiez-la aujourd'hui et faites-la voir : c'est la seule fenêtre où l'information joue encore en votre faveur." },
        {
          type: "stats",
          items: [
            { value: "10 °C", label: "Température intérieure minimale recommandée dans une maison inoccupée (CAA-Québec)" },
            { value: "24–48 h", label: "Fenêtre de l'EPA avant qu'un matériau mouillé développe très probablement de la moisissure" },
            { value: "0 flamme", label: "Lampe à souder et chalumeau : jamais, sur aucun tuyau" },
          ],
        },
        {
          type: "linkParagraph",
          text: "Une fois l'eau arrêtée, ce qui décide de la suite n'est pas la taille du dégât mais la qualité du dossier : relevés d'humidité datés, photos, et une portée de travaux écrite que l'expert peut traiter sans rappel.",
          linkText: "Ce qui fait vraiment avancer une réclamation, vu du chantier",
          href: "/blog/insurance-claim-water-damage-quebec",
        },
        { type: "paragraph", text: "Le plombier répare la conduite et s'en va, et c'est là que commence notre partie : l'eau qui est entrée dans les murs, le plafond en dessous et le sous-sol fini. Nous asséchons jusqu'aux relevés d'humidité plutôt que jusqu'à une date, nous documentons ce qui a été mouillé, et nous remettons en état le gypse, l'isolant, le plancher et la peinture. Notre ligne est répondue 24/7 — et en janvier, c'est rarement une figure de style." },
      ],
    },
  },
  {
    slug: "insurance-claim-water-damage-quebec",
    categoryTag: { en: "Water damage · Insurance claims", fr: "Dégât d'eau · Réclamation d'assurance" },
    publishedAt: "2026-08-30",
    readTimeMinutes: 5,
    heroStat: {
      value: "Art. 10",
      label: { en: "The code of ethics article requiring a claims adjuster to act with integrity, promptly, honestly and fairly — ChAD", fr: "L'article du code de déontologie qui oblige l'expert en sinistre à agir avec intégrité, avec diligence, honnêteté et équité — ChAD" },
    },
    en: {
      title: "A Water Damage Claim: What Actually Moves the File, Seen From the Job Site",
      metaTitle: "Water Damage Claims in Quebec: The File",
      excerpt: "Between the loss and the first visit there's a gap where a lot of people wait without knowing whether they should. Here's what's happening inside the file, and what you can do meanwhile.",
      metaDescription: "What a claims adjuster must do under ChAD guidance, why waiting isn't an instruction, and the documents that actually move a water damage claim.",
      sections: [
        { type: "paragraph", text: "The hard part of a water damage claim is almost never the form. It's the gap between the water arriving and someone showing up: a few hours, sometimes a few days, during which you've been told not to touch anything while the material goes on absorbing. We spend our working lives inside that gap. Here's what actually happens in it." },
        { type: "heading", text: "What the claims adjuster has to do" },
        { type: "paragraph", text: "A claims adjuster isn't an administrative middleman. The Chambre de l'assurance de dommages, which regulates the profession in Quebec, describes the role in three verbs: investigate, estimate, negotiate. It asks the adjuster to consult the loss notice without delay, make early contact with the insured to explain the process and guide them on limiting damage, and record interventions meticulously in the file. Article 10 of the code of ethics requires acting with integrity, promptly, honestly and fairly." },
        { type: "heading", text: "Waiting is not an instruction" },
        { type: "paragraph", text: "This is the part insurers don't put on their own sites, and it changes how the first days feel. Per ChAD, coordinating urgent work falls to the adjuster — and failing to put measures in place in time, such as opening walls and ceilings or establishing ventilation, breaches professional obligations and can let mould proliferate, driving the cost up. Put plainly: delay is not a normal step in the process. The body that regulates the profession treats it as a problem." },
        { type: "paragraph", text: "The other half of the equation is yours: the insured must limit the damage and preserve the evidence. Drying early is therefore not 'starting work without authorisation'. It is precisely what the contract expects of you. The distinction worth keeping clear is this one: drying and containment are mitigation; rebuilding waits for agreement on the scope." },
        { type: "heading", text: "The documents that move a file" },
        { type: "paragraph", text: "ChAD asks the adjuster to gather photos, videos and supplier reports. We are those suppliers. After several hundred files, four documents come back as the ones that genuinely move a claim, because each one closes a question the adjuster would otherwise have had to ask." },
        { type: "list", items: ["Dated photographs taken before anything moves, including of what looks untouched. The initial state cannot be reconstructed afterwards.", "A dated moisture reading, repeated until drying ends. It's what separates 'it's dry' from 'it looks dry', and it's the only thing that objectively justifies how long drying took.", "A written scope that separates structure from your improvements. That separation is what the adjuster has to rule on; handing it over already done saves a round trip.", "The cause, where it's known, described factually and without a conclusion. 'Supply line fitting under the sink, failed' beats 'the plumber did a bad job'."] },
        {
          type: "linkParagraph",
          text: "Winter produces the two losses where that distinction bites hardest: a pipe that bursts on a date, and a water heater that has been seeping for weeks. One is sudden and accidental; the other has a history.",
          linkText: "Frozen pipes and leaking water heaters, and what comes after",
          href: "/blog/frozen-pipe-water-heater-winter-leaks",
        },
        { type: "heading", text: "What puts a file on hold" },
        { type: "list", items: ["Photographs taken after the cleanup. Understandable, and unrecoverable.", "A single moisture reading, taken on the last day. It proves it's dry today, not that the drying was necessary yesterday.", "A lump-sum quote with no detail, mixing structure and improvements. The adjuster can't approve it as it stands, and the file comes back.", "Different versions of the same thing: one date on the phone, another in the email, a third in the quote. Every discrepancy becomes a follow-up request."] },
        {
          type: "timeline",
          items: [
            { time: "Hour 0", text: "Shut off the water and the power to the affected area. Photograph before moving anything." },
            { time: "Hours 0-24", text: "Report the loss. Start containment and drying — that's mitigation, not work." },
            { time: "24-48 h", text: "The EPA window for mould on wet material. Whatever is still saturated after it costs more to deal with." },
            { time: "First few days", text: "The adjuster makes contact, explains the process, and coordinates urgent measures." },
            { time: "During drying", text: "Moisture readings logged until target values are reached, not until a date arrives." },
            { time: "Only then", text: "Written scope, agreement, and rebuilding." },
          ],
        },
        {
          type: "linkParagraph",
          text: "All of the above describes the file. The work itself stays the same: extract, dry to the readings, then restore — with the documentation produced as we go rather than reconstructed at the end.",
          linkText: "Our water damage restoration service",
          href: "/services/water-damage",
        },
        { type: "paragraph", text: "One limit worth naming: nothing here tells you what your policy covers, or what your insurer will decide. Those answers live in your contract and with your insurer, and nowhere else. What we can do is narrower and sometimes more useful: dry quickly, document cleanly, and hand your adjuster a file they can process without calling you back." },
      ],
    },
    fr: {
      title: "Réclamation pour dégât d'eau : ce qui fait avancer un dossier, vu du chantier",
      metaTitle: "Réclamation dégât d'eau au Québec : le dossier",
      excerpt: "Entre le sinistre et la première visite, il y a un vide où beaucoup de gens attendent sans savoir s'ils devraient. Voici ce qui se passe dans un dossier, et ce que vous pouvez faire pendant ce temps.",
      metaDescription: "Ce que l'expert en sinistre doit faire selon la ChAD, pourquoi attendre n'est pas une consigne, et les documents qui font vraiment avancer une réclamation.",
      sections: [
        { type: "paragraph", text: "Le plus difficile dans une réclamation pour dégât d'eau n'est presque jamais le formulaire. C'est le vide entre le moment où l'eau arrive et celui où quelqu'un se présente : quelques heures, parfois quelques jours, pendant lesquels on vous a dit de ne rien toucher et où le matériau, lui, continue de s'imbiber. Nous passons nos journées dans ce vide-là. Voici ce qui s'y passe réellement." },
        { type: "heading", text: "Ce que l'expert en sinistre doit faire" },
        { type: "paragraph", text: "L'expert en sinistre n'est pas un intermédiaire administratif. La Chambre de l'assurance de dommages, qui encadre la profession, décrit son rôle en trois verbes : enquêter, estimer, négocier. Elle lui demande de consulter sans délai la déclaration de sinistre, d'entrer en contact tôt avec l'assuré pour lui expliquer le processus et le guider sur la limitation des dommages, et de consigner méticuleusement ses interventions au dossier. L'article 10 du code de déontologie lui impose d'agir avec intégrité, avec diligence, honnêteté et équité." },
        { type: "heading", text: "Attendre n'est pas une consigne" },
        { type: "paragraph", text: "C'est le point que les assureurs ne mettent pas sur leur site, et il change la façon dont on vit les premiers jours. Selon la ChAD, c'est à l'expert en sinistre que revient la coordination des travaux urgents — et l'absence de mesures en temps utile, comme l'ouverture des murs et des plafonds ou la mise en place d'une ventilation, contrevient à ses obligations professionnelles et peut laisser la moisissure proliférer, ce qui fait grimper la facture. Autrement dit : le délai n'est pas une étape normale du processus. Il est traité comme un problème par l'organisme qui encadre la profession." },
        { type: "paragraph", text: "L'autre moitié de l'équation vous revient : l'assuré doit limiter les dommages et préserver la preuve. Assécher tôt n'est donc pas « commencer les travaux sans autorisation ». C'est précisément ce que le contrat attend de vous. La distinction à garder claire est celle-ci : l'assèchement et le confinement sont de la mitigation; la reconstruction, elle, attend l'entente sur la portée des travaux." },
        { type: "heading", text: "Les documents qui font avancer un dossier" },
        { type: "paragraph", text: "La ChAD demande à l'expert de réunir photos, vidéos et rapports de fournisseurs. C'est nous, ces fournisseurs. Après plusieurs centaines de dossiers, quatre documents reviennent comme ceux qui déplacent réellement une réclamation, parce que chacun ferme une question que l'expert aurait autrement dû poser." },
        { type: "list", items: ["Des photos datées prises avant que quoi que ce soit ne bouge, y compris de ce qui semble intact. L'état initial ne se reconstitue pas après coup.", "Un relevé d'humidité daté, répété jusqu'à la fin du séchage. C'est ce qui distingue « c'est sec » de « ça en a l'air », et c'est le seul élément qui justifie objectivement la durée de l'assèchement.", "Une portée de travaux écrite qui sépare la structure de vos améliorations. Cette séparation est celle sur laquelle l'expert doit trancher; la lui fournir déjà faite épargne un aller-retour.", "La cause, quand elle est connue, décrite factuellement et sans conclusion. « Raccord de la conduite d'alimentation sous l'évier, rupture » vaut mieux que « le plombier a mal fait son travail »."] },
        {
          type: "linkParagraph",
          text: "L'hiver produit les deux sinistres où cette distinction pèse le plus : un tuyau qui éclate à une date précise, et un chauffe-eau qui suinte depuis des semaines. L'un est soudain et accidentel; l'autre a un historique.",
          linkText: "Tuyau gelé, chauffe-eau qui coule, et ce qui vient après",
          href: "/blog/frozen-pipe-water-heater-winter-leaks",
        },
        { type: "heading", text: "Ce qui met un dossier en attente" },
        { type: "list", items: ["Des photos prises après le nettoyage. Compréhensible, et irrécupérable.", "Un seul relevé d'humidité, pris le dernier jour. Il prouve que c'est sec aujourd'hui, pas que le séchage était nécessaire hier.", "Une soumission globale sans détail, qui mélange la structure et les améliorations. L'expert ne peut pas l'approuver telle quelle, et le dossier revient.", "Des versions différentes de la même chose : une date au téléphone, une autre dans le courriel, une troisième dans la soumission. Chaque écart devient une demande de suivi."] },
        {
          type: "timeline",
          items: [
            { time: "Heure 0", text: "Couper l'eau et le courant de la zone touchée. Photographier avant de déplacer quoi que ce soit." },
            { time: "Heures 0-24", text: "Déclarer le sinistre. Commencer le confinement et l'assèchement : c'est de la mitigation, pas des travaux." },
            { time: "24-48 h", text: "La fenêtre de l'EPA pour la moisissure sur un matériau mouillé. Ce qui est encore imbibé après ce délai coûte davantage à traiter." },
            { time: "Premiers jours", text: "Contact de l'expert en sinistre, qui explique le processus et coordonne les mesures urgentes." },
            { time: "Pendant le séchage", text: "Relevés d'humidité consignés jusqu'à l'atteinte des valeurs cibles, pas jusqu'à une date." },
            { time: "Puis seulement", text: "Portée de travaux écrite, entente, et reconstruction." },
          ],
        },
        {
          type: "linkParagraph",
          text: "Tout ce qui précède décrit le dossier. Le travail, lui, reste le même : extraire, assécher jusqu'aux relevés, puis remettre en état — avec la documentation produite au fur et à mesure plutôt que reconstituée à la fin.",
          linkText: "Notre service de restauration après dégât d'eau",
          href: "/services/water-damage",
        },
        { type: "paragraph", text: "Une limite qu'il faut nommer : rien ici ne vous dit ce que votre police couvre, ni ce que votre assureur décidera. Ces réponses se trouvent dans votre contrat et chez votre assureur, et nulle part ailleurs. Ce que nous pouvons faire est plus étroit et parfois plus utile : assécher rapidement, documenter proprement, et remettre à votre expert en sinistre un dossier qu'il peut traiter sans vous rappeler." },
      ],
    },
  },

  {
    slug: "condo-water-damage-who-pays",
    categoryTag: { en: "Co-ownership · Water damage liability", fr: "Copropriété · Responsabilité en cas de dégât d'eau" },
    publishedAt: "2026-08-30",
    readTimeMinutes: 5,
    heroStat: {
      value: "500 000 $",
      label: { en: "What the deductible on a syndicate's policy can reach in some downtown Montreal towers — Radio-Canada", fr: "Ce que peut atteindre la franchise de la police du syndicat dans certaines tours du centre-ville de Montréal — Radio-Canada" },
    },
    en: {
      title: "Water Damage in a Condo: Who Actually Pays, and Why the Repair Stalls",
      metaTitle: "Condo Water Damage: Who Pays in Quebec",
      excerpt: "Everyone knows where the water came from, and that settles far less than you'd think. What the Civil Code actually says, and why the work sits still between two insurers.",
      metaDescription: "Water damage in a Quebec co-ownership: what articles 1074.1 and 1074.2 say, why liability isn't presumed, and who carries the deductible.",
      sections: [
        { type: "paragraph", text: "The water came from the unit above. Everyone knows it, the neighbour admits it, and the question looks settled: they pay. That's the assumption almost every condo client calls us with, and it is wrong more often than it is right — not because anyone is cheating, but because Quebec co-ownership law does not work that way." },
        { type: "heading", text: "What almost everyone assumes" },
        { type: "paragraph", text: "The assumption is simple: the damage has an origin, the origin has an owner, so that owner repairs it. That is how intuition works, and how most conversations between neighbours go in the days after a loss. The problem is that co-ownership is precisely the regime where that intuition has been replaced with something else." },
        { type: "heading", text: "What the Civil Code says" },
        { type: "paragraph", text: "Articles 1074.1 and 1074.2 of the Civil Code of Québec collectivise the cost of a loss. In practice the costs are borne by the co-owners as a group — through common charges or the self-insurance fund — rather than by the person the water started with. As the firm Dunton Rainville puts it, it is the co-owners, through their contribution to common charges, who pay the deductibles and the repairs." },
        { type: "list", items: ["The syndicate's policy covers the building and the common portions. It answers for the structure, and it is its deductible that is in play in most serious water losses.", "Your own policy covers your belongings and your improvements — what you have added to the unit since it was built, which often includes the flooring, the cabinets and the bathroom you redid.", "Common charges and the self-insurance fund absorb the rest, including the syndicate's deductible. Which is to say: you, and all your neighbours, including the ones nothing happened to."] },
        { type: "heading", text: "Liability is not presumed" },
        { type: "paragraph", text: "This is the point almost nobody knows, and it is the one that changes the conversation with the neighbour. Per Dunton Rainville, a co-owner's liability is not presumed even when the origin of the loss is known. To claim the deductible from a co-owner, the syndicate has to demonstrate fault — not merely an origin — and recent case law declines to fill gaps in the evidence by deduction. Knowing where the water came from is a starting point, not a conclusion. Charging a co-owner remains the exception, reserved for where their fault is established." },
        { type: "heading", text: "The deductible is the real issue" },
        { type: "paragraph", text: "Since the reform, syndicates have had to maintain a self-insurance fund intended in part to absorb the deductible on their own policy. The reason is arithmetic: those deductibles have climbed. Radio-Canada reports they now reach tens of thousands of dollars, and up to half a million in some downtown Montreal towers. It is that figure, not the question of who left the bath running, that determines how quickly your unit gets repaired." },
        {
          type: "stats",
          items: [
            { value: "1074.1", label: "The Civil Code article that collectivises the cost of a loss among co-owners" },
            { value: "$500,000", label: "Deductible reached by some syndicate policies in downtown Montreal — Radio-Canada" },
            { value: "2 policies", label: "The syndicate's for the building, yours for your improvements and belongings" },
          ],
        },
        { type: "heading", text: "Why the repair isn't moving" },
        { type: "paragraph", text: "Here is the part insurers and lawyers don't write, because they aren't in the unit afterwards. A water loss in a co-ownership opens two files in parallel: the syndicate's for the structure and common portions, and yours for what belongs to you. Two adjusters, two timelines, and a grey zone in the middle — the drywall, the insulation, the flooring — that each side sometimes treats as the other's. Meanwhile the material stays wet, and the EPA's 24-to-48-hour mould benchmark keeps running, indifferent to the discussion." },
        { type: "list", items: ["Dry it before settling liability. Drying is mitigation, it documents itself, and no insurer faults a policyholder for limiting the damage while the file was opening.", "One dated set of moisture readings and photographs, from day one to the end. Two files can rest on the same documentation; neither can rest on recollection.", "A written scope that clearly separates what belongs to the structure from what belongs to your improvements. That separation, not the argument about fault, is usually what unblocks both files.", "Ask the syndicate what the deductible on its policy is. That number often decides whether a claim is made at all or absorbed — and you're entitled to know it before agreeing anything with anyone."] },
        {
          type: "linkParagraph",
          text: "A building that knows the state of its finances makes these decisions faster. Since Bill 16, every syndicate must obtain a contingency fund study by August 2028, and the ones that already have it know what they can absorb without a special assessment.",
          linkText: "What Bill 16 requires of syndicates, and by when",
          href: "/blog/quebec-bill-16-condo-contingency-fund-study",
        },
        { type: "linkParagraph", text: "If you sit on the board rather than merely attending, the next question is practical: who does the work, in an occupied building, and how it gets invoiced.", linkText: "What a syndicate should expect from a contractor", href: "/syndicats" },
        { type: "paragraph", text: "One qualification that matters: none of the above tells you what your policy covers. The split depends on your declaration of co-ownership and the policies in force, and those documents differ from one building to the next. Read your declaration and call your insurer before agreeing anything with your neighbour. What we do is narrower: we dry, we document what got wet with readings and photographs, and we put the unit back in a form both adjusters can process. We don't decide what's covered — but we can keep the question from delaying the drying." },
      ],
    },
    fr: {
      title: "Dégât d'eau en condo : qui paie vraiment, et pourquoi la réparation n'avance pas",
      metaTitle: "Dégât d'eau en condo : qui paie au Québec",
      excerpt: "Tout le monde sait d'où vient l'eau, et ça règle beaucoup moins de choses qu'on le croit. Ce que dit réellement le Code civil, et pourquoi les travaux restent bloqués entre deux assureurs.",
      metaDescription: "Dégât d'eau en copropriété au Québec : ce que disent les articles 1074.1 et 1074.2, pourquoi la responsabilité ne se présume pas, et qui assume la franchise.",
      sections: [
        { type: "paragraph", text: "L'eau vient du logement au-dessus. Tout le monde le sait, le voisin l'admet, et la question semble réglée : c'est lui qui paie. C'est l'hypothèse avec laquelle presque tous nos clients en copropriété nous appellent, et elle est fausse plus souvent qu'elle n'est vraie. Non pas parce que quelqu'un triche, mais parce que le droit québécois de la copropriété ne fonctionne pas de cette façon." },
        { type: "heading", text: "Ce que presque tout le monde suppose" },
        { type: "paragraph", text: "L'hypothèse est simple : le dégât a une origine, l'origine a un propriétaire, donc ce propriétaire répare. C'est ainsi que fonctionne l'intuition, et c'est ainsi que fonctionnent la plupart des conversations entre voisins dans les jours qui suivent un sinistre. Le problème est que la copropriété est précisément le régime où cette intuition a été remplacée par autre chose." },
        { type: "heading", text: "Ce que dit le Code civil" },
        { type: "paragraph", text: "Les articles 1074.1 et 1074.2 du Code civil du Québec collectivisent le coût des sinistres. Concrètement, les frais sont assumés par l'ensemble des copropriétaires — par les charges communes ou par le fonds d'autoassurance — plutôt que par la personne chez qui l'eau a commencé. Comme le résume le cabinet Dunton Rainville, « ce sont les copropriétaires, par leur contribution aux charges communes, qui payent les franchises et les réparations »." },
        { type: "list", items: ["La police du syndicat couvre l'immeuble et les parties communes. C'est elle qui répond de la structure, et c'est sa franchise qui est en jeu dans la plupart des dégâts d'eau sérieux.", "Votre police personnelle couvre vos biens et vos améliorations — ce que vous avez ajouté à l'unité depuis sa construction, ce qui inclut souvent les planchers, les armoires et la salle de bain que vous avez refaits.", "Les charges communes et le fonds d'autoassurance absorbent le reste, dont la franchise du syndicat. C'est-à-dire : vous, et tous vos voisins, y compris ceux qui n'ont rien eu."] },
        { type: "heading", text: "La responsabilité ne se présume pas" },
        { type: "paragraph", text: "C'est le point que presque personne ne connaît, et c'est celui qui change la conversation avec le voisin. Selon Dunton Rainville, « la responsabilité d'un copropriétaire ne se présume pas, même lorsque l'origine du sinistre est connue ». Pour réclamer la franchise à un copropriétaire, le syndicat doit démontrer une faute — pas seulement une origine — et la jurisprudence récente refuse de combler les trous de preuve par déduction. Savoir d'où vient l'eau est un point de départ, pas une conclusion. Imputer les charges à un copropriétaire demeure l'exception, réservée au cas où sa faute est établie." },
        { type: "heading", text: "La franchise est le vrai enjeu" },
        { type: "paragraph", text: "Depuis la réforme, les syndicats doivent maintenir un fonds d'autoassurance destiné notamment à absorber la franchise de leur propre police. La raison est arithmétique : ces franchises ont grimpé. Radio-Canada rapporte qu'elles atteignent désormais plusieurs dizaines de milliers de dollars, et jusqu'à un demi-million dans certaines tours du centre-ville de Montréal. C'est ce chiffre, et non la question de savoir qui a laissé couler le bain, qui détermine la vitesse à laquelle votre unité sera réparée." },
        {
          type: "stats",
          items: [
            { value: "1074.1", label: "L'article du Code civil qui collectivise le coût d'un sinistre entre les copropriétaires" },
            { value: "500 000 $", label: "Franchise atteinte par certaines polices de syndicat au centre-ville de Montréal (Radio-Canada)" },
            { value: "2 polices", label: "Celle du syndicat pour l'immeuble, la vôtre pour vos améliorations et vos biens" },
          ],
        },
        { type: "heading", text: "Pourquoi la réparation n'avance pas" },
        { type: "paragraph", text: "Voici la partie que les assureurs et les avocats n'écrivent pas, parce qu'ils ne sont pas dans le logement après coup. Un dégât d'eau en copropriété ouvre deux dossiers en parallèle : celui du syndicat pour la structure et les parties communes, et le vôtre pour ce qui vous appartient. Deux experts en sinistre, deux échéanciers, et une zone grise au milieu — le gypse, l'isolant, le plancher — que chacun considère parfois comme relevant de l'autre. Pendant ce temps, le matériau reste mouillé, et le seuil de 24 à 48 heures de l'EPA pour la moisissure continue de courir, indifférent aux discussions." },
        { type: "list", items: ["Faites assécher avant de trancher la responsabilité. L'assèchement est de la mitigation, il se documente, et aucun assureur ne reproche à un assuré d'avoir limité les dégâts pendant que le dossier s'ouvrait.", "Un seul jeu de relevés d'humidité et de photos, daté, du premier jour à la fin. Deux dossiers peuvent s'appuyer sur la même documentation; aucun ne peut s'appuyer sur des souvenirs.", "Une portée de travaux écrite qui sépare clairement ce qui relève de la structure et ce qui relève de vos améliorations. C'est cette séparation, pas le débat sur la faute, qui débloque habituellement les deux dossiers.", "Demandez au syndicat quelle est la franchise de sa police. Ce chiffre décide souvent si la réclamation est faite ou absorbée — et vous avez le droit de le savoir avant de vous entendre avec qui que ce soit."] },
        {
          type: "linkParagraph",
          text: "Un immeuble qui connaît l'état de ses finances prend ces décisions plus vite. Depuis la loi 16, chaque syndicat doit obtenir une étude du fonds de prévoyance d'ici août 2028, et ceux qui l'ont déjà faite savent ce qu'ils peuvent absorber sans cotisation spéciale.",
          linkText: "Ce que la loi 16 exige des syndicats, et d'ici quand",
          href: "/blog/quebec-bill-16-condo-contingency-fund-study",
        },
        { type: "linkParagraph", text: "Si vous siégez au conseil plutôt que d'y assister, la question suivante est pratique : qui fait les travaux, dans un immeuble occupé, et comment ça se facture.", linkText: "Ce qu'un syndicat devrait attendre d'un entrepreneur", href: "/syndicats" },
        { type: "paragraph", text: "Une précision qui compte : rien de ce qui précède ne vous dit ce que votre police couvre. Le partage dépend de votre déclaration de copropriété et des polices en vigueur, et ces documents diffèrent d'un immeuble à l'autre. Lisez votre déclaration et appelez votre assureur avant de convenir de quoi que ce soit avec le voisin. Ce que nous faisons est plus étroit : nous asséchons, nous documentons ce qui a été mouillé avec relevés et photos, et nous remettons l'unité en état sous une forme que les deux experts peuvent traiter. Nous ne décidons pas de ce qui est couvert — mais nous pouvons faire en sorte que la question ne retarde pas le séchage." },
      ],
    },
  },
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
      metaTitle: "Bathroom Renovation ROI in Laval & Montreal",
      excerpt:
        "A well-planned bathroom renovation is one of the highest-return projects you can do to a home — here's what the latest Canadian data says, and what it actually means in dollars for Laval and Montreal.",
      metaDescription:
        "Recent Royal LePage and RE/MAX data on bathroom renovation ROI — and what a 16% value increase means in dollars for Laval and Montreal homes.",
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
        {
          type: "linkParagraph",
          text: "Layout changes, plumbing moves, and tile choices swing that number more than anything else — our kitchen and bathroom page covers what a remodel includes and how we scope one.",
          linkText: "See our kitchen & bathroom renovations →",
          href: "/services/kitchen-bath",
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
          type: "linkParagraph",
          text: "Whether you're renovating to enjoy the space yourselves or preparing to sell in the next few years, a bathroom renovation remains one of the most reliable ways to put money back into your home. Renovision AnA plans and builds kitchen and bathroom remodels across Laval and Montreal, from a quick refresh to a full gut renovation.",
          linkText: "Get a line-by-line estimate in minutes →",
          href: "/estimation",
        },
      ],
    },
    fr: {
      title:
        "Rénovation de salle de bain et valeur immobilière : ce que les propriétaires de Laval et Montréal devraient savoir",
      metaTitle: "Salle de bain : quelle valeur ajoutée à Laval?",
      excerpt:
        "Une rénovation de salle de bain bien planifiée est l'un des projets les plus rentables pour une maison — voici ce que disent les données canadiennes récentes, et ce que cela représente concrètement en dollars pour Laval et Montréal.",
      metaDescription:
        "Les données de Royal LePage et RE/MAX sur le rendement d'une rénovation de salle de bain — et ce qu'une hausse de valeur de 16 % représente à Laval et Montréal.",
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
        {
          type: "linkParagraph",
          text: "Les changements de configuration, les déplacements de plomberie et le choix de céramique font varier ce montant plus que tout le reste — notre page cuisine et salle de bain décrit ce qu'une rénovation comprend et comment nous l'évaluons.",
          linkText: "Voir nos rénovations de cuisine et salle de bain →",
          href: "/services/kitchen-bath",
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
          type: "linkParagraph",
          text: "Que vous rénoviez pour profiter vous-même de l'espace ou que vous vous prépariez à vendre dans les prochaines années, la rénovation de salle de bain demeure l'un des moyens les plus fiables de réinvestir dans votre maison. Renovision AnA planifie et réalise des rénovations de cuisine et de salle de bain à Laval et à Montréal, d'un simple rafraîchissement à une rénovation complète.",
          linkText: "Obtenez une estimation détaillée en quelques minutes →",
          href: "/estimation",
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
    heroImage: "/images/blog/condo-contingency-fund-header.jpg",
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
      metaTitle: "Bill 16: Condo Contingency Fund Studies",
      excerpt:
        "Every condo syndicate in Quebec now has a legal deadline to get a contingency fund study — and the data shows most aren't financially ready for what it will find. Here's what Bill 16 requires, and what happens once your building has a repair timeline.",
      metaDescription:
        "Bill 16 requires every Quebec condo syndicate to get a contingency fund study by August 2028. What it covers, what it costs, and how to prepare.",
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
      metaTitle: "Loi 16 : l'étude du fonds de prévoyance",
      excerpt:
        "Chaque syndicat de copropriété au Québec a désormais une échéance légale pour obtenir une étude du fonds de prévoyance — et les données montrent que la plupart ne sont pas financièrement prêts pour ce qu'elle révélera. Voici ce qu'exige la Loi 16, et ce qui se passe une fois que votre immeuble a un échéancier de travaux.",
      metaDescription:
        "La Loi 16 oblige chaque syndicat de copropriété à obtenir une étude du fonds de prévoyance d'ici août 2028. Ce qu'elle couvre, ce qu'elle coûte, comment s'y préparer.",
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
    heroImage: "/images/blog/water-damage-humidity-header.jpg",
    heroStat: {
      value: "24–48h",
      label: {
        en: "How fast mold can begin growing after water exposure — EPA",
        fr: "Délai avant que la moisissure commence à se développer après un dégât d'eau — EPA",
      },
    },
    en: {
      title: "Hidden Water Damage: Why Soaked Floors and Walls Need Fast Action, Not a Wait-and-See",
      metaTitle: "Hidden Water Damage: The 48-Hour Mould Window",
      excerpt:
        "A small leak doesn't stay small. Here's what's actually happening inside your walls and floors in the hours and days after water exposure — and why waiting to deal with it costs more than acting fast.",
      metaDescription:
        "Mould can start growing 24-48 hours after water exposure. The hidden damage timeline, the warning signs, and when to open up instead of waiting.",
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
        {
          type: "linkParagraph",
          text: "If mould has already taken hold rather than merely threatening to, the order of work changes: the water has to be found before anything is removed, or it grows back in the same place.",
          linkText: "How we handle mould that has already started",
          href: "/services/mould-remediation",
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
      metaTitle: "Dégât d'eau caché : 48 h avant la moisissure",
      excerpt:
        "Une petite fuite ne reste jamais petite. Voici ce qui se passe réellement dans vos murs et vos planchers dans les heures et les jours suivant un dégât d'eau — et pourquoi attendre coûte plus cher qu'agir rapidement.",
      metaDescription:
        "La moisissure peut apparaître 24 à 48 heures après un dégât d'eau. L'échéancier des dommages cachés, les signes avant-coureurs, et quand ouvrir les murs.",
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
        {
          type: "linkParagraph",
          text: "Si la moisissure est déjà installée plutôt que simplement menaçante, l'ordre des travaux change : il faut trouver l'eau avant de retirer quoi que ce soit, sinon elle repousse au même endroit.",
          linkText: "Comment nous traitons une moisissure déjà installée",
          href: "/services/mould-remediation",
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
    heroImage: "/images/blog/basement-finishing-header.jpg",
    heroStat: {
      value: "200 Bq/m³",
      label: {
        en: "Health Canada's radon guideline — which starts applying to a basement once you finish it",
        fr: "La ligne directrice de Santé Canada sur le radon — qui s'applique au sous-sol dès qu'il est aménagé",
      },
    },
    en: {
      title: "Finishing a Basement in Laval: Permits, Moisture and Radon",
      metaTitle: "Finishing a Basement in Laval: What to Know",
      excerpt:
        "Finishing a basement isn't a cosmetic job. It changes which municipal rules apply and which health guidelines your space falls under — here's what Laval and Health Canada actually require.",
      metaDescription:
        "What Laval requires a permit for in a basement renovation, why insulating a damp basement backfires, and the radon rule most homeowners miss.",
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
      metaTitle: "Aménager un sous-sol à Laval : permis et humidité",
      excerpt:
        "Aménager un sous-sol n'est pas un travail cosmétique. Cela change les règles municipales qui s'appliquent et les lignes directrices sanitaires qui régissent la pièce — voici ce qu'exigent réellement Laval et Santé Canada.",
      metaDescription:
        "Ce qui exige un permis à Laval pour un sous-sol, pourquoi isoler un sous-sol humide aggrave le problème, et la règle du radon souvent oubliée.",
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
  {
    slug: "quebec-construction-code-transition-extended-2027",
    categoryTag: {
      en: "Building Code · Regulations",
      fr: "Code de construction · Réglementation",
    },
    publishedAt: "2026-08-28",
    readTimeMinutes: 7,
    heroImage: "/images/blog/construction-code-2027-header.jpg",
    heroStat: {
      value: "2027",
      label: {
        en: "Work started before October 17, 2027 can still follow the previous editions of Quebec's construction code",
        fr: "Les travaux commencés avant le 17 octobre 2027 peuvent encore suivre les éditions précédentes du Code de construction du Québec",
      },
    },
    en: {
      title: "Quebec Just Pushed the Construction Code Deadline to 2027 — What It Means for Your Renovation",
      metaTitle: "Quebec Construction Code: New 2027 Deadline",
      excerpt:
        "Regulations published on August 26 give the industry another year on the previous editions of the Building and Electricity chapters. It's a reprieve, not a repeal — and for a homeowner in Laval or Montreal, the operative rulebook may be your city's, not the province's.",
      metaDescription:
        "Quebec extended the construction code transition to October 17, 2027. What changed, what the newer code requires, and what it means for your renovation.",
      sections: [
        {
          type: "paragraph",
          text: "On August 26, regulations amending the Electricity and Building chapters of the Code de construction — and the Building chapter of the Code de sécurité — were published in the Gazette officielle du Québec. They take effect September 10, 2026, and they do one thing: they extend the transition period by a year. Work that begins before October 17, 2027 can still be built to the previous editions of those chapters. If you are planning a renovation this fall, this is the regulatory change most likely to touch your project — and the one most likely to be misread.",
        },
        { type: "heading", text: "What actually changed" },
        {
          type: "paragraph",
          text: "Two chapters are involved. The current Chapitre I, Bâtiment — built on the National Building Code of Canada 2020 as modified for Quebec — came into force on April 17, 2025. The current Chapitre V, Électricité — built on the Canadian Electrical Code 2021 as modified for Quebec — came into force on March 26, 2026. Each arrived with a transition period during which the previous edition could still be applied. The Bâtiment window was set to close on October 17, 2026, roughly seven weeks from now. The Électricité window was set to close on September 26, 2026, sooner still. Both now run to October 17, 2027.",
        },
        {
          type: "stats",
          items: [
            { value: "Oct 17, 2027", label: "New deadline — work must have begun by this date to use the previous editions" },
            { value: "Sept 10, 2026", label: "Date the amending regulations take effect" },
            { value: "1 year", label: "Length of the extension, for both the Building and Electricity chapters" },
          ],
        },
        {
          type: "timeline",
          items: [
            { time: "Apr 17, 2025", text: "The current Chapitre I, Bâtiment comes into force, incorporating the National Building Code 2020 as modified for Quebec." },
            { time: "Mar 26, 2026", text: "The current Chapitre V, Électricité comes into force, incorporating the Canadian Electrical Code 2021 as modified for Quebec." },
            { time: "Jul 7, 2026", text: "The RBQ publishes draft regulations extending both transition periods, open for public comment until August 7." },
            { time: "Aug 26, 2026", text: "The final regulations are published in the Gazette officielle du Québec." },
            { time: "Sept 10, 2026", text: "Those regulations take effect." },
            { time: "Oct 17, 2027", text: "The new outside date — work has to have begun before this to be built to the previous editions." },
          ],
        },
        { type: "heading", text: "This is a reprieve, not a repeal" },
        {
          type: "paragraph",
          text: "The distinction matters, because it is the part that gets lost in summary. The newer editions are in force and have been for months. What the extension preserves is the option of applying the previous editions, and only to work that has actually begun before the deadline. The APCHQ makes the same point plainly in its own note on the extension: this does not postpone the coming into force of the 2020 code. Municipal bylaws remain binding, and some municipalities already require the newer edition regardless of what the provincial transition allows.",
        },
        { type: "heading", text: "Whose rulebook applies to a house in Laval or Montreal" },
        {
          type: "paragraph",
          text: "Here is the piece most homeowners have never been told. For a typical single-family home or small plex, the provincial chapter is not the operative document at all. Chapitre I, Bâtiment does not apply to residential buildings of fewer than three storeys and fewer than nine dwelling units. Those buildings fall to the municipality, which adopts its own construction bylaw — commonly by referencing the provincial code, sometimes with its own additions, and on its own timetable.",
        },
        {
          type: "paragraph",
          text: "So the practical question is not only \"which edition does the province still allow\" but \"which edition has my city adopted, and as of when.\" Those two answers can differ, and the one that governs your permit is the municipal one. It is a question worth asking before the design is finalized rather than after the plans go in — a requirement discovered at permit review is a redraw, and in a market where review already runs weeks, a redraw is the expensive kind of delay.",
        },
        { type: "heading", text: "What the newer editions actually ask for" },
        {
          type: "paragraph",
          text: "An extension only matters where the two editions differ, so it is worth knowing where they do. On the building side, the RBQ's own material on the Quebec-modified 2020 code points to revised thermal envelope requirements, changes affecting stairs, new obligations around soil gas and radon, \"smart\" vapour barriers, and revised accessibility dimensions including universal washrooms. On the electrical side, the RBQ lists provisions for electric-vehicle charging infrastructure in residential buildings, a requirement to declare planned EV charging loads in the work declaration, a revised Section 10 on grounding, mandatory re-evaluation of electrical equipment exposed to water infiltration, receptacle requirements in spaces where children may be present, and a ban on selling unapproved electrical equipment.",
        },
        {
          type: "paragraph",
          text: "Read that list as a homeowner rather than as a contractor and a pattern shows up: the items you are most likely to actually meet are the electrical ones and the envelope ones. A kitchen renovation that rewires a wall, a panel upgraded to carry an induction range or a future charger, a basement being insulated and finished — those are the projects where the edition in use stops being paperwork and starts being what is inside your walls.",
        },
        {
          type: "linkParagraph",
          text: "Soil-gas and radon provisions are one of the sharpest differences between the editions, and a finished basement is where a homeowner is most likely to run into them.",
          linkText: "Finishing a basement: permits, moisture and radon",
          href: "/blog/finishing-a-basement-laval-permits-moisture-radon",
        },
        { type: "heading", text: "What to do if you're renovating in the next year" },
        {
          type: "list",
          items: [
            "Ask which edition your project is being designed and built to, and get the answer in writing. For the next year, two contractors quoting the same job can legally be working to different editions — and their prices will reflect that.",
            "Confirm with your borough or city, not just the province. The municipal bylaw is what your permit is issued under, and it can be stricter than the provincial transition.",
            "Where the difference is small, choose the newer edition anyway. Envelope, grounding and EV-ready provisions are the ones a buyer's inspector will eventually ask about.",
            "Don't read \"transition extended\" as \"nothing changed.\" Licensing, permits and the codes themselves all still apply, and the RBQ licence requirement is unaffected by any of this.",
            "Keep the paperwork: the permit, the edition applied, and the electrical work declaration. It matters at resale and it matters at claim time.",
          ],
        },
        {
          type: "paragraph",
          text: "For most homeowners this extension is quietly good news — it removes a deadline that would have landed in the middle of this autumn's projects, and it buys the industry a year to catch up on training and product supply. It is not permission to stop asking questions. If anything, a year in which two editions are simultaneously legal is exactly the year to be specific about which one you are getting.",
        },
        {
          type: "linkParagraph",
          text: "Renovision AnA plans and builds kitchen, bathroom and basement renovations across Laval and Montreal, and we handle the permit and code questions as part of the job rather than leaving them with you.",
          linkText: "Get a rough estimate in minutes",
          href: "/estimation",
        },
        {
          type: "paragraph",
          text: "Sources: Régie du bâtiment du Québec, \"Prolongation de la période transitoire en bâtiment et en électricité\" (July 7 and August 26, 2026) and its Modifications réglementaires page for the Électricité chapter; APCHQ, \"Prolongation de la période transitoire du Code de construction\" and \"Application du code de construction du Québec.\" Regulations and municipal bylaws change — confirm the requirements that apply to your own project with the RBQ and with your municipality before you start.",
        },
      ],
    },
    fr: {
      title: "Québec repousse à 2027 l'échéance du Code de construction — ce que ça change pour votre rénovation",
      metaTitle: "Code de construction : échéance reportée à 2027",
      excerpt:
        "Des règlements publiés le 26 août accordent à l'industrie une année de plus sur les éditions précédentes des chapitres Bâtiment et Électricité. C'est un sursis, pas une abrogation — et pour un propriétaire de Laval ou de Montréal, le règlement qui s'applique est peut-être celui de votre ville, pas celui de la province.",
      metaDescription:
        "Québec prolonge la période transitoire du Code de construction jusqu'au 17 octobre 2027. Ce qui change et ce que ça signifie pour votre rénovation.",
      sections: [
        {
          type: "paragraph",
          text: "Le 26 août, des règlements modifiant les chapitres Électricité et Bâtiment du Code de construction — ainsi que le chapitre Bâtiment du Code de sécurité — ont été publiés à la Gazette officielle du Québec. Ils entrent en vigueur le 10 septembre 2026 et font une seule chose : ils prolongent d'un an la période transitoire. Les travaux qui débutent avant le 17 octobre 2027 peuvent encore être réalisés selon les éditions précédentes de ces chapitres. Si vous planifiez une rénovation cet automne, c'est le changement réglementaire le plus susceptible de toucher votre projet — et celui qu'on risque le plus de mal interpréter.",
        },
        { type: "heading", text: "Ce qui a changé, exactement" },
        {
          type: "paragraph",
          text: "Deux chapitres sont visés. Le chapitre I, Bâtiment en vigueur — fondé sur le Code national du bâtiment du Canada 2020 modifié Québec — est entré en vigueur le 17 avril 2025. Le chapitre V, Électricité en vigueur — fondé sur le Code canadien de l'électricité 2021 modifié Québec — est entré en vigueur le 26 mars 2026. Chacun est arrivé avec une période transitoire pendant laquelle l'édition précédente pouvait encore être appliquée. La fenêtre du chapitre Bâtiment devait se refermer le 17 octobre 2026, soit dans environ sept semaines. Celle du chapitre Électricité devait se refermer le 26 septembre 2026, encore plus tôt. Les deux se rendent maintenant au 17 octobre 2027.",
        },
        {
          type: "stats",
          items: [
            { value: "17 oct. 2027", label: "Nouvelle échéance — les travaux doivent avoir débuté avant cette date pour appliquer les éditions précédentes" },
            { value: "10 sept. 2026", label: "Date d'entrée en vigueur des règlements modificatifs" },
            { value: "1 an", label: "Durée de la prolongation, pour les chapitres Bâtiment et Électricité" },
          ],
        },
        {
          type: "timeline",
          items: [
            { time: "17 avr. 2025", text: "Entrée en vigueur du chapitre I, Bâtiment actuel, qui intègre le Code national du bâtiment 2020 modifié Québec." },
            { time: "26 mars 2026", text: "Entrée en vigueur du chapitre V, Électricité actuel, qui intègre le Code canadien de l'électricité 2021 modifié Québec." },
            { time: "7 juill. 2026", text: "La RBQ publie des projets de règlement prolongeant les deux périodes transitoires, ouverts aux commentaires jusqu'au 7 août." },
            { time: "26 août 2026", text: "Les règlements finaux sont publiés à la Gazette officielle du Québec." },
            { time: "10 sept. 2026", text: "Ces règlements entrent en vigueur." },
            { time: "17 oct. 2027", text: "La nouvelle date limite — les travaux doivent avoir débuté avant celle-ci pour suivre les éditions précédentes." },
          ],
        },
        { type: "heading", text: "Un sursis, pas une abrogation" },
        {
          type: "paragraph",
          text: "La nuance compte, parce que c'est elle qui se perd dans les résumés. Les nouvelles éditions sont en vigueur, et le sont depuis des mois. Ce que la prolongation préserve, c'est la possibilité d'appliquer les éditions précédentes, et uniquement à des travaux réellement commencés avant l'échéance. L'APCHQ le dit clairement dans sa propre note sur la prolongation : cela ne reporte pas l'entrée en vigueur du code 2020. Les règlements municipaux demeurent contraignants, et certaines municipalités exigent déjà la nouvelle édition, peu importe ce que permet la transition provinciale.",
        },
        { type: "heading", text: "Quel règlement s'applique à une maison de Laval ou de Montréal" },
        {
          type: "paragraph",
          text: "Voici l'élément qu'on explique rarement aux propriétaires. Pour une maison unifamiliale ou un petit plex typique, le chapitre provincial n'est pas le document applicable. Le chapitre I, Bâtiment ne s'applique pas aux bâtiments d'habitation de moins de trois étages et de moins de neuf logements. Ces bâtiments relèvent de la municipalité, qui adopte son propre règlement de construction — souvent en renvoyant au code provincial, parfois avec ses propres ajouts, et selon son propre calendrier.",
        },
        {
          type: "paragraph",
          text: "La vraie question n'est donc pas seulement « quelle édition la province permet-elle encore », mais « quelle édition ma ville a-t-elle adoptée, et depuis quand ». Les deux réponses peuvent différer, et c'est la municipale qui gouverne votre permis. Cette question se pose avant que les plans soient finalisés, pas après leur dépôt : une exigence découverte à l'analyse du permis, c'est un redessin, et dans un contexte où l'analyse prend déjà des semaines, c'est le genre de retard qui coûte cher.",
        },
        { type: "heading", text: "Ce qu'exigent réellement les nouvelles éditions" },
        {
          type: "paragraph",
          text: "Une prolongation ne compte que là où les deux éditions diffèrent, alors autant savoir où c'est le cas. Du côté du bâtiment, la documentation de la RBQ sur le code 2020 modifié Québec pointe vers des exigences révisées d'enveloppe thermique, des changements touchant les escaliers, de nouvelles obligations relatives aux gaz souterrains et au radon, les pare-vapeur « intelligents », et des dimensions d'accessibilité révisées, dont les salles de bain universelles. Du côté électrique, la RBQ énumère notamment les dispositions d'infrastructure de recharge pour véhicules électriques dans les bâtiments d'habitation, l'obligation de déclarer les charges de recharge prévues dans la déclaration de travaux, une section 10 révisée sur la mise à la terre, la réévaluation obligatoire de l'appareillage électrique exposé à une infiltration d'eau, des exigences de prises dans les endroits où des enfants peuvent se trouver, et l'interdiction de vendre de l'appareillage électrique non approuvé.",
        },
        {
          type: "paragraph",
          text: "Lue avec des yeux de propriétaire plutôt que d'entrepreneur, cette liste laisse voir une tendance : les éléments que vous rencontrerez vraiment sont les éléments électriques et ceux de l'enveloppe. Une rénovation de cuisine qui refait le filage d'un mur, un panneau mis à niveau pour alimenter une cuisinière à induction ou une future borne, un sous-sol qu'on isole et qu'on aménage — ce sont les projets où l'édition appliquée cesse d'être de la paperasse et devient ce qui se trouve dans vos murs.",
        },
        {
          type: "linkParagraph",
          text: "Les dispositions sur les gaz souterrains et le radon comptent parmi les différences les plus marquées entre les éditions, et c'est au sous-sol aménagé qu'un propriétaire y est le plus exposé.",
          linkText: "Aménager un sous-sol : permis, humidité et radon",
          href: "/blog/finishing-a-basement-laval-permits-moisture-radon",
        },
        { type: "heading", text: "Quoi faire si vous rénovez dans la prochaine année" },
        {
          type: "list",
          items: [
            "Demandez selon quelle édition votre projet est conçu et construit, et obtenez la réponse par écrit. Pendant un an, deux entrepreneurs qui soumissionnent le même chantier peuvent légalement travailler selon des éditions différentes — et leurs prix vont le refléter.",
            "Validez auprès de votre arrondissement ou de votre ville, pas seulement de la province. C'est le règlement municipal qui encadre l'émission de votre permis, et il peut être plus exigeant que la transition provinciale.",
            "Quand l'écart est mince, choisissez quand même la nouvelle édition. L'enveloppe, la mise à la terre et les dispositions « prêt pour la recharge » sont celles sur lesquelles l'inspecteur d'un futur acheteur reviendra.",
            "Ne lisez pas « période transitoire prolongée » comme « rien n'a changé ». Les licences, les permis et les codes eux-mêmes s'appliquent toujours, et l'exigence de licence RBQ n'est aucunement touchée.",
            "Conservez les documents : le permis, l'édition appliquée et la déclaration de travaux électriques. Ça compte à la revente, et ça compte lors d'une réclamation.",
          ],
        },
        {
          type: "paragraph",
          text: "Pour la plupart des propriétaires, cette prolongation est une bonne nouvelle discrète : elle retire une échéance qui serait tombée au milieu des chantiers de cet automne, et elle donne à l'industrie une année pour rattraper la formation et l'approvisionnement. Ce n'est pas une permission d'arrêter de poser des questions. Au contraire : une année où deux éditions sont simultanément légales est précisément l'année où il faut être précis sur celle que vous obtenez.",
        },
        {
          type: "linkParagraph",
          text: "Renovision AnA planifie et réalise des rénovations de cuisine, de salle de bain et de sous-sol à Laval et à Montréal, et nous prenons en charge les questions de permis et de code plutôt que de vous les laisser.",
          linkText: "Obtenez une estimation en quelques minutes",
          href: "/estimation",
        },
        {
          type: "paragraph",
          text: "Sources : Régie du bâtiment du Québec, « Prolongation de la période transitoire en bâtiment et en électricité » (7 juillet et 26 août 2026) et sa page Modifications réglementaires pour le chapitre Électricité; APCHQ, « Prolongation de la période transitoire du Code de construction » et « Application du code de construction du Québec ». Les règlements et les règlements municipaux changent — confirmez les exigences applicables à votre projet auprès de la RBQ et de votre municipalité avant de commencer.",
        },
      ],
    },
  },

  {
    slug: "5-things-insurers-look-for-in-a-restoration-contractor",
    categoryTag: { en: "Insurance claims · Restoration", fr: "Réclamation d'assurance · Restauration" },
    publishedAt: "2026-09-04",
    readTimeMinutes: 6,
    heroImage: "/images/blog/insurer-checklist-header.jpg",
    heroStat: {
      value: "5",
      label: { en: "The five things an adjuster checks before approving a restoration contractor's file — and how many of them are documentation, not drying", fr: "Les cinq choses qu'un expert vérifie avant d'approuver le dossier d'un entrepreneur en restauration — et combien d'entre elles sont de la documentation, pas du séchage" },
    },
    en: {
      title: "5 Things Insurers Look for in a Restoration Contractor",
      metaTitle: "What Insurers Want in a Restoration Contractor",
      excerpt: "Adjusters don't pick contractors by price alone. Here are the five things that actually decide whether your file gets approved quickly — or gets sent back with questions.",
      metaDescription: "The five criteria claims adjusters use to evaluate restoration contractors: written scopes, photo documentation, drying logs, direct billing, and insurance-ready paperwork.",
      sections: [
        { type: "paragraph", text: "If you think an insurer picks a restoration contractor based on who submitted the lowest quote, you're missing most of what happens inside a claims file. The adjuster's job isn't to find the cheapest option — it's to close the file with a complete, defensible, auditable record of what was done and why. The contractor who makes that job easier gets approved faster, questioned less, and called again for the next loss. Here are the five things that actually move the needle." },
        { type: "heading", text: "1. A written scope, before the work starts" },
        { type: "paragraph", text: "This is the single most important document in any restoration file. A written scope tells the adjuster exactly what the contractor plans to do, broken down by line item, with quantities and unit prices. It separates what's covered from what isn't. It separates structure from improvements — the boundary the adjuster has to rule on. A scope that does this work upfront saves the adjuster from having to reconstruct it from a lump-sum invoice after the fact. Contractors who submit a round-number quote with no detail are the ones who get follow-up calls. Contractors who submit a line-by-line scope with cause-of-loss codes and supporting photos are the ones who get paid." },
        { type: "heading", text: "2. Dated photo documentation, from arrival to completion" },
        { type: "paragraph", text: "Photos taken before anything is moved — that's the first thing an adjuster looks for in a restoration file. The initial state of the loss cannot be reconstructed after cleanup begins. What was wet, what was dry, what was already damaged before the water arrived — these are facts that only exist in the first hour. After that, they're memories. A contractor who documents the job site before touching anything, then documents each phase through to completion, hands the adjuster a file that self-authenticates. A contractor who submits only 'after' photos leaves the adjuster guessing what was done and why. The difference is the difference between a file that moves and a file that sits." },
        { type: "heading", text: "3. Drying logs — not one reading, but a series" },
        { type: "paragraph", text: "A single moisture reading taken on the last day proves the material is dry now. It does not prove the drying was necessary yesterday, or that it took the right amount of time, or that the equipment was sized correctly for the space. A proper drying log shows readings taken at regular intervals from day one through to completion, with target moisture levels stated upfront and actual progress tracked against them. This is what objectively justifies the drying duration to an auditor — and, in Quebec's insurance ecosystem, to the ChAD if the file is ever reviewed. The EPA's 24-to-48-hour mould benchmark is the clock every adjuster watches. A contractor who logs moisture readings as they go, rather than reconstructing a log at the end, is the contractor whose file doesn't come back for clarification." },
        { type: "heading", text: "4. Direct billing, or at least an invoice formatted for an adjuster" },
        { type: "paragraph", text: "The best case: the contractor bills the insurer directly, and the adjuster never has to explain to a policyholder why a deposit is needed or why a cheque hasn't arrived. The next-best case: the contractor produces an invoice that is line-itemed, separated by trade, with dates that match the drying log and photos that match the scope, in a format the adjuster can drop straight into the claim management system without retyping anything. Xactimate, Symbility, Encircle, Dash — these are the platforms adjusters live in. A contractor who speaks that language, even partially, removes friction from the file. A contractor who sends a PDF of a handwritten note adds friction. Over a year of claims, that friction adds up to real money." },
        { type: "heading", text: "5. A single point of contact for the whole job" },
        { type: "paragraph", text: "The adjuster's workflow is already fragmented. One file might involve the policyholder, the syndicate, two insurance policies, a plumber, and an environmental consultant. Adding a restoration contractor who requires separate calls for the water extraction crew, the drying team, and the drywall installer multiplies the adjuster's coordination load. A contractor who runs the whole job — extraction, drying, reconstruction, finishing — under one coordinator gives the adjuster one name to call, one invoice to process, and one person to ask when something changes. That's not a luxury; in an industry where delay costs money, it's a structural advantage." },
        {
          type: "linkParagraph",
          text: "All five of these are built into how we work with insurers and adjusters across Laval and Montreal — not as add-ons, but as the standard way every file is handled.",
          linkText: "See how we work with insurance companies →",
          href: "/assureurs",
        },
        { type: "paragraph", text: "One thing worth stating plainly: nothing here tells you what a given policy covers or what an insurer will decide. Those answers live in the contract and with the adjuster. What we can do is more specific: document cleanly, dry to the readings, and hand the adjuster a file that closes." },
      ],
    },
    fr: {
      title: "5 choses que les assureurs recherchent chez un entrepreneur en restauration",
      metaTitle: "Ce que les assureurs veulent chez un entrepreneur en restauration",
      excerpt: "Les experts en sinistre ne choisissent pas un entrepreneur au prix seulement. Voici les cinq choses qui décident vraiment si votre dossier est approuvé rapidement — ou s'il revient avec des questions.",
      metaDescription: "Les cinq critères que les experts en sinistre utilisent pour évaluer les entrepreneurs en restauration : portée écrite, documentation photo, relevés de séchage, facturation directe et paperasse prête pour l'assurance.",
      sections: [
        { type: "paragraph", text: "Si vous pensez qu'un assureur choisit un entrepreneur en restauration selon le plus bas soumissionnaire, vous passez à côté de l'essentiel de ce qui se passe dans un dossier de réclamation. Le travail de l'expert en sinistre n'est pas de trouver le moins cher — c'est de fermer le dossier avec un historique complet, défendable et vérifiable de ce qui a été fait et pourquoi. L'entrepreneur qui facilite ce travail est approuvé plus vite, questionné moins souvent, et rappelé pour le prochain sinistre. Voici les cinq choses qui font réellement la différence." },
        { type: "heading", text: "1. Une portée de travaux écrite, avant que les travaux commencent" },
        { type: "paragraph", text: "C'est le document le plus important de tout dossier de restauration. Une portée écrite dit à l'expert exactement ce que l'entrepreneur prévoit de faire, ventilé par poste, avec quantités et prix unitaires. Elle sépare ce qui est couvert de ce qui ne l'est pas. Elle sépare la structure des améliorations — la frontière sur laquelle l'expert doit trancher. Une portée qui fait ce travail d'avance évite à l'expert de devoir la reconstituer à partir d'une facture globale après coup. Les entrepreneurs qui soumettent un chiffre rond sans détail sont ceux qui reçoivent des appels de suivi. Ceux qui soumettent une portée ligne par ligne avec codes de cause et photos à l'appui sont ceux qui sont payés." },
        { type: "heading", text: "2. Une documentation photo datée, de l'arrivée à la fin" },
        { type: "paragraph", text: "Des photos prises avant que quoi que ce soit ne bouge — c'est la première chose qu'un expert cherche dans un dossier de restauration. L'état initial du sinistre ne peut pas être reconstitué après le début du nettoyage. Ce qui était mouillé, ce qui était sec, ce qui était déjà endommagé avant l'arrivée de l'eau — ce sont des faits qui n'existent que dans la première heure. Après, ce sont des souvenirs. Un entrepreneur qui documente le chantier avant de toucher à quoi que ce soit, puis chaque phase jusqu'à la fin, remet à l'expert un dossier qui s'authentifie tout seul. Un entrepreneur qui ne soumet que des photos « après » laisse l'expert deviner ce qui a été fait et pourquoi. La différence est celle entre un dossier qui avance et un dossier qui attend." },
        { type: "heading", text: "3. Des relevés de séchage — pas une lecture, mais une série" },
        { type: "paragraph", text: "Un seul relevé d'humidité pris le dernier jour prouve que le matériau est sec aujourd'hui. Il ne prouve pas que le séchage était nécessaire hier, ni qu'il a pris le bon temps, ni que l'équipement était bien dimensionné pour l'espace. Un journal de séchage complet montre des relevés pris à intervalles réguliers du premier jour à la fin, avec des niveaux d'humidité cibles établis au départ et la progression réelle suivie en continu. C'est ce qui justifie objectivement la durée du séchage à un auditeur — et, dans l'écosystème d'assurance québécois, à la ChAD si le dossier est un jour examiné. Le seuil de 24 à 48 heures de l'EPA pour la moisissure est l'horloge que chaque expert surveille. Un entrepreneur qui consigne ses relevés au fur et à mesure, plutôt que de reconstituer un journal à la fin, est celui dont le dossier ne revient pas pour clarification." },
        { type: "heading", text: "4. La facturation directe, ou au moins une facture formatée pour un expert" },
        { type: "paragraph", text: "Le meilleur cas : l'entrepreneur facture directement l'assureur, et l'expert n'a jamais à expliquer à un assuré pourquoi un dépôt est nécessaire ou pourquoi un chèque n'est pas arrivé. Le deuxième meilleur cas : l'entrepreneur produit une facture détaillée par poste, séparée par corps de métier, avec des dates qui correspondent au journal de séchage et des photos qui correspondent à la portée, dans un format que l'expert peut déposer directement dans son système de gestion de réclamation sans rien retaper. Xactimate, Symbility, Encircle, Dash — ce sont les plateformes dans lesquelles vivent les experts. Un entrepreneur qui parle ce langage, même partiellement, retire de la friction du dossier. Un entrepreneur qui envoie un PDF d'une note manuscrite en ajoute. Sur une année de réclamations, cette friction devient de l'argent réel." },
        { type: "heading", text: "5. Un seul point de contact pour tout le chantier" },
        { type: "paragraph", text: "Le flux de travail de l'expert est déjà fragmenté. Un dossier peut impliquer l'assuré, le syndicat, deux polices d'assurance, un plombier et un consultant en environnement. Ajouter un entrepreneur en restauration qui exige des appels séparés pour l'équipe d'extraction, l'équipe de séchage et le poseur de gypse multiplie la charge de coordination de l'expert. Un entrepreneur qui mène tout le chantier — extraction, séchage, reconstruction, finition — sous un seul coordonnateur donne à l'expert un nom à appeler, une facture à traiter et une personne à qui s'adresser quand quelque chose change. Ce n'est pas un luxe; dans une industrie où le délai coûte de l'argent, c'est un avantage structurel." },
        {
          type: "linkParagraph",
          text: "Ces cinq éléments sont intégrés à notre façon de travailler avec les assureurs et les experts en sinistre à Laval et à Montréal — pas comme des suppléments, mais comme la norme pour chaque dossier.",
          linkText: "Voir comment nous travaillons avec les compagnies d'assurance →",
          href: "/assureurs",
        },
        { type: "paragraph", text: "Une chose qu'il faut dire clairement : rien ici ne vous dit ce qu'une police donnée couvre ou ce qu'un assureur décidera. Ces réponses se trouvent dans le contrat et avec l'expert. Ce que nous pouvons faire est plus précis : documenter proprement, sécher jusqu'aux relevés, et remettre à l'expert un dossier qui se ferme." },
      ],
    },
  },

  {
    slug: "cut-unit-downtime-after-water-damage",
    categoryTag: { en: "Water damage · Property management", fr: "Dégât d'eau · Gestion immobilière" },
    publishedAt: "2026-09-04",
    readTimeMinutes: 6,
    heroImage: "/images/blog/property-manager-downtime-header.jpg",
    heroStat: {
      value: "2",
      label: { en: "Two clocks running at once after a water loss: the drying clock and the vacancy clock. Every day you wait on one, the other costs money.", fr: "Deux horloges qui tournent en même temps après un dégât d'eau : l'horloge du séchage et l'horloge de l'inoccupation. Chaque jour d'attente sur l'une fait perdre de l'argent à l'autre." },
    },
    en: {
      title: "How Property Managers Can Cut Unit Downtime After Water Damage",
      metaTitle: "Cut Downtime After a Water Loss: Property Managers",
      excerpt: "Two clocks start the moment water enters a unit — one for drying, one for lost rent. Here's how to run them both on the same timeline, not one after the other.",
      metaDescription: "How property managers in Laval and Montreal can reduce unit downtime after water damage: the two-clock problem, single point of contact, predictable timelines, and insurance-ready documentation.",
      sections: [
        { type: "paragraph", text: "When a pipe bursts in unit 4B at 11 PM, two clocks start running before anyone has set foot in the building. The first clock is biological: the EPA says wet material is very likely to grow mould within 24 to 48 hours. The second clock is financial: every day that unit sits empty, it's not generating rent. In a Laval market where a two-bedroom rents for around $1,500 a month, that's $50 a day — and that's before you count the tenant who might walk if they don't see progress, or the neighbouring unit whose ceiling is now also wet." },
        { type: "paragraph", text: "The mistake most property managers make is treating these as sequential problems: first dry the unit, then figure out the renovation, then schedule the contractor, then wait for the work to get done. The managers who keep their portfolios healthy treat them as parallel problems — and they structure their vendor relationships so that when the phone rings at 11 PM, the entire chain is already in place." },
        { type: "heading", text: "The two-clock problem, and why sequential is expensive" },
        { type: "paragraph", text: "Here's what the sequential approach looks like in practice, and why it costs more than the water damage itself:" },
        {
          type: "timeline",
          items: [
            { time: "Day 1", text: "The loss happens. You call a plumber to stop the source. The plumber comes, fixes the pipe, and leaves. The unit is still wet." },
            { time: "Days 2-3", text: "You call a water damage contractor. They arrive, extract standing water, set up drying equipment. Drying takes 3-5 days. During this time, nobody is thinking about the reconstruction." },
            { time: "Days 6-8", text: "Drying is complete. Now you call a drywall contractor. They're booked for next week." },
            { time: "Days 9-16", text: "Drywall is hung, taped, mudded. Now you call a painter. They're available in five days." },
            { time: "Days 17-22", text: "Paint is dry. Now you call a flooring installer. They can start next Monday." },
            { time: "Days 23-30", text: "Flooring is done. The unit is finally ready to show. You've lost a month of rent, fielded calls from three different trades, and spent more time coordinating than any single trade cost." },
          ],
        },
        { type: "paragraph", text: "Now compare that to the parallel approach: one call, one contractor, one coordinator. The extraction crew arrives within hours. Drying starts immediately — and while it's running, the same coordinator has already scheduled the drywall crew, ordered materials, and pencilled in the painter. The trades don't wait for each other because they're all on the same schedule, managed by the same person. The unit is dry, rebuilt, painted, and floor-ready in roughly half the time." },
        { type: "heading", text: "One coordinator instead of four" },
        { type: "paragraph", text: "The single biggest variable in unit downtime after water damage isn't the size of the loss — it's the number of phone calls required to get from standing water to show-ready. Every handoff between trades is a place where the schedule can break. The plumber finishes on Thursday but the drywall crew starts on Tuesday — that's four lost days that didn't need to happen. A single coordinator who owns the entire job from extraction to finish eliminates those gaps because they're not coordinating across companies; they're sequencing within one team." },
        { type: "heading", text: "Documentation that doesn't come back" },
        { type: "paragraph", text: "The other hidden cost of water damage is administrative. An insurer or an owner asks for documentation — photos, moisture readings, a scope of work — and if you don't have it ready, you spend hours chasing it from three different contractors. Worse: you get three different documents in three different formats, none of which match each other, and your credibility with the owner takes a hit. A single contractor who produces one set of dated photos, one set of moisture readings, and one itemized invoice — in a format an adjuster can process — removes that cost entirely. The file is complete before anyone asks for it." },
        {
          type: "linkParagraph",
          text: "If you're managing a portfolio where water damage isn't a question of 'if' but 'when,' the difference between a single phone call and a chain of four is the difference between a unit that's back on the market in two weeks and one that's still waiting for paint in week four.",
          linkText: "See how we work with property managers →",
          href: "/gestionnaires",
        },
        { type: "paragraph", text: "One practical note: nothing here replaces the role of your insurer or claims adjuster. The drying clock and the claims process run on parallel tracks. What we can do is make sure the drying track doesn't stop while the claims track is still warming up — because in Quebec, the EPA's 24-to-48-hour mould window is the one deadline that doesn't wait for anyone." },
      ],
    },
    fr: {
      title: "Comment les gestionnaires peuvent réduire l'inoccupation après un dégât d'eau",
      metaTitle: "Réduire l'inoccupation après un dégât d'eau",
      excerpt: "Deux horloges démarrent au moment où l'eau entre dans un logement — une pour le séchage, une pour le loyer perdu. Voici comment les faire avancer sur le même échéancier, pas l'une après l'autre.",
      metaDescription: "Comment les gestionnaires immobiliers de Laval et Montréal peuvent réduire l'inoccupation après un dégât d'eau : le problème des deux horloges, un point de contact unique, des délais prévisibles et une documentation prête pour l'assurance.",
      sections: [
        { type: "paragraph", text: "Quand un tuyau éclate dans le logement 4B à 23h, deux horloges se mettent en marche avant même que quelqu'un mette les pieds dans l'immeuble. La première horloge est biologique : selon l'EPA, un matériau mouillé développe très probablement de la moisissure en 24 à 48 heures. La deuxième horloge est financière : chaque jour où ce logement reste vide, il ne génère pas de loyer. Dans le marché lavallois, où un 4½ se loue autour de 1 500 $ par mois, c'est 50 $ par jour — et c'est sans compter le locataire qui pourrait partir s'il ne voit pas de progrès, ou le logement voisin dont le plafond est maintenant lui aussi mouillé." },
        { type: "paragraph", text: "L'erreur que la plupart des gestionnaires commettent est de traiter ces problèmes comme séquentiels : d'abord assécher le logement, ensuite planifier la rénovation, ensuite trouver un entrepreneur, ensuite attendre que les travaux se fassent. Les gestionnaires qui gardent leur portefeuille en santé les traitent comme des problèmes parallèles — et ils structurent leurs relations avec les fournisseurs pour que, quand le téléphone sonne à 23h, toute la chaîne soit déjà en place." },
        { type: "heading", text: "Le problème des deux horloges, et pourquoi le séquentiel coûte cher" },
        { type: "paragraph", text: "Voici à quoi ressemble l'approche séquentielle dans la pratique, et pourquoi elle coûte plus cher que le dégât d'eau lui-même :" },
        {
          type: "timeline",
          items: [
            { time: "Jour 1", text: "Le sinistre survient. Vous appelez un plombier pour arrêter la source. Le plombier vient, répare le tuyau et repart. Le logement est encore mouillé." },
            { time: "Jours 2-3", text: "Vous appelez un entrepreneur en dégât d'eau. Il arrive, extrait l'eau stagnante, installe l'équipement de séchage. Le séchage prend 3 à 5 jours. Pendant ce temps, personne ne pense à la reconstruction." },
            { time: "Jours 6-8", text: "Le séchage est terminé. Vous appelez maintenant un poseur de gypse. Il est réservé pour la semaine prochaine." },
            { time: "Jours 9-16", text: "Le gypse est posé, les joints sont tirés. Vous appelez un peintre. Il est disponible dans cinq jours." },
            { time: "Jours 17-22", text: "La peinture est sèche. Vous appelez un poseur de plancher. Il peut commencer lundi prochain." },
            { time: "Jours 23-30", text: "Le plancher est posé. Le logement est enfin prêt à visiter. Vous avez perdu un mois de loyer, fait des appels à trois corps de métier différents, et passé plus de temps à coordonner que ce que chaque métier a coûté." },
          ],
        },
        { type: "paragraph", text: "Maintenant, comparez avec l'approche parallèle : un seul appel, un seul entrepreneur, un seul coordonnateur. L'équipe d'extraction arrive dans les heures qui suivent. Le séchage commence immédiatement — et pendant qu'il fonctionne, le même coordonnateur a déjà planifié l'équipe de gypse, commandé les matériaux et réservé le peintre. Les métiers ne s'attendent pas les uns les autres parce qu'ils sont tous sur le même échéancier, géré par la même personne. Le logement est sec, reconstruit, peint et prêt pour le plancher en environ la moitié du temps." },
        { type: "heading", text: "Un coordonnateur au lieu de quatre" },
        { type: "paragraph", text: "La variable la plus importante dans le temps d'inoccupation après un dégât d'eau n'est pas la taille du sinistre — c'est le nombre d'appels nécessaires pour passer de l'eau stagnante à l'état prêt à visiter. Chaque passage d'un métier à l'autre est un endroit où l'échéancier peut casser. Le plombier finit jeudi mais l'équipe de gypse commence mardi — ce sont quatre jours perdus qui n'avaient pas besoin de l'être. Un coordonnateur unique qui possède l'ensemble du chantier de l'extraction à la finition élimine ces écarts parce qu'il ne coordonne pas entre entreprises; il fait le séquencement à l'intérieur d'une seule équipe." },
        { type: "heading", text: "Une documentation qui ne revient pas en arrière" },
        { type: "paragraph", text: "L'autre coût caché d'un dégât d'eau est administratif. Un assureur ou un propriétaire demande la documentation — photos, relevés d'humidité, portée des travaux — et si vous ne l'avez pas prête, vous passez des heures à la relancer auprès de trois entrepreneurs différents. Pire : vous recevez trois documents différents dans trois formats différents, dont aucun ne correspond aux autres, et votre crédibilité auprès du propriétaire en prend un coup. Un seul entrepreneur qui produit un seul jeu de photos datées, un seul jeu de relevés d'humidité et une seule facture détaillée — dans un format qu'un expert peut traiter — élimine ce coût entièrement. Le dossier est complet avant que quiconque le demande." },
        {
          type: "linkParagraph",
          text: "Si vous gérez un portefeuille où le dégât d'eau n'est pas une question de « si » mais de « quand », la différence entre un seul appel et une chaîne de quatre est la différence entre un logement de retour sur le marché en deux semaines et un logement qui attend encore la peinture en quatrième semaine.",
          linkText: "Voir comment nous travaillons avec les gestionnaires immobiliers →",
          href: "/gestionnaires",
        },
        { type: "paragraph", text: "Une précision pratique : rien ici ne remplace le rôle de votre assureur ou de votre expert en sinistre. L'horloge du séchage et le processus de réclamation avancent sur des voies parallèles. Ce que nous pouvons faire, c'est empêcher que la voie du séchage s'arrête pendant que celle de la réclamation chauffe encore — parce qu'au Québec, le seuil de 24 à 48 heures de l'EPA pour la moisissure est la seule échéance qui n'attend personne." },
      ],
    },
  },

];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
