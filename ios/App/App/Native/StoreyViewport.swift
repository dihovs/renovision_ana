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
    let onTapRoom: (RoomScan) -> Void

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

                func pt(_ x: Double, _ y: Double) -> CGPoint {
                    viewport.point(CGPoint(x: storeyRoom.origin.x + x, y: storeyRoom.origin.y + y))
                }

                let plan = storeyRoom.plan
                let isNew = spotlight.contains(storeyRoom.id)

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

                // Extended half a thickness at shared joints, same technique
                // as `FloorPlanView`'s own two-pass stroke — `.square` caps
                // alone butt each segment at its own bare endpoint, and at
                // any joint that is not square-on, that leaves either a gap
                // or a notch sticking out past the corner. The owner caught
                // it on a genuinely angled kitchen, 18 Aug 2026: this floor
                // was always drawing rooms small enough that it went
                // unnoticed, not because it was ever fixed.
                //
                // Real interior wall, 2×4 partition + drywall — the same
                // figure `FloorPlanView` uses, so the two never draw a
                // different thickness for what is the same wall.
                let wallThicknessM = 0.114
                let joints = FloorPlanGeometry.joints(plan.segments)
                func nearJoint(_ x: Double, _ y: Double) -> Bool {
                    joints.contains { hypot($0.x - x, $0.y - y) < 0.06 }
                }
                let band = max(2, wallThicknessM * viewport.scale)
                var walls = Path()
                for s in plan.segments {
                    let length = hypot(s.x2 - s.x1, s.y2 - s.y1)
                    guard length > 0 else { continue }
                    let ux = (s.x2 - s.x1) / length
                    let uy = (s.y2 - s.y1) / length
                    let e1 = nearJoint(s.x1, s.y1) ? wallThicknessM / 2 : 0
                    let e2 = nearJoint(s.x2, s.y2) ? wallThicknessM / 2 : 0
                    walls.move(to: pt(s.x1 - ux * e1, s.y1 - uy * e1))
                    walls.addLine(to: pt(s.x2 + ux * e2, s.y2 + uy * e2))
                }
                context.opacity = opacity
                context.stroke(walls, with: .color(ink), style: StrokeStyle(lineWidth: band, lineCap: .square))

                for opening in plan.openings {
                    var cut = Path()
                    cut.move(to: pt(opening.segment.x1, opening.segment.y1))
                    cut.addLine(to: pt(opening.segment.x2, opening.segment.y2))
                    context.stroke(
                        cut, with: .color(bg), style: StrokeStyle(lineWidth: band + 1.5, lineCap: .butt))
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
                context.opacity = 1
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
            }
        }
    }
}
