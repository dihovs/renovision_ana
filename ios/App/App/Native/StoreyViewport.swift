import SwiftUI

/// Floor metres → screen points, and back — the ONE transform the storey's
/// always-present multi-room layer and the room editor that fades in over
/// it both read, on the SAME frame, so a room drawn by one lines up with
/// the same room drawn by the other.
///
/// Built 18 Aug 2026 to replace a `.sheet`-based swap between two
/// independently-scaled views (`LevelCanvas` for the floor, `RoomEditorCore`
/// alone for a room), which the owner rejected twice — first as a jump,
/// then, after the jump was fixed, as still not "the same canvas" magicplan
/// itself uses. His own words: *"change the structure, make it like magic
/// plan."* There is only one honest way to get a continuous zoom out of two
/// SwiftUI `Canvas` draws (which are immediate-mode paths, not positioned
/// views — nothing a `matchedGeometryEffect` could travel) — feed both from
/// the same animated rectangle. This is that rectangle.
struct StoreyViewport {
    /// What is currently framed, in floor-space metres. THIS is the value
    /// `withAnimation` interpolates — everything else here is arithmetic on
    /// whatever `bounds` is on a given frame, mid-animation or settled.
    let bounds: CGRect
    let canvasSize: CGSize
    /// Screen-point margin around `bounds` — generous at floor depth so the
    /// paper shows, tighter is not needed since `bounds` itself shrinks to
    /// one room's own extent when focused.
    var inset: CGFloat = 28
    /// **Room for the chrome that floats OVER this canvas.**
    ///
    /// `floorChrome` is a full-height `VStack` laid on top of the drawing —
    /// undo/redo and the floor/2D steppers at the top, the action bar and
    /// its caption at the bottom. The canvas underneath is the whole
    /// screen, so a plan fitted to it with only `inset` to spare runs its
    /// top and bottom edges UNDER that chrome. The owner, on build 214:
    /// *"it zoomed in too much whenever you open it by default. It needs to
    /// be zoomed out enough to display the entire floor plan."* It was not
    /// really zoom — the fit was right for the canvas and wrong for the
    /// visible part of it.
    ///
    /// Kept separate from `inset` because they are different facts: `inset`
    /// is the margin the drawing wants, these are the strips it may not use.
    /// `StoreyViewport.chromeTop`/`chromeBottom` on `FloorCanvasView` are
    /// where the numbers live, next to the chrome that causes them.
    var chromeTop: CGFloat = 0
    var chromeBottom: CGFloat = 0
    /// The storey's own persisted turn, radians, about `pivot` — the
    /// literal "turn at draw time" this type exists to make possible.
    /// Nothing upstream of `point`/`model` is ever rotated: `StoreyLayout`,
    /// `StoreyPacking`, every hit-test and collision function all keep
    /// reading true, unrotated floor metres. Only where floor space meets
    /// the screen learns about the angle. See migration 0043 and
    /// `FloorCanvasView.commitTurn()`.
    var angle: Double = 0
    /// What `angle` rotates about — the storey's own centre
    /// (`StoreyLayout.wholeFloorBounds`'s centre), NOT `bounds`, which is
    /// the camera's current framing and moves as it zooms into a room.
    var pivot: CGPoint = .zero

    /// The drawable strip: the canvas less its margins and less whatever
    /// the floating chrome covers. Everything else here is arithmetic on
    /// this, so the fit and the centring cannot disagree about it.
    ///
    /// Not private: `turnFitScale` refits the drawing DURING a turn and has
    /// to shrink it against the same rectangle, and the live turn is
    /// anchored on this box's centre rather than the canvas's. A second
    /// hand-rolled copy of this arithmetic is exactly how the plan came to
    /// shrink into a corner the first time chrome was accounted for.
    var free: CGRect {
        CGRect(
            x: inset, y: inset + chromeTop,
            width: max(1, canvasSize.width - inset * 2),
            height: max(1, canvasSize.height - inset * 2 - chromeTop - chromeBottom))
    }

    var scale: CGFloat {
        guard bounds.width > 0.05, bounds.height > 0.05, canvasSize.width > 0, canvasSize.height > 0
        else { return 1 }
        return min(free.width / bounds.width, free.height / bounds.height)
    }

    /// Where floor-space (0, 0) lands on screen BEFORE rotation — the pure
    /// scale-and-translate half of `point`/`model`. Exposed (not just
    /// internal to those two) so `EditorChrome.drawGrid` can apply the exact
    /// same affine-then-rotate transform the grid dots draw through, rather
    /// than a second hand-rolled copy of it.
    var origin: CGPoint {
        let s = scale
        let box = free
        return CGPoint(
            x: box.minX + (box.width - bounds.width * s) / 2 - bounds.minX * s,
            y: box.minY + (box.height - bounds.height * s) / 2 - bounds.minY * s)
    }

    func point(_ floorPoint: CGPoint) -> CGPoint {
        let rotated = angle == 0 ? floorPoint : StoreyArranging.rotate([floorPoint], by: angle, about: pivot)[0]
        let o = origin
        let s = scale
        return CGPoint(x: rotated.x * s + o.x, y: rotated.y * s + o.y)
    }

    /// **A screen DELTA in floor metres.** The linear half of `model(_:)`
    /// with its translation left out, because a drag is a vector and not a
    /// point — but the ROTATION still has to come off it.
    ///
    /// Dividing a drag by `scale` and stopping there was right while the
    /// storey was always drawn upright. Once it can be turned, the plan's
    /// axes are not the screen's: at 90° a drag up moves a room sideways,
    /// and at 180° every direction is reversed. The owner, with the floor
    /// saved at -178.6°: *"everything got inverted. I go up, it goes down,
    /// I go left, it goes right."* Exactly 180°, exactly inverted.
    func modelVector(_ delta: CGSize) -> CGSize {
        let s = scale
        guard s > 0 else { return .zero }
        let v = CGPoint(x: delta.width / s, y: delta.height / s)
        guard angle != 0 else { return CGSize(width: v.x, height: v.y) }
        // About the origin: a vector has no anchor to turn around.
        let r = StoreyArranging.rotate([v], by: -angle, about: .zero)[0]
        return CGSize(width: r.x, height: r.y)
    }

    /// Screen back to floor metres — what a drag or a tap needs.
    func model(_ screenPoint: CGPoint) -> CGPoint {
        let o = origin
        let s = scale
        let floor = CGPoint(x: (screenPoint.x - o.x) / s, y: (screenPoint.y - o.y) / s)
        return angle == 0 ? floor : StoreyArranging.rotate([floor], by: -angle, about: pivot)[0]
    }
}

/// Lets `withAnimation` genuinely interpolate `StoreyViewport.bounds` frame
/// by frame. A `Canvas`'s own content closure is not `Animatable` — SwiftUI
/// only interpolates values read through a type that conforms to it, which
/// is the entire reason build 102's fade-based transition still looked like
/// a jump between two unrelated scales rather than one zoom. `CGPoint` and
/// `CGSize` already conform on their own, so `AnimatablePair` of the two is
/// enough; nothing here has to decompose down to raw `CGFloat`s by hand.
struct AnimatedStoreyViewport<Content: View>: View, Animatable {
    var bounds: CGRect
    /// 0 at floor depth, 1 focused on one room — carried in the SAME
    /// animatable data as `bounds` so both interpolate on the SAME frame.
    /// Without that agreement, the base layer's own fade (driven by this)
    /// and the viewport's own zoom (driven by `bounds`) could each be a
    /// FRAME or two out of step with the other under real animation
    /// timing, which is exactly the kind of seam the whole point of this
    /// type is to not have.
    var progress: CGFloat
    let canvasSize: CGSize
    var inset: CGFloat = 28
    /// Strips the floating chrome covers — see `StoreyViewport.chromeTop`.
    var chromeTop: CGFloat = 0
    var chromeBottom: CGFloat = 0
    /// The storey's persisted turn and the point it turns about — not part
    /// of `animatableData`. A saved angle changes on `load()`, not mid
    /// gesture the way `bounds`/`progress` do, so it needs no interpolation.
    var angle: Double = 0
    var pivot: CGPoint = .zero
    @ViewBuilder let content: (StoreyViewport, CGFloat) -> Content

    /// Four raw `CGFloat`s for `bounds`, paired with `progress` — none of
    /// `CGRect`/`CGPoint`/`CGSize` conform to `VectorArithmetic` on their
    /// own, only the primitive numeric types (and `AnimatablePair` of
    /// them) do.
    var animatableData: AnimatablePair<
        AnimatablePair<CGFloat, AnimatablePair<CGFloat, AnimatablePair<CGFloat, CGFloat>>>, CGFloat
    > {
        get {
            AnimatablePair(
                AnimatablePair(
                    bounds.origin.x,
                    AnimatablePair(bounds.origin.y, AnimatablePair(bounds.width, bounds.height))),
                progress)
        }
        set {
            let b = newValue.first
            bounds = CGRect(x: b.first, y: b.second.first, width: b.second.second.first, height: b.second.second.second)
            progress = newValue.second
        }
    }

    var body: some View {
        content(
            StoreyViewport(
                bounds: bounds, canvasSize: canvasSize, inset: inset,
                chromeTop: chromeTop, chromeBottom: chromeBottom,
                angle: angle, pivot: pivot),
            progress)
    }
}

/// A room's outline in FLOOR space — every room on a storey has one,
/// whether it is the one being edited or a sibling drawn quietly around it.
/// `origin` is where this room's own LOCAL polygon space (the space
/// `corners`, `PlanEditing` and the save API all still use unchanged) sits
/// within the floor; drawing or hit-testing a local point in floor space is
/// always `origin + point`, never anything fancier.
struct StoreyRoom: Identifiable {
    let room: RoomScan
    let plan: FloorPlanGeometry.Plan
    var origin: CGPoint

    var id: String { room.id }

    /// This room's own extent, already shifted into floor space — the
    /// target `bounds` animates TO when this room becomes focused, and
    /// FROM when it stops being.
    var floorBounds: CGRect {
        CGRect(
            x: origin.x, y: origin.y, width: max(plan.width, 0.1), height: max(plan.height, 0.1))
    }
}

/// **The walls of a storey drawn as a building**, not as one outline per room.
///
/// A room's outline is the INSIDE face of its walls — that is what a scan
/// measures and what every figure on the estimate is taken from. So the wall
/// is OUTSIDE the outline, and what kind of wall it is depends on what is on
/// the other side:
///
/// - **another room, one partition away** — a partition: one band filling
///   the gap between the two rooms. Before this, each room centred its own
///   band on its own outline, so the partition between two rooms drawn a
///   wall apart printed twice, and a door in it was cut through only one of
///   the two bands and stayed blocked by the other;
/// - **nothing** — the outside of the house: an exterior wall, thicker, the
///   way the owner's own reference plan draws it;
/// - **another room's edge, exactly** — the two rooms share the line. That is
///   how rooms pushed together on the storey sit, so the old centred band is
///   kept for it rather than changing how every arranged plan looks.
///
/// Worked out once per layout, per stretch of edge — an edge can be half
/// against a bedroom and half outside — and kept in each room's OWN metres,
/// so a room picked up and dragged carries its walls with it.
enum StoreyWalls {
    enum Kind { case shared, partition, exterior }

    /// One stretch of one room's edge with one kind of wall behind it.
    struct Run: Equatable {
        /// Along the room's own edge, room metres.
        let a: CGPoint
        let b: CGPoint
        /// Unit normal pointing out of the room.
        let out: CGPoint
        let kind: Kind
        /// The wall's two faces, metres out from the edge: `0…t` for a wall
        /// beside the room, `-t/2…t/2` for one centred on a shared line.
        let near: Double
        let far: Double
        /// How far the band runs on past `a` and `b`: a wall's own thickness
        /// at a convex corner, so the outside corner is solid, else nothing.
        let pastA: Double
        let pastB: Double

        /// The band as four points, room metres.
        var band: [CGPoint] {
            let length = hypot(b.x - a.x, b.y - a.y)
            guard length > 1e-9 else { return [] }
            let u = CGPoint(x: (b.x - a.x) / length, y: (b.y - a.y) / length)
            let start = CGPoint(x: a.x - u.x * pastA, y: a.y - u.y * pastA)
            let end = CGPoint(x: b.x + u.x * pastB, y: b.y + u.y * pastB)
            return [
                CGPoint(x: start.x + out.x * near, y: start.y + out.y * near),
                CGPoint(x: end.x + out.x * near, y: end.y + out.y * near),
                CGPoint(x: end.x + out.x * far, y: end.y + out.y * far),
                CGPoint(x: start.x + out.x * far, y: start.y + out.y * far),
            ]
        }
    }

    /// What is behind a point on a room's edge, looking out along `out`.
    static func kind(
        at point: CGPoint, out: CGPoint, others: [[CGPoint]], interior: Double
    ) -> Kind {
        func behind(_ distance: Double) -> Bool {
            let probe = CGPoint(x: point.x + out.x * distance, y: point.y + out.y * distance)
            return others.contains { DrawSnapping.contains($0, probe) }
        }
        if behind(0.02) { return .shared }
        if behind(interior + 0.05) { return .partition }
        return .exterior
    }

    /// The faces of the wall a point on an edge sits in — where a door's
    /// jambs and leaf are drawn from.
    static func faces(
        at point: CGPoint, out: CGPoint, others: [[CGPoint]],
        interior: Double, exterior: Double
    ) -> (near: Double, far: Double) {
        switch kind(at: point, out: out, others: others, interior: interior) {
        case .shared: return (-interior / 2, interior / 2)
        case .partition: return (0, interior)
        case .exterior: return (0, exterior)
        }
    }

    /// Every run of wall around room `index`. `polygons` are every room on
    /// the storey in FLOOR metres, open (no repeated closing point); the runs
    /// come back in the room's own metres, `origin` being where its own
    /// metres sit on the floor.
    static func runs(
        of index: Int, polygons: [[CGPoint]], origin: CGPoint,
        interior: Double, exterior: Double, outdoor: Bool = false, step: Double = 0.05
    ) -> [Run] {
        guard polygons.indices.contains(index) else { return [] }
        let polygon = polygons[index]
        let count = polygon.count
        guard count >= 3 else { return [] }
        let others = polygons.enumerated().filter { $0.offset != index && $0.element.count >= 3 }
            .map(\.element)

        func thickness(_ kind: Kind) -> (Double, Double) {
            switch kind {
            case .shared: return (-interior / 2, interior / 2)
            case .partition: return (0, interior)
            // A porch, balcony or terrace has no wall of its own on the
            // outside — an edge, a railing — and the owner's reference plan
            // draws exactly that: a thin line, where a band would read as a
            // room built out of brick.
            case .exterior: return (0, outdoor ? Self.outdoorEdge : exterior)
            }
        }
        func local(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x - origin.x, y: p.y - origin.y) }

        var runs: [Run] = []
        for i in 0..<count {
            let a = polygon[i]
            let b = polygon[(i + 1) % count]
            let length = hypot(b.x - a.x, b.y - a.y)
            guard length > 1e-6 else { continue }
            let out = DrawSnapping.outwardNormal(polygon, i)
            let u = CGPoint(x: (b.x - a.x) / length, y: (b.y - a.y) / length)

            // Is the corner at each end convex — does the outside wrap round it?
            func convex(at corner: CGPoint, _ otherOut: CGPoint) -> Bool {
                let probe = CGPoint(
                    x: corner.x + (out.x + otherOut.x) * 0.01,
                    y: corner.y + (out.y + otherOut.y) * 0.01)
                return !DrawSnapping.contains(polygon, probe)
            }
            let convexA = convex(at: a, DrawSnapping.outwardNormal(polygon, (i + count - 1) % count))
            let convexB = convex(at: b, DrawSnapping.outwardNormal(polygon, (i + 1) % count))

            // Classify the edge in short steps and merge equal neighbours.
            let pieces = max(1, Int((length / step).rounded(.up)))
            var kinds: [Kind] = []
            for k in 0..<pieces {
                let t = (Double(k) + 0.5) / Double(pieces) * length
                let p = CGPoint(x: a.x + u.x * t, y: a.y + u.y * t)
                kinds.append(kind(at: p, out: out, others: others, interior: interior))
            }
            var start = 0
            while start < pieces {
                var end = start
                while end + 1 < pieces, kinds[end + 1] == kinds[start] { end += 1 }
                let s0 = Double(start) / Double(pieces) * length
                let s1 = Double(end + 1) / Double(pieces) * length
                let (near, far) = thickness(kinds[start])
                runs.append(
                    Run(
                        a: local(CGPoint(x: a.x + u.x * s0, y: a.y + u.y * s0)),
                        b: local(CGPoint(x: a.x + u.x * s1, y: a.y + u.y * s1)),
                        out: out, kind: kinds[start], near: near, far: far,
                        // A line two rooms share is drawn centred and is
                        // not run on: the room it is shared with already
                        // closes the corner, and run on it pokes a stub
                        // into the room beyond.
                        pastA: start == 0 && convexA && kinds[start] != .shared ? far : 0,
                        pastB: end == pieces - 1 && convexB && kinds[start] != .shared ? far : 0))
                start = end + 1
            }
        }
        return runs
    }

    /// How thick the outside edge of a porch, balcony or terrace is drawn.
    static let outdoorEdge = 0.03

    /// The hole an opening makes in whatever wall it is in, both sides of its
    /// edge — so a door in a partition goes through the one band the two
    /// rooms share, whichever room it was drawn in.
    static func hole(_ a: CGPoint, _ b: CGPoint, reach: Double) -> [CGPoint] {
        let length = hypot(b.x - a.x, b.y - a.y)
        guard length > 1e-9 else { return [] }
        let n = CGPoint(x: -(b.y - a.y) / length, y: (b.x - a.x) / length)
        return [
            CGPoint(x: a.x - n.x * reach, y: a.y - n.y * reach),
            CGPoint(x: b.x - n.x * reach, y: b.y - n.y * reach),
            CGPoint(x: b.x + n.x * reach, y: b.y + n.y * reach),
            CGPoint(x: a.x + n.x * reach, y: a.y + n.y * reach),
        ]
    }
}

/// Every room on a storey, placed in floor space — `StoreyPacking.pack`
/// wrapped up with the geometry it packed, and the one whole-floor bounds
/// both depths' animation targets are computed from.
struct StoreyLayout {
    let rooms: [StoreyRoom]

    init(_ scans: [RoomScan]) {
        var pieces: [(id: String, plan: FloorPlanGeometry.Plan, room: RoomScan)] = []
        for room in scans {
            guard let geometry = room.geometry else { continue }
            let plan = FloorPlanGeometry.plan(from: geometry)
            guard !plan.isEmpty else { continue }
            pieces.append((room.id, plan, room))
        }
        let packed = StoreyPacking.pack(
            pieces.map {
                StoreyPacking.Item(
                    id: $0.id, width: $0.plan.width, height: $0.plan.height, planX: $0.room.planX,
                    planY: $0.room.planY)
            })
        let byID = Dictionary(uniqueKeysWithValues: packed.placed.map { ($0.id, $0) })
        rooms = pieces.map { piece in
            let placed = byID[piece.id]
            return StoreyRoom(
                room: piece.room, plan: piece.plan,
                origin: CGPoint(x: placed?.x ?? 0, y: placed?.y ?? 0))
        }
        wholeFloorWidth = packed.width
        wholeFloorHeight = packed.height

        let floorPolygons = rooms.map { room -> [CGPoint] in
            var outline = room.plan.polygon
            if outline.count >= 4, let f = outline.first, let l = outline.last,
                hypot(f.x - l.x, f.y - l.y) < 1e-9
            {
                outline.removeLast()
            }
            return outline.map { CGPoint(x: $0.x + room.origin.x, y: $0.y + room.origin.y) }
        }
        self.floorPolygons = floorPolygons
        var runs: [String: [StoreyWalls.Run]] = [:]
        for (index, room) in rooms.enumerated() {
            runs[room.id] = StoreyWalls.runs(
                of: index, polygons: floorPolygons, origin: room.origin,
                interior: Self.interiorWall, exterior: Self.exteriorWall,
                outdoor: DrawRoomView.outdoorTypes.contains(room.room.roomType ?? ""))
        }
        wallRuns = runs
    }

    /// Every room's outline in floor metres, open — what a wall's kind is
    /// worked out against.
    let floorPolygons: [[CGPoint]]
    /// Each room's walls, room metres — see `StoreyWalls`.
    let wallRuns: [String: [StoreyWalls.Run]]

    /// The stated thicknesses walls are drawn at: a 2×4 partition and a 2×6
    /// exterior wall, `WallThickness.default` — the same figures the
    /// footprint totals and Draw Room's snapping use.
    static let interiorWall = WallThickness.default.interiorM
    static let exteriorWall = WallThickness.default.exteriorM

    private let wholeFloorWidth: Double
    private let wholeFloorHeight: Double

    /// Every room, fit to one sheet — the floor-depth animation target.
    var wholeFloorBounds: CGRect {
        CGRect(x: 0, y: 0, width: max(wholeFloorWidth, 0.1), height: max(wholeFloorHeight, 0.1))
    }

    /// **What is actually DRAWN, which is bigger than the rooms.**
    ///
    /// `wholeFloorBounds` is the rooms' own rectangle, and the drawing
    /// overflows it on every side: the wall band is 114 mm centred on the
    /// polygon edge, and a door's swing arc has a radius of the door's own
    /// width — an outward-swinging door on an exterior wall reaches most of
    /// a metre past the room.
    ///
    /// Framing the rooms' rectangle therefore frames the wrong thing. Upright
    /// it merely clips the arcs. TURNED it is worse and it is what the owner
    /// saw: the overhang swings round as the storey turns while the framing
    /// only ever describes the rectangle inside it, so the drawing slides
    /// within its own frame and reads as turning about an edge rather than
    /// about the middle — *"it doesn't turn in the center… it kind of turns
    /// around the edge of it."*
    ///
    /// Per room rather than one global margin, because the allowance a room
    /// needs is the width of the widest door IN THAT ROOM.
    var drawnBounds: CGRect {
        var box: CGRect?
        for room in rooms {
            let polygon = room.plan.polygon
            guard !polygon.isEmpty else { continue }
            let xs = polygon.map(\.x), ys = polygon.map(\.y)
            guard let minX = xs.min(), let maxX = xs.max(),
                let minY = ys.min(), let maxY = ys.max()
            else { continue }
            // A whole outside wall sits beyond the polygon edge (see
            // `StoreyWalls`); a swing arc reaches its own opening's width
            // beyond it.
            let widest = room.plan.openings
                .map { hypot($0.segment.x2 - $0.segment.x1, $0.segment.y2 - $0.segment.y1) }
                .max() ?? 0
            let margin = Self.exteriorWall + widest
            let here = CGRect(
                x: room.origin.x + minX - margin, y: room.origin.y + minY - margin,
                width: (maxX - minX) + margin * 2, height: (maxY - minY) + margin * 2)
            box = box.map { $0.union(here) } ?? here
        }
        guard let box, box.width > 0.05, box.height > 0.05 else { return wholeFloorBounds }
        return box
    }

    func room(id: String) -> StoreyRoom? { rooms.first { $0.id == id } }

    /// Rooms that touch nothing else on this floor — the ones the FLOOR-WIDE
    /// `Rotate` button is allowed to move.
    ///
    /// **Scope narrowed 19 Aug 2026.** This once governed rotation
    /// everywhere. It no longer does: a room picked up by hand turns whether
    /// or not it touches another, because the owner withdrew the rule
    /// himself — *"Yes. I think I was wrong. The rooms need to turn because
    /// they turn in the magic plan too."* What survives here is the case the
    /// rule was really about: a button that turns rooms nobody selected. Let
    /// that reach attached rooms and it spins the whole floor plan, which is
    /// exactly what he objected to.
    ///
    /// The owner set this rule himself, 18 Aug 2026, asked what Rotate should
    /// do: *"floorplan doesn't turn, separate rooms will, but only when it is
    /// not a part of a floorplan and not attached — let's say create a
    /// separate room, as long as it is not attached to the main floor, it can
    /// turn."* Which is right, and for a reason beyond preference: rooms that
    /// share a wall were positioned against each other, by the multi-room
    /// scan merge or by hand on the web canvas. Spinning one of those in
    /// isolation would tear it off its neighbour and silently invent a
    /// building that does not exist.
    ///
    /// "Attached" is a bounding-box overlap test with a wall's thickness of
    /// slack, so rooms drawn wall-to-wall — the boxes touching but not
    /// overlapping — still count as attached. Deliberately coarse: the cost
    /// of a false ATTACHED is one room that will not spin, which is
    /// recoverable and obvious; the cost of a false DETACHED is a plan
    /// quietly torn apart.
    /// Every room joined to this one, directly or through another — the
    /// whole floor plan it belongs to.
    ///
    /// **The owner, 19 Aug 2026**, after pushing two rooms together:
    /// *"When I connect two rooms together, they are not separate anymore.
    /// They become a part of one floor plan. So I think when I touch on it,
    /// I should see the entire floor plan getting activated."* Which is what
    /// the reference does — its editor frames the whole plan and greys the
    /// rooms you are not in.
    ///
    /// Transitive on purpose: a room touching a room that touches a third is
    /// on the same plan as the third, and framing only the DIRECT neighbours
    /// would cut a floor in half at an arbitrary place. Same coarse
    /// bounding-box test as `detachedRooms`, and for the same reason — the
    /// two must agree about what "touching" means, or a room could be
    /// detached enough to spin and attached enough to be framed with its
    /// neighbours.
    func connectedGroup(of id: String) -> [StoreyRoom] {
        guard rooms.contains(where: { $0.id == id }) else { return [] }
        let slack = 0.15
        var group: Set<String> = [id]
        var growing = true
        while growing {
            growing = false
            for candidate in rooms where !group.contains(candidate.id) {
                let box = candidate.floorBounds.insetBy(dx: -slack, dy: -slack)
                guard rooms.contains(where: { group.contains($0.id) && box.intersects($0.floorBounds) })
                else { continue }
                group.insert(candidate.id)
                growing = true
            }
        }
        return rooms.filter { group.contains($0.id) }
    }

    /// What the whole connected plan occupies — what the camera frames when
    /// one of its rooms is opened. Nil for a room this layout does not hold.
    func groupBounds(of id: String) -> CGRect? {
        let group = connectedGroup(of: id)
        guard let first = group.first else { return nil }
        return group.dropFirst().reduce(first.floorBounds) { $0.union($1.floorBounds) }
    }

    var detachedRooms: [StoreyRoom] {
        guard rooms.count > 1 else { return rooms }
        let slack = 0.15
        return rooms.filter { candidate in
            let a = candidate.floorBounds.insetBy(dx: -slack, dy: -slack)
            return !rooms.contains { other in
                other.id != candidate.id && a.intersects(other.floorBounds)
            }
        }
    }
}

/// Every room on the floor, drawn quietly through the SHARED, animated
/// viewport — the layer that never goes away.
///
/// Adapted from `LevelCanvas`'s own drawing (same grey fill, same band
/// walls, same name+area plate), the difference being that this Canvas
/// takes its scale and origin from the OUTSIDE rather than fitting itself
/// to whatever it is offered. That is the whole trick: `RoomEditorOverlay`
/// reads the SAME `StoreyViewport` on the SAME frame, so a room this layer
/// draws grey and a room the overlay draws white sit on exactly the same
/// pixels while one fades into the other.
///
/// The FOCUSED room fades OUT of this layer as `focusProgress` rises — the
/// overlay is drawing it now, and two drawings of the same room at once is
/// a room that looks wrong long before anyone notices why.
struct StoreyBaseLayer: View {
    let layout: StoreyLayout
    let viewport: StoreyViewport
    var focusedRoomID: String? = nil
    var focusProgress: CGFloat = 0
    var flagged: Set<String> = []
    var spotlight: Set<String> = []
    var grid: Bool = true
    /// Objects standing in the rooms on this floor, keyed by room id.
    ///
    /// The owner, on build 127: *"in the story mode and the thumbnail mode,
    /// I don't see the toilet. I wanna see it."* Right — a floor plan that
    /// shows fixtures inside a room and a bare box outside it is two
    /// drawings of one building. Keyed by room rather than flattened
    /// because an object's coordinates are its own room's, and it is
    /// `StoreyRoom.origin` that puts them on the floor.
    var objects: [String: [RoomObject]] = [:]
    /// Damaged areas in the rooms on this floor, keyed by room id — the
    /// same shape `objects` takes, and for the same reason: an area's
    /// polygon is in its own room's metres, and it is `StoreyRoom.origin`
    /// that puts it on the floor.
    var areas: [String: [AffectedArea]] = [:]
    /// **The storey's live turn, in radians.** Nil when it is not being
    /// turned. The whole layer is rotated by its owner; this is passed in so
    /// the parts that must NOT turn can undo it — see the labels below —
    /// and so the turn's own handle can be drawn.
    var turn: Double? = nil
    /// **Where the storey was before this drag started**, radians — the
    /// saved angle, while `viewport.angle` carries saved + live.
    ///
    /// The reference draws it: a pale grey silhouette of the plan in its
    /// previous position, sitting under the one being turned. It is what
    /// makes the turn legible as a MOVE — without it there is a drawing at
    /// an angle and nothing to say how far it has come.
    var ghostAngle: Double? = nil
    /// The room currently in the air, if any — see `LiftedRoom`.
    var lifted: LiftedRoom? = nil
    /// Lines saying why a lifted room just jumped somewhere.
    var guides: [StoreyArranging.Guide] = []
    /// Aiming a merge: an arrow from each room that could be absorbed,
    /// pointing into the one wearing the target. The reference's own way of
    /// asking WHICH neighbour, and worth copying exactly — a merge destroys
    /// a room, so it should take a second, aimed tap.
    var mergeArrows: [MergeArrow] = []

    struct MergeArrow: Identifiable, Equatable {
        let id: String
        /// Floor metres, both.
        let from: CGPoint
        let to: CGPoint
    }
    let onTapRoom: (RoomScan) -> Void
    /// A tap that hit no room. Nil keeps the old behaviour, where empty
    /// paper does nothing.
    var onTapEmpty: (() -> Void)? = nil

    /// A room being moved or turned by hand, before anything is saved.
    ///
    /// Held by the SCREEN and handed down, not owned here, because the
    /// gestures that drive it have to sit beside the pan and pinch they
    /// compete with. This layer only draws it.
    /// Where the two handles sit, given the lifted room's centre on screen.
    ///
    /// One function, called by both the drawing and the gesture that hit-tests
    /// them — the third time in this codebase that two places drawing the same
    /// thing by two different rules has cost a bug.
    static func handlePoints(centre: CGPoint) -> (move: CGPoint, turn: CGPoint) {
        (move: centre, turn: CGPoint(x: centre.x + 40, y: centre.y - 6))
    }

    struct LiftedRoom: Equatable {
        let id: String
        /// Where it has been dragged to, floor metres, snapping already
        /// applied by `StoreyArranging.snap`.
        var offset: CGSize = .zero
        /// How far it has been twisted, radians, snapping already applied.
        var angle: Double = 0
    }

    var body: some View {
        Canvas { context, canvasSize in
            let ink = Brand.Plan.ink
            let bg = Brand.Plan.paper

            if grid {
                // **The grid does NOT turn, and that is the point.** It was
                // rotated with the floor for one build, on my suggestion and
                // with his agreement — and seeing it, he was clear it is
                // wrong: *"I don't want the canvas to turn. I want the floor
                // plan to turn on the canvas."* He is right, and the grid is
                // what makes the difference legible. A dot lattice turning
                // with the drawing reads as the whole SHEET being spun, and
                // gives the eye nothing to judge the turn against; held
                // still it is the paper the plan turns on.
                EditorChrome.drawGrid(
                    context: context, size: canvasSize,
                    model: (origin: viewport.origin, scale: viewport.scale))
            }

            // **No ghost of the previous position.** The reference shows
            // one and this drew one for exactly one build; the owner, on
            // seeing it: *"when I turn, there is a shadow that stays
            // behind."* Whatever it does on their drawing, on ours it reads
            // as something left behind rather than as a reference mark — so
            // it is gone. `ghostAngle` is kept on this type because the
            // owner may want it back once the turn itself feels right, and
            // reinstating it is then two lines rather than a rediscovery.

            // **Three passes: every floor, then every wall, then everything
            // that sits on a wall.** Drawn room by room, a door in one room
            // was cut out of its own band and then painted straight over by
            // the NEXT room's band along the same wall — so whether a doorway
            // between two rooms showed at all depended on which of the two
            // came later in the list. A door between a bedroom and its
            // hallway is in both rooms' wall: the openings are holes through
            // the walls of the whole storey (`StoreyWalls.hole`), and the
            // walls go down with every hole already in them.
            /// Where a point in a room's own metres is drawn: on the floor,
            /// or — for a room in the air — where the finger has it. The move
            /// and the turn are previewed here and written only when the
            /// gesture ends; one transform for the whole room, so its walls,
            /// its doors and the toilet standing in it travel together.
            func onFloor(_ storeyRoom: StoreyRoom) -> (Double, Double) -> CGPoint {
                let lift = lifted?.id == storeyRoom.id ? lifted : nil
                let pivot = StoreyArranging.centroid(storeyRoom.plan.polygon)
                let spin = (cos(lift?.angle ?? 0), sin(lift?.angle ?? 0))
                let origin = storeyRoom.origin
                return { x, y in
                    guard let lift else { return CGPoint(x: origin.x + x, y: origin.y + y) }
                    let dx = x - pivot.x
                    let dy = y - pivot.y
                    return CGPoint(
                        x: origin.x + pivot.x + dx * spin.0 - dy * spin.1 + lift.offset.width,
                        y: origin.y + pivot.y + dx * spin.1 + dy * spin.0 + lift.offset.height)
                }
            }

            var holes = Path()
            let holeReach = StoreyLayout.exteriorWall + 0.03
            for storeyRoom in layout.rooms {
                let place = onFloor(storeyRoom)
                for opening in storeyRoom.plan.openings {
                    let s = opening.segment
                    let q = StoreyWalls.hole(
                        CGPoint(x: s.x1, y: s.y1), CGPoint(x: s.x2, y: s.y2), reach: holeReach)
                    guard q.count == 4 else { continue }
                    holes.move(to: viewport.point(place(q[0].x, q[0].y)))
                    for p in q.dropFirst() { holes.addLine(to: viewport.point(place(p.x, p.y))) }
                    holes.closeSubpath()
                }
            }

            for pass in 0..<3 {
                for storeyRoom in layout.rooms {
                    let isFocused = storeyRoom.id == focusedRoomID
                    // Fully gone once the overlay has fully arrived — not
                    // before, or the two are visibly two different scales for
                    // the first frames of the animation, the exact seam this
                    // whole layer exists to hide.
                    let opacity = isFocused ? Double(1 - focusProgress) : 1
                    guard opacity > 0.003 else { continue }

                    let plan = storeyRoom.plan
                    let isNew = spotlight.contains(storeyRoom.id)

                    // A room in the air is drawn where the finger has it, not
                    // where it is stored — the move and the turn are previewed
                    // here and written only when the gesture ends. One transform
                    // for the whole room, so its walls, its doors and the toilet
                    // standing in it all travel together; a version that moved
                    // only the outline is a room sliding out from under its own
                    // fixtures.
                    let lift = lifted?.id == storeyRoom.id ? lifted : nil
                    let pivot = StoreyArranging.centroid(plan.polygon)
                    let place = onFloor(storeyRoom)

                    /// A point in the room's own metres, put on the floor.
                    func floorPoint(_ x: Double, _ y: Double) -> CGPoint { place(x, y) }

                    func pt(_ x: Double, _ y: Double) -> CGPoint {
                        viewport.point(floorPoint(x, y))
                    }

                    // Real interior wall, 2×4 partition + drywall — the same
                    // figure `FloorPlanView` uses, so the two never draw a
                    // different thickness for what is the same wall.
                    let wallThicknessM = 0.114
                    let band = max(2, wallThicknessM * viewport.scale)

                    if pass == 0 {
                        if plan.polygon.count >= 3 {
                            var floor = Path()
                            floor.move(to: pt(plan.polygon[0].x, plan.polygon[0].y))
                            for p in plan.polygon.dropFirst() { floor.addLine(to: pt(p.x, p.y)) }
                            floor.closeSubpath()
                            let fill: Color
                            if isNew {
                                fill = Brand.Plan.paper
                            } else if let custom = storeyRoom.room.displayColor {
                                fill = custom.opacity(0.35)
                            } else {
                                fill = Brand.Plan.floorMuted
                            }
                            context.opacity = opacity
                            context.fill(floor, with: .color(fill))
                            if isNew {
                                context.stroke(
                                    floor, with: .color(Brand.blue.opacity(0.55)),
                                    style: StrokeStyle(lineWidth: 1.5))
                            }
                            context.opacity = 1
                        }

                        continue
                    }

                    if pass == 1 {
                        context.opacity = opacity
                        if let runs = layout.wallRuns[storeyRoom.id], !runs.isEmpty {
                            // Each stretch of wall as its own band, outside the
                            // room — see `StoreyWalls`. The corner problem the
                            // closed, mitred outline solved (a notch and a spur
                            // at every junction, the owner's zoomed screenshot)
                            // cannot come back: a band at a convex corner runs
                            // on by its own thickness, so the outside corner is
                            // solid, and at a reflex corner the two bands
                            // already overlap.
                            context.drawLayer { layer in
                                layer.clip(to: holes, options: .inverse)
                                for run in runs {
                                    let q = run.band
                                    guard q.count == 4 else { continue }
                                    var quad = Path()
                                    quad.move(to: pt(q[0].x, q[0].y))
                                    for p in q.dropFirst() { quad.addLine(to: pt(p.x, p.y)) }
                                    quad.closeSubpath()
                                    layer.fill(quad, with: .color(ink))
                                }
                            }
                        } else if plan.polygon.count < 3 {
                            // No closed outline — a scan whose walls never chained.
                            // Falls back to loose segments, which cannot mitre
                            // because they genuinely do not meet. `.round` keeps
                            // the loose ends from reading as deliberate square
                            // corners they are not.
                            var walls = Path()
                            for s in plan.segments {
                                walls.move(to: pt(s.x1, s.y1))
                                walls.addLine(to: pt(s.x2, s.y2))
                            }
                            context.stroke(
                                walls, with: .color(ink),
                                style: StrokeStyle(lineWidth: band, lineCap: .round))
                        }
                        context.opacity = 1
                        continue
                    }

                    context.opacity = opacity

                    // **The damage.** The owner, on build 214: *"there is an
                    // affected area that I don't see here. I wanna see it."*
                    // The thumbnail `LevelCanvas` has drawn these all along and
                    // this screen never did, which is the worse way round — the
                    // card is a glance, THIS is where the work is done, and a
                    // shaded patch is what the estimate's quantities are
                    // measured from. `EditorChrome.drawArea` is the one renderer
                    // the owner asked for ("create one and put it in three
                    // places"); this is the third place, finally using it.
                    //
                    // `surface != "wall"` because a wall area belongs on the
                    // elevation, not lying flat on the floor plan.
                    //
                    // Under the furniture, so a vanity standing in a wet patch
                    // still reads as a vanity.
                    for area in areas[storeyRoom.id] ?? [] where area.surface != "wall" {
                        EditorChrome.drawArea(
                            polygon: area.polygon.map { CGPoint(x: $0.x, y: $0.y) },
                            tone: area.displayColor, context: context,
                            toScreen: { viewport.point(floorPoint($0.x, $0.y)) })
                    }

                    // Objects standing in this room, in the room's OWN metres
                    // shifted onto the floor by its origin — the same figures
                    // the room editor draws, so the storey and the room are one
                    // drawing at two scales rather than two drawings.
                    //
                    // Under the openings, so a door's swing arc stays readable
                    // where it crosses a cabinet run.
                    for object in objects[storeyRoom.id] ?? [] {
                        EditorChrome.drawObject(
                            object
                                .moved(to: floorPoint(object.x, object.y))
                                .rotated(to: object.rotation + (lift?.angle ?? 0) * 180 / .pi),
                            context: context,
                            toScreen: { viewport.point($0) },
                            scale: viewport.scale,
                            selected: false,
                            // No names at storey scale: a room here is a
                            // hundred points wide and the room's own name plate
                            // is already competing for that space. The symbol
                            // is what carries the meaning; the label belongs
                            // where there is room for it.
                            labelled: false,
                            // The storey's turn, so a sofa turns with the room
                            // it stands in rather than staying square to the
                            // screen while the walls go round it.
                            turn: viewport.angle * 180 / .pi)
                    }

                    // Openings: the SYMBOL — a door's leaf and quarter-swing
                    // arc, a window's frame lines — drawn in the hole the walls
                    // were laid with (pass 1). This layer once knocked the gap
                    // out and stopped there, so every door and window on the
                    // storey read as an identical blank notch. The owner, 18
                    // Aug 2026: *"I want to see the door and the opening
                    // direction and the windows, I would like to see window."*
                    // Same conventions `FloorPlanView` draws at room scale
                    // (hinge at the jamb nearer a joint, swing toward the
                    // room's own middle — conventions, not measurements, since
                    // the scan records neither), scaled down and thinned for a
                    // storey sheet, and drawn from the faces of the wall the
                    // opening is actually in: beside the room for a partition
                    // or an outside wall, centred for a line two rooms share.
                    let joints = FloorPlanGeometry.joints(plan.segments)
                    var centreX = plan.width / 2
                    var centreY = plan.height / 2
                    if plan.polygon.count >= 3 {
                        centreX = plan.polygon.reduce(0) { $0 + $1.x } / Double(plan.polygon.count)
                        centreY = plan.polygon.reduce(0) { $0 + $1.y } / Double(plan.polygon.count)
                    }
                    let otherRooms =
                        plan.openings.isEmpty
                        ? []
                        : zip(layout.rooms, layout.floorPolygons)
                            .filter { $0.0.id != storeyRoom.id }.map(\.1)

                    for opening in plan.openings {
                        let seg = opening.segment
                        let w = seg.length
                        guard w > 0.05 else { continue }
                        let ux = (seg.x2 - seg.x1) / w
                        let uy = (seg.y2 - seg.y1) / w
                        let nx = -uy
                        let ny = ux

                        // Below roughly this size the symbol is finer than the
                        // eye separates and only muddies the gap it sits in —
                        // the same level-of-detail rule `FloorPlanView` applies
                        // at its own thumbnail tier.
                        guard w * viewport.scale >= 14 else { continue }

                        let midX = (seg.x1 + seg.x2) / 2
                        let midY = (seg.y1 + seg.y2) / 2
                        let inward: Double =
                            ((centreX - midX) * nx + (centreY - midY) * ny) >= 0 ? 1 : -1
                        // Out of the room, and the wall's two faces along it.
                        let ox = -inward * nx
                        let oy = -inward * ny
                        let (near, far) = StoreyWalls.faces(
                            at: CGPoint(x: storeyRoom.origin.x + midX, y: storeyRoom.origin.y + midY),
                            out: CGPoint(x: ox, y: oy), others: otherRooms,
                            interior: StoreyLayout.interiorWall, exterior: StoreyLayout.exteriorWall)

                        // Jamb caps, so the gap reads as a framed opening
                        // rather than a break in the wall.
                        for (jx, jy) in [(seg.x1, seg.y1), (seg.x2, seg.y2)] {
                            var jamb = Path()
                            jamb.move(to: pt(jx + ox * near, jy + oy * near))
                            jamb.addLine(to: pt(jx + ox * far, jy + oy * far))
                            context.stroke(jamb, with: .color(ink), lineWidth: 0.9)
                        }

                        switch opening.kind {
                        case .window:
                            for face in [near, far] {
                                var frame = Path()
                                frame.move(to: pt(seg.x1 + ox * face, seg.y1 + oy * face))
                                frame.addLine(to: pt(seg.x2 + ox * face, seg.y2 + oy * face))
                                context.stroke(frame, with: .color(ink), lineWidth: 0.8)
                            }

                        case .door where w >= 0.45:
                            func jointDistance(_ x: Double, _ y: Double) -> Double {
                                joints.map { hypot($0.x - x, $0.y - y) }.min() ?? 9
                            }
                            // The authored swing wins where there is one. The
                            // storey has to agree with the room editor about
                            // which way a door opens, or the same door reads two
                            // ways at two zoom levels. A leaf hangs on the face
                            // it swings away from.
                            let swingsIn = opening.swingInward ?? true
                            let face = swingsIn ? near : far
                            let toward: Double = swingsIn ? -1 : 1

                            /// One leaf hinged at `h`, latching at `l`. Extracted
                            /// so a double door can call it twice — drawing one
                            /// leaf for every door regardless of kind is exactly
                            /// what made a double read as a single on the storey
                            /// sheet.
                            func leafAndArc(hx: Double, hy: Double, lx: Double, ly: Double) {
                                let span = hypot(lx - hx, ly - hy)
                                guard span > 0.01 else { return }
                                let H = pt(hx + ox * face, hy + oy * face)
                                let latch = pt(lx + ox * face, ly + oy * face)
                                let tip = pt(
                                    hx + ox * (face + toward * span),
                                    hy + oy * (face + toward * span))

                                var leaf = Path()
                                leaf.move(to: H)
                                leaf.addLine(to: tip)
                                context.stroke(leaf, with: .color(ink), lineWidth: 0.9)

                                let r = hypot(tip.x - H.x, tip.y - H.y)
                                let a0 = Angle(radians: atan2(tip.y - H.y, tip.x - H.x))
                                let a1 = Angle(radians: atan2(latch.y - H.y, latch.x - H.x))
                                var delta = a1.radians - a0.radians
                                while delta > .pi { delta -= 2 * .pi }
                                while delta < -.pi { delta += 2 * .pi }
                                var arc = Path()
                                arc.addArc(
                                    center: H, radius: r, startAngle: a0, endAngle: a1,
                                    clockwise: delta < 0)
                                context.stroke(arc, with: .color(ink.opacity(0.75)), lineWidth: 0.6)
                            }

                            // The SPECIFIC kind decides the symbol. Nil means a
                            // RoomPlan detection, which cannot know — falls back
                            // to the single-leaf convention, which is what this
                            // drew for every door before `detail` existed.
                            switch opening.detail {
                            case .doorDouble:
                                // Two leaves, each hinged at its own jamb,
                                // meeting in the middle — so the pair of arcs
                                // reads as a double at a glance.
                                leafAndArc(hx: seg.x1, hy: seg.y1, lx: midX, ly: midY)
                                leafAndArc(hx: seg.x2, hy: seg.y2, lx: midX, ly: midY)

                            case .doorSliding:
                                // Bypass panels, no swing: two bars just over
                                // half the width, either side of the wall's
                                // middle so their overlap reads.
                                let panel = 0.55
                                let middle = (near + far) / 2
                                let off = (far - near) / 4
                                for (fromX, fromY, sign) in [
                                    (seg.x1, seg.y1, 1.0), (seg.x2, seg.y2, -1.0),
                                ] {
                                    let sx = fromX + ox * (middle - sign * off)
                                    let sy = fromY + oy * (middle - sign * off)
                                    var track = Path()
                                    track.move(to: pt(sx, sy))
                                    track.addLine(
                                        to: pt(sx + sign * ux * w * panel, sy + sign * uy * w * panel))
                                    context.stroke(track, with: .color(ink), lineWidth: 1)
                                }

                            default:
                                let hingeAtStart =
                                    opening.hingeAtStart
                                    ?? (jointDistance(seg.x1, seg.y1)
                                        <= jointDistance(seg.x2, seg.y2))
                                let (hx, hy, lx, ly) =
                                    hingeAtStart
                                    ? (seg.x1, seg.y1, seg.x2, seg.y2)
                                    : (seg.x2, seg.y2, seg.x1, seg.y1)
                                leafAndArc(hx: hx, hy: hy, lx: lx, ly: ly)
                            }

                        default:
                            break
                        }
                    }

                    if flagged.contains(storeyRoom.id), plan.width * viewport.scale >= 40 {
                        let mark = context.resolve(
                            Text(Image(systemName: "exclamationmark.triangle.fill"))
                                .font(.system(size: 11))
                                .foregroundStyle(Color.orange))
                        let corner = pt(0, 0)
                        context.draw(mark, at: CGPoint(x: corner.x + 10, y: corner.y + 10), anchor: .center)
                    }

                    // **Every room is named.** Below 64 points wide the label
                    // used to be dropped, so on a whole house the closet, the
                    // bedrooms, the entry and both bathrooms were unnamed
                    // boxes. The type is sized to the room instead — the rule
                    // the project card's thumbnail already follows — and only
                    // a room too narrow for 8-point type goes without.
                    let plotWidth = plan.width * viewport.scale
                    let nameSize = min(14, max(8, plotWidth * 0.13))
                    if plotWidth >= 34 {
                        let areaSize = nameSize * 0.79
                        let anchor = FloorPlanGeometry.labelAnchor(
                            plan.polygon, width: plan.width, height: plan.height)
                        let centre = pt(anchor.x, anchor.y)
                        let name = context.resolve(
                            Text(storeyRoom.room.name)
                                .font(.system(size: nameSize, weight: .bold))
                                .foregroundStyle(Brand.Plan.label))
                        let sqft = context.resolve(
                            Text(Measure.sqftLabel(storeyRoom.room.floorAreaSqm))
                                .font(.system(size: areaSize, weight: .medium))
                                .foregroundStyle(Brand.Plan.labelSoft))
                        let box = name.measure(in: canvasSize)
                        let sqftBox = sqft.measure(in: canvasSize)
                        let plateWidth = max(box.width, sqftBox.width) + nameSize * 0.7
                        let plateHeight = nameSize + areaSize + nameSize * 0.8
                        context.fill(
                            Path(
                                roundedRect: CGRect(
                                    x: centre.x - plateWidth / 2, y: centre.y - plateHeight / 2,
                                    width: plateWidth, height: plateHeight),
                                cornerRadius: 4),
                            with: .color(bg.opacity(0.8)))
                        // **The writing stays upright while the plan turns.**
                        // The reference does this and it is invisible until it
                        // is missing: at 40° a rotated label is a thing you
                        // tilt your head at, and at 180° it is upside down.
                        // The plate turns with the room — it is part of the
                        // drawing — and only the type is counter-rotated.
                        // **`nil`, and that is the fix, not an omission.** This
                        // counter-rotates the type so a label stays readable
                        // while the plan turns — correct only while something
                        // was rotating the whole layer. The turn goes through
                        // `StoreyViewport` now, which moves where a point LANDS
                        // and never spins the canvas, so drawn text is already
                        // upright. Counter-rotating it here would be the only
                        // thing on the sheet that tilted.
                        Self.drawRoomLabel(
                            context: context, name: name, sqft: sqft, at: centre, turn: nil,
                            spacing: nameSize / 14)
                    }
                    // **The turn's own affordances** — see `drawTurnHandle`.
                    // Extracted rather than written inline: this Canvas closure
                    // is already large enough that adding it defeated the type
                    // checker outright, which is its own argument for the split.
                    if turn != nil {
                        // The storey's own centre. Taken as the centre POINT put
                        // through the viewport, not as a box built from two
                        // corners — two corners stop describing a rectangle the
                        // moment the viewport carries an angle.
                        // `drawnBounds`, the same rectangle the camera frames
                        // and the storey turns about — so the handle sits on the
                        // point the drawing actually pivots on rather than near
                        // it.
                        let floor = layout.drawnBounds
                        Self.drawTurnHandle(
                            context: context,
                            pivot: viewport.point(CGPoint(x: floor.midX, y: floor.midY)),
                            // The pin rides the top-right corner, as the
                            // reference's does, so it travels the same arc the
                            // drawing travels.
                            pin: viewport.point(CGPoint(x: floor.maxX, y: floor.minY)),
                            background: bg)
                    }

                    // The room in the air, ringed. A lifted room that looks
                    // exactly like a resting one leaves no way to tell whether
                    // the next drag will move the room or the sheet.
                    if lift != nil, plan.polygon.count >= 3 {
                        var halo = Path()
                        halo.move(to: pt(plan.polygon[0].x, plan.polygon[0].y))
                        for p in plan.polygon.dropFirst() { halo.addLine(to: pt(p.x, p.y)) }
                        halo.closeSubpath()
                        context.fill(halo, with: .color(Brand.blue.opacity(0.10)))
                        context.stroke(
                            halo, with: .color(Brand.blue),
                            style: StrokeStyle(lineWidth: 2.5, lineJoin: .round))

                        // The two handles the reference draws on a room in this
                        // mode, seen on the owner's own phone 19 Aug 2026: a
                        // four-way move cross, and a curved turn arrow beside
                        // it. Ours to draw, per the standing rule — same idea,
                        // our own symbols.
                        //
                        // The room BODY drags too, which the reference does not
                        // allow. Kept: the handle is the affordance, not the
                        // restriction, and taking the body away would make a
                        // room that is plainly picked up refuse to move.
                        let handles = Self.handlePoints(
                            centre: pt(pivot.x, pivot.y))
                        for (point, symbol) in [
                            (handles.move, "arrow.up.and.down.and.arrow.left.and.right"),
                            (handles.turn, "arrow.clockwise"),
                        ] {
                            Self.drawManipulator(
                                context, at: point, symbol: symbol, background: bg)
                        }
                    }

                    context.opacity = 1
                }
            }

            // The merge target and its arrows, over everything — they are
            // about two rooms at once and belong to neither.
            if let lifted, let room = layout.room(id: lifted.id) {
                let pivot = StoreyArranging.centroid(room.plan.polygon)
                let centre = viewport.point(
                    CGPoint(
                        x: room.origin.x + pivot.x + lifted.offset.width,
                        y: room.origin.y + pivot.y + lifted.offset.height))
                if !mergeArrows.isEmpty {
                    // Rings, ours rather than theirs — same idea, drawn in
                    // the blue this editor already means "selected" by.
                    for radius in [8.0, 14.0, 20.0] {
                        context.stroke(
                            Path(ellipseIn: CGRect(
                                x: centre.x - radius, y: centre.y - radius,
                                width: radius * 2, height: radius * 2)),
                            with: .color(Brand.blue), lineWidth: radius == 14 ? 3 : 2)
                    }
                }
                for arrow in mergeArrows {
                    let from = viewport.point(arrow.from)
                    let span = hypot(centre.x - from.x, centre.y - from.y)
                    guard span > 30 else { continue }
                    let ux = (centre.x - from.x) / span
                    let uy = (centre.y - from.y) / span
                    // Stops short of the target so the rings stay readable.
                    let tip = CGPoint(x: centre.x - ux * 26, y: centre.y - uy * 26)
                    var shaft = Path()
                    shaft.move(to: from)
                    shaft.addLine(to: tip)
                    context.stroke(
                        shaft, with: .color(Brand.snapGuide),
                        style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    var head = Path()
                    head.move(to: tip)
                    head.addLine(to: CGPoint(x: tip.x - ux * 12 - uy * 8, y: tip.y - uy * 12 + ux * 8))
                    head.addLine(to: CGPoint(x: tip.x - ux * 12 + uy * 8, y: tip.y - uy * 12 - ux * 8))
                    head.closeSubpath()
                    context.fill(head, with: .color(Brand.snapGuide))
                }
            }

            // Alignment guides, over everything: they are about two rooms
            // at once and belong to neither, and a guide drawn under a wall
            // band is a guide nobody sees.
            for guide in guides {
                let a: CGPoint
                let b: CGPoint
                switch guide.axis {
                case .vertical:
                    a = viewport.point(CGPoint(x: guide.position, y: guide.from))
                    b = viewport.point(CGPoint(x: guide.position, y: guide.to))
                case .horizontal:
                    a = viewport.point(CGPoint(x: guide.from, y: guide.position))
                    b = viewport.point(CGPoint(x: guide.to, y: guide.position))
                }
                var line = Path()
                line.move(to: a)
                line.addLine(to: b)
                context.stroke(
                    line, with: .color(Brand.blue.opacity(0.9)),
                    style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
            }
        }
        .contentShape(.rect)
        .onTapGesture { location in
            let floorPoint = viewport.model(location)
            if let hit = Self.room(in: layout, at: floorPoint) {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onTapRoom(hit.room)
            } else {
                onTapEmpty?()
            }
        }
    }
}

extension StoreyBaseLayer {
    /// Which room's box a floor-space point falls in.
    ///
    /// Extracted from the tap handler purely for the compiler: written
    /// inline it is four chained comparisons inside a closure inside a
    /// gesture inside a very large view body, and adding the turn's drawing
    /// to that body pushed the whole expression past the type checker's
    /// patience. Behaviour is unchanged.
    static func room(in layout: StoreyLayout, at point: CGPoint) -> StoreyRoom? {
        layout.rooms.first { room in
            let box = room.floorBounds
            return point.x >= box.minX && point.x <= box.maxX
                && point.y >= box.minY && point.y <= box.maxY
        }
    }

    /// **The writing stays upright while the plan turns.**
    ///
    /// The reference does this and it is invisible until it is missing: at
    /// 40° a rotated label is a thing you tilt your head at, and at 180° it
    /// is upside down. The name plate turns with the room — it is part of
    /// the drawing — and only the type is counter-rotated.
    static func drawRoomLabel(
        context: GraphicsContext, name: GraphicsContext.ResolvedText,
        sqft: GraphicsContext.ResolvedText, at centre: CGPoint, turn: Double?,
        spacing: Double = 1
    ) {
        let above = 7 * spacing
        let below = 9 * spacing
        guard let angle = turn, abs(angle) > 0.001 else {
            context.draw(name, at: CGPoint(x: centre.x, y: centre.y - above), anchor: .center)
            context.draw(sqft, at: CGPoint(x: centre.x, y: centre.y + below), anchor: .center)
            return
        }
        context.drawLayer { layer in
            layer.translateBy(x: centre.x, y: centre.y)
            layer.rotate(by: Angle(radians: -angle))
            layer.draw(name, at: CGPoint(x: 0, y: -above), anchor: .center)
            layer.draw(sqft, at: CGPoint(x: 0, y: below), anchor: .center)
        }
    }

    /// **One manipulator, drawn the one way manipulators are drawn here.**
    ///
    /// A white disc carrying a blue glyph — the same mark the lifted-room
    /// handles use above, extracted so the two cannot drift into being two
    /// different affordances for the same idea.
    static func drawManipulator(
        _ context: GraphicsContext, at point: CGPoint, symbol: String, background: Color
    ) {
        context.fill(
            Path(ellipseIn: CGRect(x: point.x - 15, y: point.y - 15, width: 30, height: 30)),
            with: .color(background.opacity(0.9)))
        context.draw(
            context.resolve(
                Text(Image(systemName: symbol))
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(Brand.blue)),
            at: point, anchor: .center)
    }

    /// **The floor's turn affordance, as the reference draws it.**
    ///
    /// Read off the owner's own magicplan frame rather than described from
    /// memory: an **amber pin** sitting on the drawing's corner, a **dashed
    /// grey arc** through it centred on the point the plan turns about, and
    /// a heavy **blue double-headed arrow** at the pin, tangent to the arc,
    /// saying which way the finger goes. Double-headed because a turn goes
    /// both ways and a single head would claim otherwise.
    ///
    /// Two earlier attempts were wrong in opposite directions. The first
    /// drew a dashed ring the full width of the storey with a thick green
    /// sweep and an amber pin — the right vocabulary at the wrong scale,
    /// which he called bad. The second replaced it with the small blue
    /// manipulator from Edit Layout, which is the reference's ROOM rotate
    /// and not its storey rotate at all. This is the storey one.
    static func drawTurnHandle(
        context: GraphicsContext, pivot: CGPoint, pin: CGPoint, background: Color
    ) {
        let radius = hypot(pin.x - pivot.x, pin.y - pivot.y)
        guard radius > 8 else { return }
        let pinAngle = atan2(pin.y - pivot.y, pin.x - pivot.x)

        // The path the corner travels, faint and dashed — the reference
        // shows it well past the pin in both directions, so the arc reads
        // as "this is a circle you are moving along".
        var arc = Path()
        arc.addArc(
            center: pivot, radius: radius,
            startAngle: .radians(pinAngle - 0.85), endAngle: .radians(pinAngle + 0.85),
            clockwise: false)
        context.stroke(
            arc, with: .color(Brand.Plan.dimension.opacity(0.45)),
            style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [5, 5]))

        // The double-headed arrow, tangent at the pin and just outside it.
        let tangent = pinAngle + .pi / 2
        let reach = 30.0
        let a = CGPoint(
            x: pin.x + cos(tangent) * reach + cos(pinAngle) * 14,
            y: pin.y + sin(tangent) * reach + sin(pinAngle) * 14)
        let b = CGPoint(
            x: pin.x - cos(tangent) * reach + cos(pinAngle) * 14,
            y: pin.y - sin(tangent) * reach + sin(pinAngle) * 14)
        let bow = CGPoint(x: pin.x + cos(pinAngle) * 26, y: pin.y + sin(pinAngle) * 26)
        var shaft = Path()
        shaft.move(to: a)
        shaft.addQuadCurve(to: b, control: bow)
        context.stroke(
            shaft, with: .color(Brand.blue),
            style: StrokeStyle(lineWidth: 7, lineCap: .round))
        for (tip, towards) in [(a, tangent), (b, tangent + .pi)] {
            var head = Path()
            let l = 13.0
            head.move(to: CGPoint(x: tip.x + cos(towards) * l, y: tip.y + sin(towards) * l))
            head.addLine(
                to: CGPoint(
                    x: tip.x + cos(towards + 2.5) * l, y: tip.y + sin(towards + 2.5) * l))
            head.addLine(
                to: CGPoint(
                    x: tip.x + cos(towards - 2.5) * l, y: tip.y + sin(towards - 2.5) * l))
            head.closeSubpath()
            context.fill(head, with: .color(Brand.blue))
        }

        // The pin itself — the one warm mark on a cool drawing, so the eye
        // finds it at once.
        let amber = Color(red: 0.98, green: 0.78, blue: 0.20)
        let dot = CGRect(x: pin.x - 11, y: pin.y - 11, width: 22, height: 22)
        context.fill(Path(ellipseIn: dot), with: .color(amber))
        context.stroke(Path(ellipseIn: dot), with: .color(background), lineWidth: 2.5)
    }

}
