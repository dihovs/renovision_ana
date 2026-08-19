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

    var scale: CGFloat {
        guard bounds.width > 0.05, bounds.height > 0.05, canvasSize.width > 0, canvasSize.height > 0
        else { return 1 }
        return min(
            (canvasSize.width - inset * 2) / bounds.width,
            (canvasSize.height - inset * 2) / bounds.height)
    }

    /// Where floor-space (0, 0) lands on screen — the two centring terms
    /// (half the leftover width/height) plus pulling `bounds`'s own origin
    /// back to the inset corner, in one pass so `point`/`model` cannot
    /// compute it two different ways and drift.
    private var origin: CGPoint {
        let s = scale
        return CGPoint(
            x: inset + (canvasSize.width - inset * 2 - bounds.width * s) / 2 - bounds.minX * s,
            y: inset + (canvasSize.height - inset * 2 - bounds.height * s) / 2 - bounds.minY * s)
    }

    func point(_ floorPoint: CGPoint) -> CGPoint {
        let o = origin
        let s = scale
        return CGPoint(x: floorPoint.x * s + o.x, y: floorPoint.y * s + o.y)
    }

    /// Screen back to floor metres — what a drag or a tap needs.
    func model(_ screenPoint: CGPoint) -> CGPoint {
        let o = origin
        let s = scale
        return CGPoint(x: (screenPoint.x - o.x) / s, y: (screenPoint.y - o.y) / s)
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
        content(StoreyViewport(bounds: bounds, canvasSize: canvasSize, inset: inset), progress)
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
    /// The room currently in the air, if any — see `LiftedRoom`.
    var lifted: LiftedRoom? = nil
    /// Lines saying why a lifted room just jumped somewhere.
    var guides: [StoreyArranging.Guide] = []
    let onTapRoom: (RoomScan) -> Void
    /// A tap that hit no room. Nil keeps the old behaviour, where empty
    /// paper does nothing.
    var onTapEmpty: (() -> Void)? = nil

    /// A room being moved or turned by hand, before anything is saved.
    ///
    /// Held by the SCREEN and handed down, not owned here, because the
    /// gestures that drive it have to sit beside the pan and pinch they
    /// compete with. This layer only draws it.
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
                EditorChrome.drawGrid(
                    context: context, size: canvasSize,
                    model: (origin: viewport.point(.zero), scale: viewport.scale))
            }

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
                        labelled: false)
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
                        let sideSign: Double =
                            ((centreX - (seg.x1 + seg.x2) / 2) * nx
                                + (centreY - (seg.y1 + seg.y2) / 2) * ny) >= 0 ? 1 : -1

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
                                jointDistance(seg.x1, seg.y1) <= jointDistance(seg.x2, seg.y2)
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
                    context.draw(name, at: CGPoint(x: centre.x, y: centre.y - 7), anchor: .center)
                    context.draw(sqft, at: CGPoint(x: centre.x, y: centre.y + 9), anchor: .center)
                }
                // The room in the air, ringed. A lifted room that looks
                // exactly like a resting one leaves no way to tell whether
                // the next drag will move the room or the sheet.
                if lift != nil, plan.polygon.count >= 3 {
                    var halo = Path()
                    halo.move(to: pt(plan.polygon[0].x, plan.polygon[0].y))
                    for p in plan.polygon.dropFirst() { halo.addLine(to: pt(p.x, p.y)) }
                    halo.closeSubpath()
                    context.stroke(
                        halo, with: .color(Brand.blue),
                        style: StrokeStyle(lineWidth: 2.5, lineJoin: .round))
                }

                context.opacity = 1
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
            if let hit = layout.rooms.first(where: { storeyRoom in
                floorPoint.x >= storeyRoom.origin.x
                    && floorPoint.x <= storeyRoom.origin.x + storeyRoom.plan.width
                    && floorPoint.y >= storeyRoom.origin.y
                    && floorPoint.y <= storeyRoom.origin.y + storeyRoom.plan.height
            }) {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onTapRoom(hit.room)
            } else {
                onTapEmpty?()
            }
        }
    }
}
