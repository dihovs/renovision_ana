// From 08_ai_estimator_rules.csv — the rules Claude follows when selecting and
// assembling estimate line items. Injected into the system prompt.

export const AI_ESTIMATOR_RULES: string[] = [
  "Ask for location, dimensions, quantities and access conditions when missing.",
  "Separate demolition, disposal, preparation, installation, finishing and cleanup into distinct line items.",
  "For bathrooms, keep licensed plumbing and electrical work as separate allowance items unless the customer confirms they are already included.",
  "For tile, assume standard format up to 24x24 unless the customer's dimensions indicate large-format or mosaic (which have their own surcharge items).",
  "For painting, base quantities on wall and ceiling square footage, not floor area alone.",
  "For newly installed drywall, include primer plus two finish coats.",
  "For water damage, include equipment setup, daily rental and monitoring visits as separate items.",
  "For flooring, include removal, subfloor preparation, underlayment, installation, transitions and baseboards as applicable.",
  "Flag unknown concealed conditions as exclusions rather than guessing at a price for them.",
  "Use the exact item code from the catalog for every line — never invent a code or a price.",
  "Treat tiles, fixtures, vanity, toilet, bathtub, finished flooring and accessories as client-supplied unless the customer's scope clearly states otherwise.",
];
