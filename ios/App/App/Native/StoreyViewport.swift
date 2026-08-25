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
    }

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
            // Half the wall band sits outside the polygon edge; a swing arc
            // reaches its own opening's width beyond it.
            let widest = room.plan.openings
                .map { hypot($0.segment.x2 - $0.segment.x1, $0.segment.y2 - $0.segment.y1) }
                .max() ?? 0
            let margin = 0.114 / 2 + widest
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
                let spin = (cos(lift?.angle ?? 0), sin(lift?.angle ?? 0))

                /// A point in the room's own metres, put on the floor.
                func floorPoint(_ x: Double, _ y: Double) -> CGPoint {
                    guard let lift else {
                        return CGPoint(x: storeyRoom.origin.x + x, y: storeyRoom.origin.y + y)
                    }
                    let dx = x - pivot.x
                    let dy = y - pivot.y
                    return CGPoint(
                        x: storeyRoom.origin.x + pivot.x + dx * spin.0 - dy * spin.1
                            + lift.offset.width,
                        y: storeyRoom.origin.y + pivot.y + dx * spin.1 + dy * spin.0
                            + lift.offset.height)
                }

                func pt(_ x: Double, _ y: Double) -> CGPoint {
                    viewport.point(floorPoint(x, y))
                }

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

                // Real interior wall, 2×4 partition + drywall — the same
                // figure `FloorPlanView` uses, so the two never draw a
                // different thickness for what is the same wall.
                let wallThicknessM = 0.114
                let band = max(2, wallThicknessM * viewport.scale)
                context.opacity = opacity

                // ONE closed path with a MITRE join, not one subpath per
                // wall segment. Two earlier attempts got this wrong in the
                // same way, and it is worth naming why: a separate
                // `move`/`addLine` per segment means the segments are
                // separate SUBPATHS, and a stroke applies `lineJoin` only
                // WITHIN a subpath — so between two walls there was never
                // any join at all, whatever the caps did. Nudging endpoints
                // outward (build 105) and then changing the cap style
                // (build 106) were both treating a symptom: two disjoint
                // rectangles overlapping near a corner, their own square
                // ends poking out past the true mitre at any angle that is
                // not 90°. The owner's zoomed screenshot showed exactly
                // that — a notch and a spur at the junction.
                //
                // Stroking the room's own closed outline instead lets the
                // renderer mitre each corner properly, by construction, at
                // any angle. No endpoint arithmetic, nothing to tune.
                if plan.polygon.count >= 3 {
                    var outline = Path()
                    outline.move(to: pt(plan.polygon[0].x, plan.polygon[0].y))
                    for p in plan.polygon.dropFirst() { outline.addLine(to: pt(p.x, p.y)) }
                    outline.closeSubpath()
                    context.stroke(
                        outline, with: .color(ink),
                        style: StrokeStyle(lineWidth: band, lineCap: .butt, lineJoin: .miter))
                } else {
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

                // Openings: knock the band out, then draw the SYMBOL — a
                // door's leaf and quarter-swing arc, a window's frame lines.
                // This layer used to knock the gap out and stop there, so
                // every door and window on the storey read as an identical
                // blank notch. The owner, 18 Aug 2026: *"I want to see the
                // door and the opening direction and the windows, I would
                // like to see window."* Same conventions `FloorPlanView`
                // draws at room scale (hinge at the jamb nearer a joint,
                // swing toward the room's own middle — conventions, not
                // measurements, since the scan records neither), scaled
                // down and thinned for a storey sheet.
                let joints = FloorPlanGeometry.joints(plan.segments)
                var centreX = plan.width / 2
                var centreY = plan.height / 2
                if plan.polygon.count >= 3 {
                    centreX = plan.polygon.reduce(0) { $0 + $1.x } / Double(plan.polygon.count)
                    centreY = plan.polygon.reduce(0) { $0 + $1.y } / Double(plan.polygon.count)
                }

                for opening in plan.openings {
                    let seg = opening.segment
                    let w = seg.length
                    guard w > 0.05 else { continue }
                    let ux = (seg.x2 - seg.x1) / w
                    let uy = (seg.y2 - seg.y1) / w
                    let nx = -uy
                    let ny = ux

                    var cut = Path()
                    cut.move(to: pt(seg.x1, seg.y1))
                    cut.addLine(to: pt(seg.x2, seg.y2))
                    context.stroke(
                        cut, with: .color(bg), style: StrokeStyle(lineWidth: band + 1.5, lineCap: .butt))

                    // Below roughly this size the symbol is finer than the
                    // eye separates and only muddies the gap it sits in —
                    // the same level-of-detail rule `FloorPlanView` applies
                    // at its own thumbnail tier.
                    guard w * viewport.scale >= 14 else { continue }

                    // Jamb caps, so the gap reads as a framed opening
                    // rather than a break in the wall.
                    let halfT = wallThicknessM / 2
                    for (jx, jy) in [(seg.x1, seg.y1), (seg.x2, seg.y2)] {
                        var jamb = Path()
                        jamb.move(to: pt(jx - nx * halfT, jy - ny * halfT))
                        jamb.addLine(to: pt(jx + nx * halfT, jy + ny * halfT))
                        context.stroke(jamb, with: .color(ink), lineWidth: 0.9)
                    }

                    switch opening.kind {
                    case .window:
                        for side in [1.0, -1.0] {
                            var frame = Path()
                            frame.move(to: pt(seg.x1 + side * nx * halfT, seg.y1 + side * ny * halfT))
                            frame.addLine(to: pt(seg.x2 + side * nx * halfT, seg.y2 + side * ny * halfT))
                            context.stroke(frame, with: .color(ink), lineWidth: 0.8)
                        }

                    case .door where w >= 0.45:
                        func jointDistance(_ x: Double, _ y: Double) -> Double {
                            joints.map { hypot($0.x - x, $0.y - y) }.min() ?? 9
                        }
                        let inward: Double =
                            ((centreX - (seg.x1 + seg.x2) / 2) * nx
                                + (centreY - (seg.y1 + seg.y2) / 2) * ny) >= 0 ? 1 : -1
                        // The authored swing wins where there is one. The
                        // storey has to agree with the room editor about
                        // which way a door opens, or the same door reads two
                        // ways at two zoom levels.
                        let sideSign = (opening.swingInward ?? true) ? inward : -inward

                        /// One leaf hinged at `h`, latching at `l`, swinging
                        /// into the room. Extracted so a double door can
                        /// call it twice — drawing one leaf for every door
                        /// regardless of kind is exactly what made a double
                        /// read as a single on the storey sheet.
                        func leafAndArc(hx: Double, hy: Double, lx: Double, ly: Double) {
                            let span = hypot(lx - hx, ly - hy)
                            guard span > 0.01 else { return }
                            let H = pt(hx + sideSign * nx * halfT, hy + sideSign * ny * halfT)
                            let latch = pt(lx + sideSign * nx * halfT, ly + sideSign * ny * halfT)
                            let tip = pt(
                                hx + sideSign * nx * (halfT + span),
                                hy + sideSign * ny * (halfT + span))

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
                            let mx = (seg.x1 + seg.x2) / 2
                            let my = (seg.y1 + seg.y2) / 2
                            leafAndArc(hx: seg.x1, hy: seg.y1, lx: mx, ly: my)
                            leafAndArc(hx: seg.x2, hy: seg.y2, lx: mx, ly: my)

                        case .doorSliding:
                            // Bypass panels, no swing: two bars just over
                            // half the width, offset either side of the
                            // centreline so their overlap reads.
                            let panel = 0.55
                            let off = halfT * 0.5
                            for (fromX, fromY, sign) in [
                                (seg.x1, seg.y1, 1.0), (seg.x2, seg.y2, -1.0),
                            ] {
                                let sx = fromX - sign * nx * off
                                let sy = fromY - sign * ny * off
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

                if plan.width * viewport.scale >= 64 {
                    let anchor = FloorPlanGeometry.labelAnchor(
                        plan.polygon, width: plan.width, height: plan.height)
                    let centre = pt(anchor.x, anchor.y)
                    let name = context.resolve(
                        Text(storeyRoom.room.name)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Brand.Plan.label))
                    let sqft = context.resolve(
                        Text(Measure.sqftLabel(storeyRoom.room.floorAreaSqm))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Brand.Plan.labelSoft))
                    let box = name.measure(in: canvasSize)
                    let sqftBox = sqft.measure(in: canvasSize)
                    let plateWidth = max(box.width, sqftBox.width) + 10
                    context.fill(
                        Path(
                            roundedRect: CGRect(
                                x: centre.x - plateWidth / 2, y: centre.y - 18, width: plateWidth,
                                height: 36),
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
                        context: context, name: name, sqft: sqft, at: centre, turn: nil)
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
        sqft: GraphicsContext.ResolvedText, at centre: CGPoint, turn: Double?
    ) {
        guard let angle = turn, abs(angle) > 0.001 else {
            context.draw(name, at: CGPoint(x: centre.x, y: centre.y - 7), anchor: .center)
            context.draw(sqft, at: CGPoint(x: centre.x, y: centre.y + 9), anchor: .center)
            return
        }
        context.drawLayer { layer in
            layer.translateBy(x: centre.x, y: centre.y)
            layer.rotate(by: Angle(radians: -angle))
            layer.draw(name, at: CGPoint(x: 0, y: -7), anchor: .center)
            layer.draw(sqft, at: CGPoint(x: 0, y: 9), anchor: .center)
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
