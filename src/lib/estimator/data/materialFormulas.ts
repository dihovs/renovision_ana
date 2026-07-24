// Generated from 07_material_formula_templates.csv. Informational reference only (not used in money math).
export const MATERIAL_FORMULAS: { material: string; formula: string; assumption: string }[] = [
  { material: "Drywall sheets", formula: "CEILING(scope_sqft/32*1.10,1)", assumption: "4x8 sheets with 10% waste" },
  { material: "Drywall compound", formula: "scope_sqft/450", assumption: "Approximate pails/buckets; adjust by finish level" },
  { material: "Primer", formula: "scope_sqft/350", assumption: "Gallons/layers depending on coverage" },
  { material: "Wall paint", formula: "scope_sqft/350*coat_count", assumption: "Gallons before waste" },
  { material: "Flooring", formula: "scope_sqft*1.10", assumption: "10% waste standard" },
  { material: "Straight-lay tile", formula: "scope_sqft*1.10", assumption: "10% waste standard" },
  { material: "Diagonal/complex tile", formula: "scope_sqft*1.15", assumption: "15% waste" },
  { material: "Thinset mortar", formula: "scope_sqft/50", assumption: "Typical bag coverage; verify product" },
  { material: "Grout", formula: "scope_sqft/150", assumption: "Varies greatly with tile and joint size" },
  { material: "Baseboard", formula: "room_perimeter_linear_ft*1.10", assumption: "10% waste" },
  { material: "Underlayment", formula: "scope_sqft*1.05", assumption: "5% waste" },
  { material: "Vapour barrier", formula: "scope_sqft*1.10", assumption: "Overlap and waste" },
  { material: "Batt insulation", formula: "scope_sqft*1.05", assumption: "5% waste" },
];
