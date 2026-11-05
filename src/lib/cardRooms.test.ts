import { describe, expect, it } from "vitest";
import { cardRooms } from "./cardRooms";

const room = (name: string, floor_area_sqm: unknown) => ({ name, floor_area_sqm });

describe("the rooms a project card draws", () => {
  it("draws every room of a sixteen-room house", () => {
    const house = Array.from({ length: 16 }, (_, i) => room(`Room ${i + 1}`, 5 + i));
    expect(cardRooms(house)).toEqual(house);
  });

  it("drops the smallest rooms past the cap, not the last ones made", () => {
    const rooms = [room("Living", 30), room("Closet", 2), room("Kitchen", 12), room("WC", 3)];
    expect(cardRooms(rooms, 2).map((r) => r.name)).toEqual(["Living", "Kitchen"]);
  });

  it("keeps the rooms it draws in the order they were made", () => {
    const rooms = [room("Hall", 6), room("Dining", 24), room("Bedroom", 12), room("Closet", 2)];
    expect(cardRooms(rooms, 3).map((r) => r.name)).toEqual(["Hall", "Dining", "Bedroom"]);
  });

  it("reads an area stored as text, and treats a missing one as the smallest", () => {
    const rooms = [room("Unknown", null), room("Big", "20.5"), room("Small", "4")];
    expect(cardRooms(rooms, 2).map((r) => r.name)).toEqual(["Big", "Small"]);
  });
});
