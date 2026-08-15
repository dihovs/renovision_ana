import SwiftUI

/// Plan metres → canvas points, in ONE place.
///
/// This mapping was written twice: once inside `FloorPlanView`'s Canvas to
/// draw with, and once in `AreaEditor` to position its drag handles — with
/// different insets. The drawing reserved margin for the dimension strings
/// (48pt on the right, 34 on top); the handles assumed a flat 12 all round.
/// So every handle sat down and to the right of the corner it belonged to,
/// and the four of them spread wider than the shape they were meant to
/// grab. A handle that is not on its corner is not a handle.
///
/// Both callers now derive from this, so they cannot disagree again.
struct PlanTransform {
    let scale: CGFloat
    let ox: CGFloat
    let oy: CGFloat
    /// Whether this canvas is big enough to carry dimension strings. Lives
    /// here because it is the same decision that sets the insets — asking it
    /// separately is how the two got out of step in the first place.
    let showDims: Bool

    /// Returns nil for a plan too small to draw, which is the caller's cue
    /// to render nothing rather than divide by a zero scale.
    static func fit(_ plan: FloorPlanGeometry.Plan, in size: CGSize) -> PlanTransform? {
        guard plan.width > 0.1, plan.height > 0.1 else { return nil }

        // Dimensions need margin to live in; a thumbnail-sized canvas drops
        // them entirely (the spec's smallest level), so the insets depend on
        // how much room there is.
        let showDims = size.width >= 240
        let inTop: CGFloat = showDims ? 34 : 10
        let inRight: CGFloat = showDims ? 48 : 10
        let inLeft: CGFloat = 12
        let inBottom: CGFloat = 12

        let scale = min(
            (size.width - inLeft - inRight) / plan.width,
            (size.height - inTop - inBottom) / plan.height)
        guard scale > 0 else { return nil }

        return PlanTransform(
            scale: scale,
            ox: inLeft + (size.width - inLeft - inRight - plan.width * scale) / 2,
            oy: inTop + (size.height - inTop - inBottom - plan.height * scale) / 2,
            showDims: showDims)
    }

    func point(_ x: Double, _ y: Double) -> CGPoint {
        CGPoint(x: x * scale + ox, y: y * scale + oy)
    }

    func point(_ p: CGPoint) -> CGPoint { point(p.x, p.y) }

    /// Canvas points back to plan metres — what a drag needs to write.
    func model(_ p: CGPoint) -> CGPoint {
        CGPoint(x: (p.x - ox) / scale, y: (p.y - oy) / scale)
    }
}

/// A room drawn as an architect drafts one.
///
/// The v2 renderer, from the researched spec: pochéd double-line walls whose
/// corners close square (the two-pass stroke technique), openings knocked out
/// with jamb caps at cut weight, a three-line window symbol, a door with its
/// leaf and quarter swing, tick-terminated dimensions in drafted feet-inches,
/// and the room's name at the pole of inaccessibility. The web renderer and
/// the printed report follow the same constants — one drawing, three places.
struct FloorPlanView: View {
    let plan: FloorPlanGeometry.Plan
    /// Damaged regions over the floor, in the plan's own metres.
    var areas: [(polygon: [CGPoint], colour: Color)] = []
    /// A shape being dragged right now, above everything else.
    var draft: (polygon: [CGPoint], colour: Color)?
    /// Room name + area, drawn on the plan itself at full sizes.
    var label: (name: String, sqft: Int)?

    /// Real interior wall: 2×4 partition + drywall.
    private let T = 0.114
    /// The cut-face line weight, in device points — never scaled by zoom.
    private let cutPt: CGFloat = 1.4

    var body: some View {
        Canvas { context, size in
            guard let transform = PlanTransform.fit(plan, in: size) else { return }
            let scale = transform.scale
            let showDims = transform.showDims

            func pt(_ x: Double, _ y: Double) -> CGPoint { transform.point(x, y) }
            func pt(_ p: CGPoint) -> CGPoint { transform.point(p) }

            let ink = Brand.Plan.ink
            let tPts = T * scale

            // 1. Floor.
            if plan.polygon.count >= 3 {
                var floor = Path()
                floor.move(to: pt(plan.polygon[0]))
                for p in plan.polygon.dropFirst() { floor.addLine(to: pt(p)) }
                floor.closeSubpath()
                context.fill(floor, with: .color(Brand.Plan.floorMuted))
            }

            // 2. Damage, over the floor and under the walls.
            for area in areas where area.polygon.count >= 3 {
                var path = Path()
                path.move(to: pt(area.polygon[0]))
                for p in area.polygon.dropFirst() { path.addLine(to: pt(p)) }
                path.closeSubpath()
                context.fill(path, with: .color(area.colour.opacity(0.28)))
                context.stroke(path, with: .color(area.colour), lineWidth: 1.5)
            }
            if let draft, draft.polygon.count >= 3 {
                var path = Path()
                path.move(to: pt(draft.polygon[0]))
                for p in draft.polygon.dropFirst() { path.addLine(to: pt(p)) }
                path.closeSubpath()
                context.fill(path, with: .color(draft.colour.opacity(0.3)))
                context.stroke(path, with: .color(draft.colour), lineWidth: 2)
            }

            // 3. Walls — two passes. Centrelines extended half a thickness at
            // shared joints, so corners close square; the wider ink pass
            // leaves the heavier cut faces either side of the poché.
            let joints = FloorPlanGeometry.joints(plan.segments)
            func nearJoint(_ x: Double, _ y: Double) -> Bool {
                joints.contains { hypot($0.x - x, $0.y - y) < 0.06 }
            }

            var walls = Path()
            for s in plan.segments {
                let L = s.length
                guard L > 0 else { continue }
                let ux = (s.x2 - s.x1) / L
                let uy = (s.y2 - s.y1) / L
                let e1 = nearJoint(s.x1, s.y1) ? T / 2 : 0
                let e2 = nearJoint(s.x2, s.y2) ? T / 2 : 0
                walls.move(to: pt(s.x1 - ux * e1, s.y1 - uy * e1))
                walls.addLine(to: pt(s.x2 + ux * e2, s.y2 + uy * e2))
            }

            // Poché by effective scale: black at plan sizes, 45% grey with
            // black faces once the band is wide enough to read as a cavity.
            let poche: Color = tPts > 12 ? Color(white: 0.55) : ink
            context.stroke(
                walls, with: .color(ink),
                style: StrokeStyle(lineWidth: max(2, tPts + 2 * cutPt), lineCap: .butt))
            context.stroke(
                walls, with: .color(poche),
                style: StrokeStyle(lineWidth: max(1.5, tPts), lineCap: .butt))

            // 4. Openings: knock the band out, cap the jambs, then the symbol.
            let bg = Brand.Plan.paper
            for opening in plan.openings {
                let s = opening.segment
                let w = s.length
                guard w > 0.05 else { continue }
                let ux = (s.x2 - s.x1) / w
                let uy = (s.y2 - s.y1) / w
                let nx = -uy
                let ny = ux

                var cut = Path()
                cut.move(to: pt(s.x1, s.y1))
                cut.addLine(to: pt(s.x2, s.y2))
                context.stroke(
                    cut, with: .color(bg),
                    style: StrokeStyle(lineWidth: max(2, tPts + 2 * cutPt) + 2, lineCap: .butt))

                guard showDims || size.width >= 150 else { continue }

                // Jamb caps — the jambs are cut by the plan plane and carry
                // full cut weight.
                for (jx, jy) in [(s.x1, s.y1), (s.x2, s.y2)] {
                    var jamb = Path()
                    jamb.move(to: pt(jx - nx * T / 2, jy - ny * T / 2))
                    jamb.addLine(to: pt(jx + nx * T / 2, jy + ny * T / 2))
                    context.stroke(jamb, with: .color(ink), lineWidth: cutPt)
                }

                switch opening.kind {
                case .window:
                    for side in [1.0, -1.0] {
                        var frame = Path()
                        frame.move(to: pt(s.x1 + side * nx * T / 2, s.y1 + side * ny * T / 2))
                        frame.addLine(to: pt(s.x2 + side * nx * T / 2, s.y2 + side * ny * T / 2))
                        context.stroke(frame, with: .color(ink), lineWidth: 1)
                    }
                    // Glazing on the centreline — suppressed when the cavity
                    // is too narrow to hold three distinct lines.
                    if tPts >= 4 {
                        var glass = Path()
                        glass.move(to: pt(s.x1, s.y1))
                        glass.addLine(to: pt(s.x2, s.y2))
                        context.stroke(glass, with: .color(ink), lineWidth: 0.7)
                    }

                case .door where w >= 0.45:
                    // Hinge at the jamb nearer a wall joint; swing toward the
                    // room's interior. Conventions, not measurements — the
                    // scan records neither.
                    func jointDistance(_ x: Double, _ y: Double) -> Double {
                        joints.map { hypot($0.x - x, $0.y - y) }.min() ?? 9
                    }
                    let hingeAtStart = jointDistance(s.x1, s.y1) <= jointDistance(s.x2, s.y2)
                    let (hx, hy, lx, ly) = hingeAtStart
                        ? (s.x1, s.y1, s.x2, s.y2) : (s.x2, s.y2, s.x1, s.y1)

                    var cx = plan.width / 2
                    var cy = plan.height / 2
                    if plan.polygon.count >= 3 {
                        cx = plan.polygon.reduce(0) { $0 + $1.x } / Double(plan.polygon.count)
                        cy = plan.polygon.reduce(0) { $0 + $1.y } / Double(plan.polygon.count)
                    }
                    let sideSign: Double = ((cx - hx) * nx + (cy - hy) * ny) >= 0 ? 1 : -1

                    let H = pt(hx + sideSign * nx * T / 2, hy + sideSign * ny * T / 2)
                    let latch = pt(lx + sideSign * nx * T / 2, ly + sideSign * ny * T / 2)
                    let tip = pt(
                        hx + sideSign * nx * (T / 2 + w) - 0,
                        hy + sideSign * ny * (T / 2 + w))

                    var leaf = Path()
                    leaf.move(to: H)
                    leaf.addLine(to: tip)
                    context.stroke(leaf, with: .color(ink), lineWidth: 1)

                    let r = hypot(tip.x - H.x, tip.y - H.y)
                    let a0 = Angle(radians: atan2(tip.y - H.y, tip.x - H.x))
                    let a1 = Angle(radians: atan2(latch.y - H.y, latch.x - H.x))
                    // Sweep the quarter that goes tip → latch the short way.
                    var delta = a1.radians - a0.radians
                    while delta > .pi { delta -= 2 * .pi }
                    while delta < -.pi { delta += 2 * .pi }
                    var arc = Path()
                    arc.addArc(
                        center: H, radius: r, startAngle: a0,
                        endAngle: a1, clockwise: delta < 0)
                    context.stroke(arc, with: .color(ink), lineWidth: 0.7)

                default:
                    break
                }
            }

            // 5. Dimensions — the overall spans, top and right, terminated
            // with drafting ticks rather than arrowheads.
            if showDims {
                let grey = Color(hex: 0x6B6B70)
                let off: CGFloat = 20
                let overrun: CGFloat = 4
                let gap: CGFloat = 3
                let tick: CGFloat = 3.5

                func dimension(
                    from a: CGPoint, to b: CGPoint, outward: CGVector, text: String,
                    rotated: Bool
                ) {
                    let da = CGPoint(x: a.x + outward.dx * off, y: a.y + outward.dy * off)
                    let db = CGPoint(x: b.x + outward.dx * off, y: b.y + outward.dy * off)

                    var witness = Path()
                    witness.move(to: CGPoint(x: a.x + outward.dx * gap, y: a.y + outward.dy * gap))
                    witness.addLine(
                        to: CGPoint(
                            x: da.x + outward.dx * overrun, y: da.y + outward.dy * overrun))
                    witness.move(to: CGPoint(x: b.x + outward.dx * gap, y: b.y + outward.dy * gap))
                    witness.addLine(
                        to: CGPoint(
                            x: db.x + outward.dx * overrun, y: db.y + outward.dy * overrun))
                    context.stroke(witness, with: .color(grey), lineWidth: 0.6)

                    var line = Path()
                    line.move(to: da)
                    line.addLine(to: db)
                    context.stroke(line, with: .color(grey), lineWidth: 0.7)

                    for p in [da, db] {
                        var t = Path()
                        t.move(to: CGPoint(x: p.x - tick, y: p.y + tick))
                        t.addLine(to: CGPoint(x: p.x + tick, y: p.y - tick))
                        context.stroke(t, with: .color(grey), lineWidth: 1.1)
                    }

                    let mid = CGPoint(
                        x: (da.x + db.x) / 2 + outward.dx * 9,
                        y: (da.y + db.y) / 2 + outward.dy * 9)
                    let resolved = context.resolve(
                        Text(text).font(.system(size: 9, weight: .semibold)).foregroundStyle(grey))
                    if rotated {
                        context.drawLayer { layer in
                            layer.translateBy(x: mid.x, y: mid.y)
                            layer.rotate(by: .degrees(-90))
                            layer.draw(resolved, at: .zero, anchor: .center)
                        }
                    } else {
                        context.draw(resolved, at: mid, anchor: .center)
                    }
                }

                dimension(
                    from: pt(0, 0), to: pt(plan.width, 0), outward: CGVector(dx: 0, dy: -1),
                    text: UnitSettings.shared.format.format(plan.width), rotated: false)
                dimension(
                    from: pt(plan.width, 0), to: pt(plan.width, plan.height),
                    outward: CGVector(dx: 1, dy: 0),
                    text: UnitSettings.shared.format.format(plan.height), rotated: true)
            }

            // 6. The room's own label, deepest inside its outline.
            if let label, showDims, plan.polygon.count >= 3 {
                let anchor = FloorPlanGeometry.labelAnchor(
                    plan.polygon, width: plan.width, height: plan.height)
                let at = pt(anchor)
                let name = context.resolve(
                    Text(label.name.uppercased())
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Brand.Plan.label))
                let area = context.resolve(
                    Text("\(label.sqft) SQFT")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(Brand.Plan.labelSoft))
                let nameSize = name.measure(in: size)
                let pad: CGFloat = 4
                let box = CGRect(
                    x: at.x - nameSize.width / 2 - pad, y: at.y - 11 - pad,
                    width: nameSize.width + pad * 2, height: 26 + pad * 2)
                context.fill(
                    Path(roundedRect: box, cornerRadius: 3), with: .color(bg.opacity(0.82)))
                context.draw(name, at: CGPoint(x: at.x, y: at.y - 3), anchor: .center)
                context.draw(area, at: CGPoint(x: at.x, y: at.y + 11), anchor: .center)
            }
        }
        .aspectRatio(aspect, contentMode: .fit)
    }

    private var aspect: CGFloat {
        guard plan.width > 0, plan.height > 0 else { return 1 }
        return CGFloat(plan.width / plan.height)
    }
}

/// Mark the damaged part of a room, on its plan.
///
/// REDUCTIVE, like the web editor and like the tools an estimator already
/// uses: a new area opens covering the whole floor and gets pulled in to the
/// wet part. Drawing from nothing would mean tracing a shape freehand on a
/// phone while standing in a basement, which is slower and less accurate than
/// dragging four corners.
struct AreaEditor: View {
    let plan: FloorPlanGeometry.Plan
    let existing: [(polygon: [CGPoint], colour: Color)]
    let onSave: (String, String, [CGPoint]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var corners: [CGPoint] = []
    /// The point being adjusted. Selection is a STEP, not a side effect of
    /// touching the canvas: the reference's own caption is "Tap to adjust
    /// points", and a point you have chosen is one your thumb can then drag
    /// without having to stay on a 26pt target it cannot see under itself.
    @State private var selected: Int?
    @State private var history: [[CGPoint]] = []
    @State private var future: [[CGPoint]] = []
    @State private var name = "Affected area"
    @State private var cause: DamageCause = .water
    @State private var saving = false
    @State private var confirmingDiscard = false

    private var colour: Color { cause.color }

    private var areaSqm: Double { FloorPlanGeometry.polygonArea(corners) }

    /// Nothing has been pulled in yet — the shape is still the whole room it
    /// opened as. Used to keep Save honest rather than to block a gesture.
    private var isDirty: Bool { !history.isEmpty }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(spacing: Brand.Space.base) {
                    GeometryReader { proxy in
                        let transform = PlanTransform.fit(plan, in: proxy.size)

                        ZStack(alignment: .topLeading) {
                            FloorPlanView(
                                plan: plan, areas: existing,
                                draft: (corners, colour))

                            if let transform {
                                edgeHandles(transform)
                                cornerHandles(transform)
                                liveDimensions(transform)
                            }
                        }
                        // A tap on bare canvas clears the selection, so the
                        // four-way handle and its Delete cannot linger over a
                        // point the operator has moved on from.
                        .contentShape(.rect)
                        .onTapGesture { selected = nil }
                    }
                    .frame(maxHeight: 360)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))

                    VStack(alignment: .leading, spacing: Brand.Space.small) {
                        HStack {
                            TextField("Name", text: $name)
                                .font(.system(size: 16, weight: .semibold))
                            Spacer()
                            Text("\(Int(Measure.squareFeet(areaSqm).rounded())) sq ft")
                                .font(.system(size: 18, weight: .bold))
                                .monospacedDigit()
                                .foregroundStyle(Brand.ink)
                        }

                        DamageCausePicker(cause: $cause)

                        // Delete belongs to the SELECTED point and appears
                        // with it, which is where the reference puts it —
                        // not a permanent control for a target that may not
                        // exist.
                        if let selected, corners.count > 3 {
                            Button(role: .destructive) {
                                push()
                                corners = PlanEditing.removeCorner(corners, index: selected)
                                self.selected = nil
                            } label: {
                                Label("Delete point", systemImage: "minus.circle")
                                    .font(.system(size: 14, weight: .semibold))
                            }
                        }

                        Text(
                            selected == nil
                                ? "Tap to adjust points. Tap a midpoint to add one."
                                : "Drag to move it. Tap the plan to deselect.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .padding(Brand.Space.base)
                    .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))

                    Button(saving ? "Saving…" : "Save area") {
                        saving = true
                        onSave(name.trimmed, cause.rawValue, corners)
                    }
                    .buttonStyle(PrimaryButtonStyle(enabled: !saving && areaSqm > 0))
                    .disabled(saving || areaSqm <= 0)
                }
                .padding(Brand.Space.base)
            }
            .navigationTitle("Affected area")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        if isDirty { confirmingDiscard = true } else { dismiss() }
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        undo()
                    } label: { Image(systemName: "arrow.uturn.backward") }
                        .disabled(history.isEmpty)
                    Button {
                        redo()
                    } label: { Image(systemName: "arrow.uturn.forward") }
                        .disabled(future.isEmpty)
                }
            }
            .confirmationDialog(
                "Discard changes?", isPresented: $confirmingDiscard, titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep editing", role: .cancel) {}
            }
            .onAppear(perform: seed)
        }
    }

    // MARK: - Handles

    /// A hollow dot at each edge's midpoint — tap it to put a real corner
    /// there. This is how an L or a T gets made out of the rectangle the
    /// shape opens as.
    private func edgeHandles(_ transform: PlanTransform) -> some View {
        ForEach(corners.indices, id: \.self) { index in
            let (a, b) = PlanEditing.edgeCorners(index, count: corners.count)
            let mid = CGPoint(
                x: (corners[a].x + corners[b].x) / 2, y: (corners[a].y + corners[b].y) / 2)
            let at = transform.point(mid)
            Circle()
                .fill(Brand.Plan.paper)
                .overlay(Circle().strokeBorder(colour.opacity(0.7), lineWidth: 1.5))
                .frame(width: 15, height: 15)
                .position(x: at.x, y: at.y)
                .onTapGesture {
                    push()
                    let (next, made) = PlanEditing.addCorner(corners, onEdge: index)
                    corners = next
                    selected = made >= 0 ? made : nil
                }
        }
    }

    /// The corners themselves. An unselected one is a plain dot; the selected
    /// one becomes the reference's red four-way handle, and only it is
    /// draggable — which is what stops a thumb resting on the canvas from
    /// dragging whatever happens to be under it.
    private func cornerHandles(_ transform: PlanTransform) -> some View {
        ForEach(corners.indices, id: \.self) { index in
            let at = transform.point(corners[index])
            let isSelected = selected == index
            ZStack {
                Circle()
                    .fill(isSelected ? Color.red : colour)
                    .overlay(Circle().strokeBorder(.white, lineWidth: 2))
                if isSelected {
                    Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
            .frame(width: isSelected ? 32 : 24, height: isSelected ? 32 : 24)
            .position(x: at.x, y: at.y)
            .onTapGesture { selected = isSelected ? nil : index }
            .gesture(
                isSelected
                    ? DragGesture()
                        .onChanged { value in
                            if dragOrigin == nil { dragOrigin = corners }
                            corners = PlanEditing.moveCorner(
                                corners, index: index, to: transform.model(value.location))
                        }
                        .onEnded { _ in
                            // One history entry per drag, not per frame.
                            if let origin = dragOrigin {
                                history.append(origin)
                                future.removeAll()
                                dragOrigin = nil
                            }
                        }
                    : nil
            )
        }
    }

    /// The two edges either side of the selected point, measured. The
    /// reference shows these while a point is being moved, and they are the
    /// whole reason the gesture is usable: a damaged patch is being matched
    /// to a tape measure, not eyeballed.
    private func liveDimensions(_ transform: PlanTransform) -> some View {
        ForEach(adjoiningEdges, id: \.self) { index in
            let (a, b) = PlanEditing.edgeCorners(index, count: corners.count)
            let mid = CGPoint(
                x: (corners[a].x + corners[b].x) / 2, y: (corners[a].y + corners[b].y) / 2)
            let at = transform.point(mid)
            Text(UnitSettings.shared.format.format(PlanEditing.edgeLength(corners, index)))
                .font(.system(size: 10, weight: .bold).monospacedDigit())
                .foregroundStyle(.white)
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(Color.red.opacity(0.9), in: .capsule)
                .position(x: at.x, y: at.y)
                .allowsHitTesting(false)
        }
    }

    /// The edge before the selected corner and the edge after it.
    private var adjoiningEdges: [Int] {
        guard let selected, corners.count >= 3 else { return [] }
        let before = (selected - 1 + corners.count) % corners.count
        return [before, selected]
    }

    @State private var dragOrigin: [CGPoint]?

    // MARK: - History

    private func push() {
        history.append(corners)
        future.removeAll()
        if history.count > 60 { history.removeFirst() }
    }

    private func undo() {
        guard let previous = history.popLast() else { return }
        future.append(corners)
        corners = previous
        selected = nil
    }

    private func redo() {
        guard let next = future.popLast() else { return }
        history.append(corners)
        corners = next
        selected = nil
    }

    /// Opens covering the room: its outline when the walls closed into one,
    /// otherwise the bounding box, which is still a sane thing to pull in
    /// from when a scan left the room open.
    private func seed() {
        guard corners.isEmpty else { return }
        if plan.polygon.count >= 4 {
            corners = Array(plan.polygon.dropLast())
        } else {
            corners = [
                CGPoint(x: 0, y: 0),
                CGPoint(x: plan.width, y: 0),
                CGPoint(x: plan.width, y: plan.height),
                CGPoint(x: 0, y: plan.height),
            ]
        }
    }
}

/// The cause chips, in `DAMAGE_TYPES` order, each in its own colour.
///
/// One control rather than one per editor: the chips ARE the colour table
/// made visible, and the whole point of collapsing that table into
/// `DamageCause` is that there is no second place for it to drift in. The
/// floor editor and the elevation face both draw this.
struct DamageCausePicker: View {
    @Binding var cause: DamageCause

    var body: some View {
        HStack(spacing: Brand.Space.tight) {
            ForEach(DamageCause.allCases) { option in
                Button {
                    cause = option
                } label: {
                    Text(option.label)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(cause == option ? .white : Brand.inkSoft)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 7)
                        .background(
                            cause == option ? option.color : Brand.surfaceRaised,
                            in: .rect(cornerRadius: Brand.Radius.pill))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// Log one moisture reading.
///
/// Every field optional except that ONE must be filled: instruments differ,
/// and a pin meter that only reads material moisture should not be made to
/// invent a humidity. What is refused is an entirely empty reading, which
/// shows on the drying curve as a gap somebody has to explain.
struct ReadingSheet: View {
    let roomId: String
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var location = ""
    @State private var material = ""
    @State private var mc = ""
    @State private var rh = ""
    @State private var temp = ""
    @State private var saving = false
    @State private var error: String?

    private static let materials = [
        "Drywall", "Subfloor", "Framing / studs", "Concrete", "Insulation", "Hardwood",
    ]

    private var hasAnyReading: Bool {
        [mc, rh, temp].contains { Double($0.trimmed) != nil }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Brand.Space.base) {
                        Field(
                            label: "WHERE", text: $location,
                            placeholder: "North wall, 24in up")

                        VStack(alignment: .leading, spacing: Brand.Space.tight) {
                            Text("MATERIAL")
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundStyle(Brand.inkFaint)
                            LazyVGrid(
                                columns: [GridItem(.adaptive(minimum: 96), spacing: Brand.Space.tight)],
                                alignment: .leading, spacing: Brand.Space.tight
                            ) {
                                ForEach(Self.materials, id: \.self) { option in
                                    Button {
                                        material = material == option ? "" : option
                                    } label: {
                                        Text(option)
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundStyle(material == option ? .white : Brand.inkSoft)
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 8)
                                            .background(
                                                material == option ? Brand.charcoalDark : Brand.surfaceRaised,
                                                in: .rect(cornerRadius: Brand.Radius.pill))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        HStack(spacing: Brand.Space.small) {
                            Field(label: "% MC", text: $mc, placeholder: "—", keyboard: .decimalPad)
                            Field(label: "% RH", text: $rh, placeholder: "—", keyboard: .decimalPad)
                            Field(label: "°C", text: $temp, placeholder: "—", keyboard: .decimalPad)
                        }

                        if let error {
                            Text(error).font(.footnote).foregroundStyle(.red)
                        }

                        Button(saving ? "Saving…" : "Save reading") {
                            Task { await save() }
                        }
                        .buttonStyle(PrimaryButtonStyle(enabled: !saving && hasAnyReading))
                        .disabled(saving || !hasAnyReading)

                        Text("Fill in whatever the instrument gave you. Nothing is assumed — a blank stays blank rather than becoming a zero in the claim file.")
                            .font(.system(size: 11))
                            .foregroundStyle(Brand.inkFaint)
                    }
                    .padding(Brand.Space.base)
                }
            }
            .navigationTitle("Moisture reading")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
        }
    }

    private func save() async {
        saving = true
        error = nil
        do {
            _ = try await API.shared.createReading(
                roomScanId: roomId,
                location: location.trimmed,
                material: material.isEmpty ? nil : material,
                materialPercent: Double(mc.trimmed),
                relativeHumidity: Double(rh.trimmed),
                temperatureC: Double(temp.trimmed))
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}
