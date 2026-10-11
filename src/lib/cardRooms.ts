/**
 * Which rooms of a storey a project card draws.
 *
 * Every geometry blob travels over a job-site connection for every card in
 * the list, so the count is capped. It was twelve, taken in the order the
 * rooms were made — and the owner's reference house has sixteen, so its card
 * drew the bedrooms and closets and left off the dining room, the sitting
 * room, the terrace and the balcony: the last four drawn, and the four
 * biggest. A card is a picture of the house; half a house with its living
 * spaces missing reads as a broken plan, not a summary (found 11 Oct 2026).
 *
 * So: 24, which takes a whole house — the reference's sixteen rooms with room
 * to spare. And when even that is exceeded, the rooms dropped are the
 * SMALLEST, which costs a cupboard rather than the living room. The kept
 * rooms stay in their original order, because a room with no plan position
 * is packed in that order and the card has to pack it the way the storey
 * does.
 */
export const CARD_ROOM_CAP = 24;

export function cardRooms<T extends { floor_area_sqm?: unknown }>(
  rooms: T[],
  cap = CARD_ROOM_CAP,
): T[] {
  if (rooms.length <= cap) return rooms;
  const area = (room: T) => {
    const n = Number(room.floor_area_sqm);
    return Number.isFinite(n) ? n : 0;
  };
  const kept = new Set(
    rooms
      .map((room, index) => ({ index, area: area(room) }))
      .sort((a, b) => b.area - a.area || a.index - b.index)
      .slice(0, cap)
      .map(({ index }) => index),
  );
  return rooms.filter((_, index) => kept.has(index));
}
