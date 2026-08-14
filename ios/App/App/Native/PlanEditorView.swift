import SwiftUI

/// Editing a plan with a finger.
///
/// Built to Docs/Interactive-Plan-Editor-Spec.md. The governing rule, and the
/// one that makes the whole thing safe to use one-handed on a job site:
///
///   **Two fingers navigate. One finger selects. One finger only EDITS what
///   is already selected.**
///
/// A stray thumb can pan and zoom all day without ever moving a wall. Nothing
/// is committed until Save, and the scan's own measurements are never
/// overwritten — an edited room keeps both, so "what did the laser say" is
/// always answerable.
struct PlanEditorView: View {
    let room: RoomScan
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss

    /// Corners of the room being edited. The polygon IS the model; walls are
    /// its edges, re-derived every frame, so there is no state in which a
    /// drag leaves a dangling wall.
    @State private var corners: [CGPoint] = []
    @State private var history: [[CGPoint]] = []
    @State private var future: [[CGPoint]] = []

    @State private var selection: Selection = .none
    @State private var dragStart: [CGPoint]?
    @State private var snapEngaged = false
    @State private var liveLabel: String?
    @State private var typing: TypedLength?
    @State private var saving = false
    @State private var error: String?
    @State private var showDiscard = false

    /// Viewport, in the plan's own metres.
    @State private var zoom: CGFloat = 1
    @State private var pan: CGSize = .zero
    @GestureState private var pinch: CGFloat = 1
    @GestureState private var twoFingerPan: CGSize = .zero

    enum Selection: Equatable {
        case none
        case wall(Int)
        case corner(Int)
    }

    struct TypedLength: Identifiable {
        let edge: Int
        let current: Double
        var id: Int { edge }
    }

    // MARK: - Constants (from the spec's table)

    private let handleHit: CGFloat = 44
    private let handleDot: CGFloat = 13
    private let wallBand: CGFloat = 22
    private let captureRadius: CGFloat = 8

    private var scan: FloorPlanGeometry.Plan? {
        room.geometry.map { FloorPlanGeometry.plan(from: $0) }
    }

    private var isDirty: Bool { !history.isEmpty }

    private var invalid: Bool { PlanEditing.selfIntersects(corners) }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(spacing: 0) {
                    canvas
                    controls
                }
            }
            .navigationTitle(room.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        if isDirty { showDiscard = true } else { dismiss() }
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        undo()
                    } label: {
                        Image(systemName: "arrow.uturn.backward")
                    }
                    .disabled(history.isEmpty)

                    Button {
                        redo()
                    } label: {
                        Image(systemName: "arrow.uturn.forward")
                    }
                    .disabled(future.isEmpty)

                    Button("Save") { Task { await save() } }
                        .fontWeight(.bold)
                        .disabled(saving || invalid || !isDirty)
                }
            }
            .task { load() }
            .sheet(item: $typing) { target in
                LengthSheet(current: target.current) { metres in
                    push()
                    corners = PlanEditing.setEdgeLength(corners, index: target.edge, to: metres)
                    typing = nil
                }
            }
            .confirmationDialog(
                "Discard your changes?", isPresented: $showDiscard, titleVisibility: .visible
            ) {
                Button("Discard", role: .destructive) { dismiss() }
                Button("Keep editing", role: .cancel) {}
            }
        }
    }

    // MARK: - Canvas

    private var canvas: some View {
        GeometryReader { proxy in
            let fit = fitScale(in: proxy.size)
            let scale = fit * zoom * pinch
            let centre = CGPoint(
                x: proxy.size.width / 2 + pan.width + twoFingerPan.width,
                y: proxy.size.height / 2 + pan.height + twoFingerPan.height)

            let toScreen = { (p: CGPoint) in
                self.screenPoint(p, centre: centre, scale: scale)
            }
            let toModel = { (p: CGPoint) in
                self.modelPoint(p, centre: centre, scale: scale)
            }

            ZStack {
                Canvas { context, _ in
                    let pt = toScreen
                    guard corners.count >= 3 else { return }

                    var floor = Path()
                    floor.move(to: pt(corners[0]))
                    for c in corners.dropFirst() { floor.addLine(to: pt(c)) }
                    floor.closeSubpath()
                    context.fill(floor, with: .color(Color(hex: 0xEFEEF4)))

                    // Walls. The selected one is blue and thicker; an invalid
                    // shape goes dashed red — signalled, never blocked, since
                    // a finger often passes through a bad shape on its way to
                    // a good one.
                    for i in corners.indices {
                        let (a, b) = PlanEditing.edgeCorners(i, count: corners.count)
                        var wall = Path()
                        wall.move(to: pt(corners[a]))
                        wall.addLine(to: pt(corners[b]))

                        let isSelected = selection == .wall(i)
                        context.stroke(
                            wall,
                            with: .color(invalid ? .red : (isSelected ? Brand.blue : Color(hex: 0x111111))),
                            style: StrokeStyle(
                                lineWidth: isSelected ? max(6, 0.114 * scale + 4) : max(3, 0.114 * scale),
                                lineCap: .butt,
                                dash: invalid ? [8, 5] : []))
                    }

                    // Corner handles, whenever anything is selected — they
                    // are what makes the shape feel grabbable.
                    if selection != .none {
                        for i in corners.indices {
                            let p = pt(corners[i])
                            let big = selection == .corner(i)
                            let r = (big ? handleDot + 3 : handleDot) / 2
                            context.fill(
                                Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                                with: .color(big ? Brand.blue : .white))
                            context.stroke(
                                Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                                with: .color(Brand.blue), lineWidth: 2)
                        }
                    }

                    // Every wall's length, and a "+" on the selected one to
                    // split it.
                    for i in corners.indices {
                        let (a, b) = PlanEditing.edgeCorners(i, count: corners.count)
                        let mid = CGPoint(
                            x: (pt(corners[a]).x + pt(corners[b]).x) / 2,
                            y: (pt(corners[a]).y + pt(corners[b]).y) / 2)
                        let metres = PlanEditing.edgeLength(corners, i)
                        guard metres > 0.15 else { continue }

                        let selected = selection == .wall(i)
                        let text = context.resolve(
                            Text(FloorPlanGeometry.feetInches(metres))
                                .font(.system(size: 11, weight: selected ? .bold : .regular))
                                .foregroundStyle(selected ? .white : Color(hex: 0x4A4A50)))
                        let size = text.measure(in: proxy.size)
                        let box = CGRect(
                            x: mid.x - size.width / 2 - 6, y: mid.y - 9,
                            width: size.width + 12, height: 18)
                        context.fill(
                            Path(roundedRect: box, cornerRadius: 9),
                            with: .color(selected ? Brand.blue : Color.white.opacity(0.9)))
                        context.draw(text, at: mid, anchor: .center)
                    }
                }

                // The live figure during a drag, well above the finger.
                if let liveLabel {
                    VStack {
                        Text(liveLabel)
                            .font(.system(size: 15, weight: .bold).monospacedDigit())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(Brand.charcoalDark, in: .capsule)
                            .padding(.top, 12)
                        Spacer()
                    }
                }
            }
            .contentShape(.rect)
            // Two fingers navigate — always, whatever is selected.
            .gesture(
                SimultaneousGesture(
                    MagnificationGesture().updating($pinch) { value, state, _ in state = value }
                        .onEnded { value in
                            zoom = min(max(zoom * value, 0.5), 6)
                        },
                    DragGesture(minimumDistance: 0)
                        .updating($twoFingerPan) { _, _, _ in }
                )
            )
            .gesture(
                // One finger: edit what is selected, else select.
                DragGesture(minimumDistance: 4)
                    .onChanged { value in
                        handleDrag(value, scale: scale)
                    }
                    .onEnded { _ in
                        dragStart = nil
                        liveLabel = nil
                        snapEngaged = false
                    }
            )
            .onTapGesture { location in
                handleTap(toModel(location), scale: scale)
            }
        }
        .background(Brand.surface)
    }

    // MARK: - Gestures

    private func handleTap(_ point: CGPoint, scale: CGFloat) {
        let cornerTolerance = handleHit / 2 / scale
        for i in corners.indices where PlanEditing.length(PlanEditing.sub(corners[i], point)) < cornerTolerance {
            select(.corner(i))
            return
        }

        let wallTolerance = wallBand / scale
        var best = -1
        var bestDistance = wallTolerance
        for i in corners.indices {
            let d = distanceToEdge(point, index: i)
            if d < bestDistance {
                bestDistance = d
                best = i
            }
        }
        if best >= 0 {
            // Tapping the already-selected wall's label opens the keypad —
            // the dimension IS the control.
            if selection == .wall(best) {
                typing = TypedLength(edge: best, current: PlanEditing.edgeLength(corners, best))
            } else {
                select(.wall(best))
            }
            return
        }

        select(.none)
    }

    /// Model metres → screen points, about the plan's own middle so zooming
    /// does not walk the drawing off the edge.
    private func screenPoint(_ p: CGPoint, centre: CGPoint, scale: CGFloat) -> CGPoint {
        CGPoint(
            x: centre.x + (p.x - bounds.midX) * scale,
            y: centre.y + (p.y - bounds.midY) * scale)
    }

    private func modelPoint(_ p: CGPoint, centre: CGPoint, scale: CGFloat) -> CGPoint {
        CGPoint(
            x: (p.x - centre.x) / scale + bounds.midX,
            y: (p.y - centre.y) / scale + bounds.midY)
    }

    private func handleDrag(_ value: DragGesture.Value, scale: CGFloat) {
        guard selection != .none else { return }

        if dragStart == nil {
            dragStart = corners
            push()
        }
        guard let start = dragStart else { return }

        switch selection {
        case .wall(let index):
            let (a, b) = PlanEditing.edgeCorners(index, count: start.count)
            let direction = PlanEditing.normalised(PlanEditing.sub(start[b], start[a]))
            let sideways = PlanEditing.normal(direction)
            // Only the component across the wall counts; sliding along it
            // would move a wall through itself.
            let raw = PlanEditing.dot(
                CGPoint(x: value.translation.width / scale, y: value.translation.height / scale),
                sideways)

            let snap = PlanEditing.snapOffset(
                raw,
                candidates: PlanEditing.collinearCandidates(start, index: index),
                capture: captureRadius / scale,
                alreadyEngaged: snapEngaged)

            if snap.engaged && !snapEngaged {
                UISelectionFeedbackGenerator().selectionChanged()
            }
            snapEngaged = snap.engaged

            corners = PlanEditing.moveEdge(start, index: index, offset: snap.value)
            liveLabel = FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, index))

        case .corner(let index):
            let moved = CGPoint(
                x: start[index].x + value.translation.width / scale,
                y: start[index].y + value.translation.height / scale)
            corners = PlanEditing.moveCorner(start, index: index, to: moved)
            let before = (index - 1 + corners.count) % corners.count
            liveLabel = "\(FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, before)))  ·  \(FloorPlanGeometry.feetInches(PlanEditing.edgeLength(corners, index)))"

        case .none:
            break
        }
    }

    private func select(_ next: Selection) {
        guard selection != next else { return }
        UISelectionFeedbackGenerator().selectionChanged()
        withAnimation(.easeOut(duration: 0.15)) { selection = next }
    }

    private func distanceToEdge(_ p: CGPoint, index: Int) -> Double {
        let (ai, bi) = PlanEditing.edgeCorners(index, count: corners.count)
        let a = corners[ai]
        let b = corners[bi]
        let ab = PlanEditing.sub(b, a)
        let l2 = PlanEditing.dot(ab, ab)
        guard l2 > 1e-9 else { return PlanEditing.length(PlanEditing.sub(p, a)) }
        var t = PlanEditing.dot(PlanEditing.sub(p, a), ab) / l2
        t = min(1, max(0, t))
        return PlanEditing.length(
            PlanEditing.sub(p, CGPoint(x: a.x + ab.x * t, y: a.y + ab.y * t)))
    }

    // MARK: - Controls

    private var controls: some View {
        VStack(spacing: Brand.Space.small) {
            if invalid {
                Text("These walls cross each other. Straighten them out to save.")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
            if let error {
                Text(error).font(.footnote).foregroundStyle(.red)
            }

            HStack(spacing: Brand.Space.small) {
                switch selection {
                case .wall(let index):
                    Button {
                        typing = TypedLength(
                            edge: index, current: PlanEditing.edgeLength(corners, index))
                    } label: {
                        Label("Type length", systemImage: "keyboard")
                    }
                    .buttonStyle(EditorButton())

                    Button {
                        push()
                        let (next, made) = PlanEditing.addCorner(corners, onEdge: index)
                        corners = next
                        selection = .corner(made)
                    } label: {
                        Label("Add corner", systemImage: "plus.circle")
                    }
                    .buttonStyle(EditorButton())

                case .corner(let index):
                    Button(role: .destructive) {
                        push()
                        corners = PlanEditing.removeCorner(corners, index: index)
                        selection = .none
                    } label: {
                        Label("Delete corner", systemImage: "minus.circle")
                    }
                    .buttonStyle(EditorButton())
                    .disabled(corners.count <= 3)

                case .none:
                    Text("Tap a wall to select it. Two fingers to zoom and pan.")
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.inkSoft)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack {
                Text(Measure.sqftLabel(PlanEditing.area(corners)))
                    .font(.system(size: 15, weight: .bold).monospacedDigit())
                    .foregroundStyle(Brand.ink)
                Text("floor area")
                    .font(.system(size: 12))
                    .foregroundStyle(Brand.inkFaint)
                Spacer()
                if isDirty {
                    Text("Adjusted by hand")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.orange)
                }
            }
        }
        .padding(Brand.Space.base)
        .background(Brand.canvas)
    }

    // MARK: - State

    private var bounds: CGRect {
        guard !corners.isEmpty else { return CGRect(x: 0, y: 0, width: 1, height: 1) }
        let xs = corners.map(\.x)
        let ys = corners.map(\.y)
        return CGRect(
            x: xs.min()!, y: ys.min()!,
            width: max(xs.max()! - xs.min()!, 0.1),
            height: max(ys.max()! - ys.min()!, 0.1))
    }

    private func fitScale(in size: CGSize) -> CGFloat {
        let inset: CGFloat = 48
        return min(
            (size.width - inset * 2) / bounds.width,
            (size.height - inset * 2) / bounds.height)
    }

    private func load() {
        guard corners.isEmpty, let scan else { return }
        // The outline when the walls closed into one; the bounding box when
        // they did not, so an open scan is still editable rather than
        // refusing to appear.
        if scan.polygon.count >= 4 {
            corners = Array(scan.polygon.dropLast())
        } else {
            corners = [
                CGPoint(x: 0, y: 0), CGPoint(x: scan.width, y: 0),
                CGPoint(x: scan.width, y: scan.height), CGPoint(x: 0, y: scan.height),
            ]
        }
    }

    private func push() {
        history.append(corners)
        if history.count > 100 { history.removeFirst() }
        future.removeAll()
    }

    private func undo() {
        guard let previous = history.popLast() else { return }
        future.append(corners)
        corners = previous
        selection = .none
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func redo() {
        guard let next = future.popLast() else { return }
        history.append(corners)
        corners = next
        selection = .none
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func save() async {
        saving = true
        error = nil
        do {
            try await API.shared.saveEditedPlan(roomId: room.id, corners: corners)
            onSaved()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        saving = false
    }
}

private struct EditorButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(Brand.blue)
            .padding(.horizontal, 12)
            .padding(.vertical, 9)
            .background(Brand.surface, in: .capsule)
            .opacity(configuration.isPressed ? 0.6 : 1)
    }
}

/// Type an exact length.
///
/// The keypad is the whole point: a drag gets a wall roughly right, and a
/// typed number gets it exactly right. Feet and inches, because that is what
/// the tape in the operator's hand reads.
private struct LengthSheet: View {
    let current: Double
    let onApply: (Double) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @FocusState private var focused: Bool

    private var parsed: Double? {
        guard let metres = FloorPlanGeometry.parseFeetInches(text) else { return nil }
        return (metres >= 0.10 && metres <= 50) ? metres : nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(alignment: .leading, spacing: Brand.Space.base) {
                    Text("Currently \(FloorPlanGeometry.feetInches(current))")
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.inkSoft)

                    TextField("12' 6", text: $text)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .keyboardType(.numbersAndPunctuation)
                        .focused($focused)
                        .padding(Brand.Space.base)
                        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))

                    if !text.isEmpty && parsed == nil {
                        Text("Between 4 inches and 164 feet.")
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    Button("Apply") {
                        if let parsed { onApply(parsed) }
                    }
                    .buttonStyle(PrimaryButtonStyle(enabled: parsed != nil))
                    .disabled(parsed == nil)

                    Spacer()
                }
                .padding(Brand.Space.base)
            }
            .navigationTitle("Wall length")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel") { dismiss() } }
            }
            .task { focused = true }
        }
        .presentationDetents([.height(300)])
    }
}
