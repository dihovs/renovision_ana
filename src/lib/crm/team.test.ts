import { describe, expect, it } from "vitest";
import { can, cleanPermissions, effectivePermissions, memberInitials, ROLE_PERMISSIONS } from "./team";

describe("team permissions", () => {
  it("crew never see prices by default", () => {
    expect(can({ role: "crew", permissions: {} }, "see_prices")).toBe(false);
    expect(can({ role: "crew", permissions: {} }, "fill_checklists")).toBe(true);
  });

  it("an override wins over the role's default, both ways", () => {
    const lead = effectivePermissions({ role: "crew", permissions: { approve_time: true } });
    expect(lead.approve_time).toBe(true);
    const restricted = effectivePermissions({ role: "manager", permissions: { collect_payment: false } });
    expect(restricted.collect_payment).toBe(false);
    expect(restricted.see_prices).toBe(ROLE_PERMISSIONS.manager.see_prices);
  });

  it("unknown keys and non-booleans are dropped", () => {
    expect(cleanPermissions({ see_prices: true, launch_rockets: true, approve_time: "yes" })).toEqual({ see_prices: true });
  });

  it("initials come from the first and last name unless set", () => {
    expect(memberInitials({ display_name: "Jean-Marc Roy", initials: null })).toBe("JR");
    expect(memberInitials({ display_name: "Ana", initials: null })).toBe("A");
    expect(memberInitials({ display_name: "Jean-Marc Roy", initials: "jm" })).toBe("JM");
  });
});
