import SwiftUI

/// Build a room by placing its corners, one tap at a time.
///
/// The reference's `Draw Room`, and the sibling of `RoomSketchView`: that
/// one starts from a rectangle and pulls it into shape, this one starts from
/// nothing and puts the corners where the walls actually are. The two suit
/// different rooms. A bedroom is a rectangle with a notch and is fastest
/// pulled; an L-shaped basement with a chimney breast and a stair bulkhead
/// has no rectangle to start from, and dragging one into that shape is more
/// work than simply walking the outline.
///
/// It shares `RoomSketchView`'s exact contract — `onDone(corners, ceiling,
/// openings)` — so `CaptureFlow` saves a drawn room the same way whichever
/// of the two produced it, and neither becomes a second save path to keep
/// correct.
///
/// # Why taps place corners rather than a finger tracing
///
/// Freehand already exists for affected areas (S3) and is right there: a wet
/// patch has no true edges, so any smooth outline is as honest as another. A
/// ROOM has exact corners, and a traced one would have to be simplified into
/// a polygon that is no longer what the operator drew. Tapping states each
/// corner exactly once, which is also how a tape measure is read.
struct DrawRoomView: View {
    let onCancel: () -> Void
    let onDone: ([CGPoint], Double, [PlanEditing.WallOpening]) -> Void

    @ObservedObject private var units = UnitSettings.shared

    /// Corners in PLAN METRES, in the order tapped.
    @State private var corners: [CGPoint] = []
    @State private var heightText = "8"
    /// Metres per point, fixed for the session so the drawing does not
    /// rescale under the operator mid-outline.
    @State private var metresPerPoint: Double = 0.02
    @State private var closed = false

    /// Snap to 5 cm. A fingertip is never trusted for a final number here
    /// any more than it is in the plan editor — `PlanEditing.quantum` is the
    /// store-level rounding; this is the coarser one a tap deserves.
    private let snap = 0.05

    private var ceilingM: Double {
        UnitSettings.shared.format.parse(heightText) ?? 2.44
    }

    private var areaSqm: Double { PlanEditing.area(corners) }

    private var canClose: Bool { corners.count >= 3 && !closed }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                GeometryReader { proxy in
                    ZStack {
                        Brand.Plan.paper
                        Canvas { context, size in
                            EditorChrome.drawGrid(context: context, size: size)
                            draw(context: context, size: size)
                        }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { location in place(location, in: proxy.size) }
                }

                controls
            }
            .navigationTitle("Draw Room")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Undo") { undo() }.disabled(corners.isEmpty)
                }
            }
        }
    }

    // MARK: - Canvas

    /// Plan metres → screen points, centred on the canvas. Derived every
    /// frame from the same origin the taps invert through, so a placed
    /// corner cannot land somewhere other than where it was tapped.
    private func origin(_ size: CGSize) -> CGPoint {
        CGPoint(x: size.width / 2, y: size.height / 2)
    }

    private func toScreen(_ p: CGPoint, _ size: CGSize) -> CGPoint {
        let o = origin(size)
        return CGPoint(x: o.x + p.x / metresPerPoint, y: o.y + p.y / metresPerPoint)
    }

    private func toModel(_ p: CGPoint, _ size: CGSize) -> CGPoint {
        let o = origin(size)
        return CGPoint(x: (p.x - o.x) * metresPerPoint, y: (p.y - o.y) * metresPerPoint)
    }

    private func draw(context: GraphicsContext, size: CGSize) {
        guard !corners.isEmpty else { return }
        let points = corners.map { toScreen($0, size) }

        var path = Path()
        path.move(to: points[0])
        for p in points.dropFirst() { path.addLine(to: p) }
        if closed { path.closeSubpath() }

        if closed {
            context.fill(path, with: .color(Brand.Plan.floorMuted))
        }
        context.stroke(
            path, with: .color(Brand.Plan.ink),
            style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))

        // Each wall's length, on the wall. This is the whole reason to draw
        // rather than type: the number appears where the tape would be held.
        let count = closed ? points.count : points.count - 1
        if count > 0 {
            for i in 0..<count {
                let a = corners[i]
                let b = corners[(i + 1) % corners.count]
                let mid = CGPoint(
                    x: (points[i].x + points[(i + 1) % points.count].x) / 2,
                    y: (points[i].y + points[(i + 1) % points.count].y) / 2)
                let length = hypot(b.x - a.x, b.y - a.y)
                let text = context.resolve(
                    Text(units.format.format(length))
                        .font(.system(size: 11, weight: .bold).monospacedDigit())
                        .foregroundStyle(Brand.ink))
                context.draw(text, at: mid, anchor: .center)
            }
        }

        for (i, p) in points.enumerated() {
            // The first corner is the one you close onto, so it is the one
            // that has to be findable.
            let first = i == 0 && !closed
            context.fill(
                Path(ellipseIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)),
                with: .color(first ? Brand.blue : Brand.Plan.ink))
            context.stroke(
                Path(ellipseIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)),
                with: .color(.white), lineWidth: 2)
        }
    }

    // MARK: - Editing

    private func place(_ location: CGPoint, in size: CGSize) {
        guard !closed else { return }
        let model = toModel(location, size)
        let snapped = CGPoint(
            x: (model.x / snap).rounded() * snap,
            y: (model.y / snap).rounded() * snap)

        // Tapping the first corner closes the outline — the same gesture a
        // hand already expects from every polygon tool.
        if corners.count >= 3, let first = corners.first {
            let onScreen = toScreen(first, size)
            if hypot(onScreen.x - location.x, onScreen.y - location.y) < 22 {
                closed = true
                return
            }
        }
        corners.append(snapped)
    }

    private func undo() {
        if closed { closed = false } else if !corners.isEmpty { corners.removeLast() }
    }

    // MARK: - Controls

    private var controls: some View {
        VStack(alignment: .leading, spacing: Brand.Space.small) {
            HStack {
                Text(
                    closed
                        ? "\(Int(Measure.squareFeet(areaSqm).rounded())) sq ft"
                        : (corners.count < 3
                            ? "Tap each corner of the room"
                            : "Tap the blue corner to close"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(closed ? Brand.ink : Brand.inkSoft)
                Spacer()
                if canClose {
                    Button("Close shape") { closed = true }
                        .font(.system(size: 14, weight: .bold))
                }
            }

            HStack(spacing: Brand.Space.small) {
                Text("CEILING")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(Brand.inkFaint)
                TextField("8", text: $heightText)
                    .keyboardType(.decimalPad)
                    .font(.system(size: 15, weight: .semibold))
                    .frame(width: 90)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Brand.surfaceRaised, in: .rect(cornerRadius: 8))
                Spacer()
            }

            Button("Use this room") {
                onDone(corners, ceilingM, [])
            }
            .buttonStyle(PrimaryButtonStyle(enabled: closed && areaSqm > 0.5))
            .disabled(!closed || areaSqm <= 0.5)

            Text("Openings are added afterwards, on the plan — a door is easier to place against a wall that already exists than to predict while drawing one.")
                .font(.system(size: 11))
                .foregroundStyle(Brand.inkFaint)
        }
        .padding(Brand.Space.base)
        .background(Brand.canvas)
    }
}
