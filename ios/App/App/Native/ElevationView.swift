import SwiftUI

/// One wall, drawn straight on.
///
/// A plan says how long a wall is. It cannot say that the bottom metre of it
/// is wet, or that the damage stops under the window — and those are the
/// facts a drywall line is priced from. Elevation is the view where a wall
/// stops being a line and becomes a surface with a height, which is the
/// precondition for marking damage on it at all (walkthrough G6).
///
/// Built to `Docs/reference/magicplan/editor-chrome-design.md` §10 and the
/// owner's walkthrough G2–G5. Reused: the layout — the wall face white under
/// a fine tan tile grid, the two adjoining walls folded away as grey
/// trapezoids, the offset chain along the top, wall height down **both**
/// edges, wall length along the bottom, head and sill per opening, circular
/// arrows at the side edges, and the literal `2D` where a back chevron would
/// sit. Not reused: the icon set and the object illustrations. The window and
/// door symbols below are drawn here, in the same hand as `OpeningGlyphs`,
/// and every accent is `Brand.blue` rather than system blue.
///
/// # Wall-face coordinates
///
/// The face has its own two-dimensional space, and everything drawn on it —
/// openings, dimensions, and the damaged regions ORD-20 saves — is expressed
/// in it. **Both axes are metres.**
///
///   * **x — along the wall.** Measured from the edge's START corner,
///     `corners[PlanEditing.edgeCorners(wall, count:).0]`, toward its end
///     corner. Range `0 … wallLength`. This is deliberately the same origin
///     and the same direction as `PlanEditing.WallOpening.offset`, so a
///     damaged region's x can be compared with a door's offset without a
///     transform, and the offset chain along the top is just
///     `PlanEditing.chain` printed where it already runs.
///
///   * **y — above the floor.** Range `0 … ceilingHeight`. y grows UPWARD,
///     which is the opposite of the floor plan's y. That inversion is the
///     point: an elevation whose heights count downward from the ceiling is
///     not one an estimator can read, and a sill height is quoted from the
///     floor by every trade that touches it.
///
/// The face is drawn in the edge's own parametric direction rather than
/// mirrored to "as seen standing in the room". Winding is not guaranteed
/// across scanned rooms, so a from-inside rule would be a guess; the
/// parametric rule is exact, and it is the one already baked into every
/// opening offset in the record.
///
/// A renderer on the other side of the wire reproduces this face from the
/// same three things this view is given — the room polygon, the wall index,
/// and the ceiling height — and needs no further agreement.
struct ElevationView: View {
    /// The room polygon, in the plan's own metres.
    let corners: [CGPoint]
    /// Authored openings, keyed to the polygon's edges.
    ///
    /// A BINDING since 18 Aug 2026, so a door or window can be dragged
    /// along its wall from the face itself — the owner's own ask: *"in
    /// elevation mode I should be able to move things around... left,
    /// right."* Vertical stays out of the drag deliberately, on his own
    /// instruction in the same breath (*"the height from the floor, maybe I
    /// should be able to do it in the properties"*) — which is already
    /// built, as `OpeningDetailView`'s Distance to Floor stepper.
    @Binding var openings: [PlanEditing.WallOpening]
    let ceilingHeight: Double
    let roomScanId: String
    /// The wall being faced. The arrows mutate this, so the caller's
    /// selection follows the view rather than going stale behind it.
    @Binding var wallIndex: Int
    var onClose: () -> Void

    /// An outline being dragged on the face right now, in wall-face metres.
    @State private var draft: FaceRect?
    @State private var drawing = false
    /// Index into `openings` of the one being dragged, and what its offset
    /// was when the drag began — the same snapshot-then-apply-delta shape
    /// `RoomEditorCore.handleDrag` uses, so a drag is one undoable move
    /// rather than a running accumulation of rounding error.
    @State private var draggingOpening: (index: Int, startOffset: Double)?
    /// Every area filed against this room. Held whole rather than
    /// pre-filtered so stepping to the next wall costs no round trip.
    @State private var areas: [AffectedArea] = []
    @State private var naming = false
    @State private var error: String?

    // MARK: - Geometry

    /// A rectangle in wall-face metres. Stored as its two dragged corners and
    /// normalised on read, so a drag that goes up-and-left is the same
    /// rectangle as one that goes down-and-right.
    struct FaceRect: Equatable {
        var a: CGPoint
        var b: CGPoint

        var minX: Double { Double(min(a.x, b.x)) }
        var maxX: Double { Double(max(a.x, b.x)) }
        var minY: Double { Double(min(a.y, b.y)) }
        var maxY: Double { Double(max(a.y, b.y)) }
        var width: Double { maxX - minX }
        var height: Double { maxY - minY }
        var areaSqm: Double { width * height }

        /// Anticlockwise from the bottom-left of the face — the winding the
        /// shoelace in `polygonAreaSqm` expects, so the stored `area_sqm` is
        /// the true face area rather than its negative.
        var polygon: [CGPoint] {
            [
                CGPoint(x: minX, y: minY),
                CGPoint(x: maxX, y: minY),
                CGPoint(x: maxX, y: maxY),
                CGPoint(x: minX, y: maxY),
            ]
        }
    }

    /// The mapping between wall-face metres and the screen, computed once per
    /// frame and shared by the drawing and the gesture — two copies of this
    /// arithmetic is how a rectangle ends up drawn somewhere other than where
    /// the finger was.
    private struct Face {
        let length: Double
        let height: Double
        let scale: CGFloat
        /// Where face-space (0, 0) — the bottom-left of the wall — lands.
        let origin: CGPoint

        func point(_ u: Double, _ v: Double) -> CGPoint {
            CGPoint(x: origin.x + CGFloat(u) * scale, y: origin.y - CGFloat(v) * scale)
        }

        func point(_ p: CGPoint) -> CGPoint { point(Double(p.x), Double(p.y)) }

        /// Screen back to the face, clamped inside it: a finger that slides
        /// off the wall marks the wall's edge rather than a region hanging in
        /// space beyond the corner.
        func clampedFace(_ screen: CGPoint) -> CGPoint {
            CGPoint(
                x: min(max((screen.x - origin.x) / scale, 0), CGFloat(length)),
                y: min(max((origin.y - screen.y) / scale, 0), CGFloat(height)))
        }

        var widthPts: CGFloat { CGFloat(length) * scale }
        var heightPts: CGFloat { CGFloat(height) * scale }
        var top: CGFloat { origin.y - heightPts }
        var right: CGFloat { origin.x + widthPts }
        var rect: CGRect {
            CGRect(x: origin.x, y: top, width: widthPts, height: heightPts)
        }
    }

    // MARK: - Derived

    private var wallCount: Int { corners.count }

    /// The faced edge, normalised. The binding is owned by a caller that may
    /// hand us anything; a modulo here is cheaper than an index crash.
    private var edge: Int {
        guard wallCount > 0 else { return 0 }
        return ((wallIndex % wallCount) + wallCount) % wallCount
    }

    private var wallLength: Double {
        guard wallCount >= 3 else { return 0 }
        return PlanEditing.edgeLength(corners, edge)
    }

    private var wallHeight: Double { max(ceilingHeight, 0.3) }

    private var wallOpenings: [PlanEditing.WallOpening] {
        openings.filter { $0.edge == edge }
    }

    private var isDrawable: Bool { wallCount >= 3 && wallLength > 0.05 }

    /// Damage already filed against the wall being faced.
    private var wallAreas: [AffectedArea] {
        areas.filter { $0.isWall && $0.wallIndex == edge && $0.polygon.count >= 3 }
    }

    /// A room that has not been filed yet has no id to hang an area on. The
    /// button says so rather than failing at the end of a drag.
    private var canMark: Bool { isDrawable && !roomScanId.isEmpty }

    // MARK: - Body

    var body: some View {
        ZStack {
            Brand.canvas.ignoresSafeArea()

            VStack(spacing: Brand.Space.small) {
                navBar
                if isDrawable {
                    canvas
                } else {
                    unavailable
                }
                actionBar
            }
            .padding(.horizontal, Brand.Space.small)
            .padding(.bottom, Brand.Space.small)
        }
        .sheet(isPresented: $naming) {
            if let draft {
                WallDamageSheet(
                    widthM: draft.width, heightM: draft.height, areaSqm: draft.areaSqm,
                    wallNumber: edge + 1
                ) { name, cause in
                    Task { await save(draft, name: name, cause: cause) }
                } onCancel: {
                    naming = false
                    self.draft = nil
                }
            }
        }
        .task { await load() }
    }

    // MARK: - Chrome (§1, §4)

    /// §1's three slots, drawn rather than handed to `.toolbar`.
    ///
    /// The system bar was tried first and collapsed the leading pill to a
    /// bare chevron — iOS gives a toolbar's leading slot its own circular
    /// treatment and the `2D` never appeared. That text IS the control here
    /// (§1: in 3D or elevation the context glyph is the literal `2D`, an
    /// escape rather than a chevron target), so the bar is drawn instead of
    /// negotiated with.
    private var navBar: some View {
        ZStack {
            titleBlock
            HStack {
                escapePill
                Spacer()
            }
        }
        .padding(.top, Brand.Space.tight)
        .padding(.bottom, Brand.Space.hair)
    }

    /// One rounded-rect pill, light grey, holding TWO glyphs side by side: a
    /// back chevron and the context glyph, both `Brand.blue` (§1). What you
    /// would go back to from here is the plan, and `2D` says that in one
    /// syllable the operator already reads on the view-mode stepper.
    private var escapePill: some View {
        Button(action: onClose) {
            HStack(spacing: 3) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 15, weight: .semibold))
                Text("2D")
                    .font(.system(size: 15, weight: .bold))
            }
            .foregroundStyle(Brand.blue)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.pill))
            .overlay(
                RoundedRectangle(cornerRadius: Brand.Radius.pill)
                    .strokeBorder(Brand.hairline, lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Back to the plan")
    }

    private var titleBlock: some View {
        VStack(spacing: 1) {
            Text("Wall")
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Brand.ink)
            Text("Elevation · \(edge + 1) of \(max(wallCount, 1))")
                .font(.system(size: 12))
                .foregroundStyle(Brand.inkFaint)
        }
    }

    /// §4, reduced to `Insert` (G5). One tile rather than a row, because a
    /// wall face has exactly one thing worth inserting onto it.
    private var actionBar: some View {
        VStack(spacing: Brand.Space.tight) {
            Capsule()
                .fill(Brand.hairline)
                .frame(width: 36, height: 4)
                .padding(.top, 6)

            Button {
                if drawing {
                    drawing = false
                    draft = nil
                } else {
                    drawing = true
                }
            } label: {
                VStack(spacing: 3) {
                    Image(systemName: drawing ? "xmark" : "plus.viewfinder")
                        .font(.system(size: 16, weight: .semibold))
                    Text(drawing ? "Cancel" : "Insert")
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(drawing ? Color.red : Brand.blue)
                .padding(.horizontal, Brand.Space.base)
                .padding(.vertical, Brand.Space.tight)
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .disabled(!canMark)
            .opacity(canMark ? 1 : 0.35)

            Text(error ?? caption)
                .font(.system(size: 12))
                .foregroundStyle(error == nil ? Brand.inkSoft : .orange)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Brand.Space.small)
                .padding(.bottom, Brand.Space.tight)
        }
        .frame(maxWidth: .infinity)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card)
                .strokeBorder(Brand.hairline, lineWidth: 0.5))
    }

    private var caption: String {
        guard isDrawable else { return "This wall has no length to draw." }
        guard canMark else { return "This room is not filed yet, so damage has nowhere to save." }
        if let draft, draft.areaSqm > 0 {
            return "\(UnitSettings.shared.format.format(draft.width)) × "
                + "\(UnitSettings.shared.format.format(draft.height)) — "
                + Measure.sqftLabel(draft.areaSqm)
        }
        if drawing { return "Drag a rectangle over the damaged part of the wall." }
        if !wallAreas.isEmpty {
            return "\(Measure.sqftLabel(wallAreas.reduce(0) { $0 + $1.areaSqm })) marked on this wall."
        }
        return "Insert marks a damaged area on this wall face."
    }

    private var unavailable: some View {
        VStack(spacing: Brand.Space.small) {
            Image(systemName: "square.dashed")
                .font(.system(size: 34))
                .foregroundStyle(Brand.inkFaint)
            Text("This room has no closed outline, so it has no wall to face.")
                .font(.system(size: 14))
                .foregroundStyle(Brand.inkSoft)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Brand.Space.large)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Brand.surface, in: .rect(cornerRadius: Brand.Radius.card))
    }

    // MARK: - Canvas

    private var canvas: some View {
        GeometryReader { proxy in
            let face = layout(in: proxy.size)

            ZStack {
                Canvas { context, size in
                    guard let face else { return }
                    drawFolds(context: context, face: face)
                    drawFace(context: context, face: face)
                    drawAreas(context: context, face: face, size: size)
                    drawAreaDimensions(context: context, face: face, size: size)
                    drawDraft(context: context, face: face)
                    drawOpenings(context: context, face: face, size: size)
                    drawDimensions(context: context, face: face, size: size)
                }
                .contentShape(.rect)
                .gesture(drawing ? drawGesture(face: face) : nil)

                // The steppers (G4). Overlaid rather than in the bar so they
                // sit where the wall they lead to is — left button, left wall.
                HStack {
                    stepper(system: "chevron.left") { step(-1) }
                    Spacer()
                    stepper(system: "chevron.right") { step(1) }
                }
                .padding(.horizontal, 6)
            }
        }
        .background(Self.sheet, in: .rect(cornerRadius: Brand.Radius.card))
        .overlay(
            RoundedRectangle(cornerRadius: Brand.Radius.card)
                .strokeBorder(Brand.hairline, lineWidth: 0.5))
        .clipShape(.rect(cornerRadius: Brand.Radius.card))
    }

    private func stepper(system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Brand.blue)
                .frame(width: 40, height: 40)
                .background(Self.paper, in: .circle)
                .overlay(Circle().strokeBorder(Brand.hairline, lineWidth: 0.5))
                .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
        }
        .buttonStyle(.plain)
        .disabled(wallCount < 3)
        .opacity(wallCount < 3 ? 0.3 : 1)
        .accessibilityLabel(system == "chevron.left" ? "Previous wall" : "Next wall")
    }

    /// Step to an adjoining wall, wrapping. A room is a loop; so is this.
    private func step(_ delta: Int) {
        guard wallCount > 0 else { return }
        wallIndex = ((edge + delta) % wallCount + wallCount) % wallCount
        draft = nil
    }

    /// The opening under a face-space point, if any — searched newest-first
    /// so a later opening placed over an earlier one wins the touch, which
    /// is the order they are drawn in.
    private func openingHit(at facePoint: CGPoint) -> Int? {
        for index in openings.indices.reversed() {
            let opening = openings[index]
            guard opening.edge == edge else { continue }
            let start = PlanEditing.clampedOffset(
                offset: opening.offset, width: opening.width, edgeLength: wallLength)
            let sill = min(opening.sill, ceilingHeight)
            let head = min(opening.sill + opening.height, ceilingHeight)
            if facePoint.x >= start, facePoint.x <= start + opening.width,
                facePoint.y >= sill, facePoint.y <= head
            {
                return index
            }
        }
        return nil
    }

    /// One gesture, two jobs, decided by where the finger STARTS.
    ///
    /// Starting on a door or window drags it along the wall; starting
    /// anywhere else draws a damage region, exactly as before. That split is
    /// what lets the owner's ask — *"in elevation mode I should be able to
    /// move things around... left, right"* — coexist with the drag-to-mark
    /// gesture this view was built for, without a mode switch to remember.
    ///
    /// Deliberately horizontal only. `PlanEditing.slideOpening` already
    /// enforces the jamb margins and refuses to overlap a neighbour on the
    /// same wall, so sliding is safe by construction; vertical position is
    /// `sill`, which the owner explicitly wanted left to the properties
    /// sheet and which has no collision rule to lean on.
    private func drawGesture(face: Face?) -> some Gesture {
        DragGesture(minimumDistance: 3)
            .onChanged { value in
                guard let face else { return }
                let start = face.clampedFace(value.startLocation)
                let now = face.clampedFace(value.location)

                if draggingOpening == nil, draft == nil,
                    let hit = openingHit(at: start)
                {
                    draggingOpening = (hit, openings[hit].offset)
                }

                if let dragging = draggingOpening {
                    guard openings.indices.contains(dragging.index) else { return }
                    let delta = Double(now.x - start.x)
                    var moved = openings[dragging.index]
                    moved.offset = dragging.startOffset
                    openings[dragging.index] = PlanEditing.slideOpening(
                        moved, along: corners, by: delta, avoiding: openings)
                    return
                }

                draft = FaceRect(a: start, b: now)
            }
            .onEnded { _ in
                if draggingOpening != nil {
                    draggingOpening = nil
                    return
                }
                // A shape with no area is a tap, not a region. It clears
                // rather than opening a sheet that has nothing to name.
                guard let draft, draft.areaSqm > 0.01 else {
                    self.draft = nil
                    return
                }
                naming = true
            }
    }

    // MARK: - Damage, saved and reloaded

    private func load() async {
        guard !roomScanId.isEmpty else { return }
        areas = (try? await API.shared.areas(roomScanId: roomScanId)) ?? []
    }

    /// File the outline as a wall area.
    ///
    /// `surface` and `wallIndex` are what make it a wall area rather than a
    /// floor one, and the polygon goes up in FACE metres — the space this
    /// file's header defines. The server takes the shoelace of exactly those
    /// numbers for `area_sqm`, so what lands in the column is square metres
    /// of wall, priced at the wall trade's rate.
    ///
    /// No colour is sent. The cause carries the default, and a null column is
    /// what lets the category be recoloured later without stranding this row
    /// on a stale hex.
    private func save(_ region: FaceRect, name: String, cause: DamageCause) async {
        do {
            _ = try await API.shared.createArea(
                roomScanId: roomScanId,
                name: name.isEmpty ? "Wall \(edge + 1)" : name,
                damageType: cause.rawValue,
                surface: "wall",
                wallIndex: edge,
                polygon: region.polygon)
            error = nil
            naming = false
            draft = nil
            drawing = false
            await load()
        } catch {
            // The drawing survives the failure: it took a drag to make and
            // the operator is standing in front of the wall it describes.
            naming = false
            self.error = "That did not save. \(error.localizedDescription)"
        }
    }

    // MARK: - Layout

    /// Fit the face plus its dimension margins into the canvas.
    ///
    /// The margins are not decoration: the top holds the offset chain, the
    /// bottom the wall length, and the sides hold both the folded walls and
    /// the stepper buttons, which must not sit on top of the drawing they
    /// step away from.
    private func layout(in size: CGSize) -> Face? {
        guard isDrawable, size.width > 80, size.height > 80 else { return nil }
        let padTop: CGFloat = 42
        let padBottom: CGFloat = 44
        let padSide: CGFloat = 58

        let availableW = size.width - padSide * 2
        let availableH = size.height - padTop - padBottom
        guard availableW > 20, availableH > 20 else { return nil }

        let scale = min(availableW / CGFloat(wallLength), availableH / CGFloat(wallHeight))
        guard scale.isFinite, scale > 0 else { return nil }

        let widthPts = CGFloat(wallLength) * scale
        let heightPts = CGFloat(wallHeight) * scale
        return Face(
            length: wallLength,
            height: wallHeight,
            scale: scale,
            origin: CGPoint(
                x: padSide + (availableW - widthPts) / 2,
                y: padTop + (availableH + heightPts) / 2))
    }

    // MARK: - The folded walls (G2)

    /// The two adjoining walls, folded away left and right as grey trapezoids
    /// whose outer edges slant back from the face. They carry no dimensions
    /// and are not drawable — their only job is to say which way the room
    /// continues, so a wall face is never a rectangle floating in nothing.
    private func drawFolds(context: GraphicsContext, face: Face) {
        guard wallCount >= 3 else { return }
        let before = (edge - 1 + wallCount) % wallCount
        let after = (edge + 1) % wallCount

        for (neighbour, side) in [(before, -1.0), (after, 1.0)] {
            let run = PlanEditing.edgeLength(corners, neighbour)
            guard run > 0.05 else { continue }

            // Foreshortened, not measured. A fold is a hint about topology;
            // drawing it to scale would make a long adjoining wall swallow
            // the face that is actually being worked on.
            let depth = min(CGFloat(run) * 0.30 * face.scale, 46)
            guard depth > 8 else { continue }
            let slant = depth * 0.42

            let x0 = side < 0 ? face.origin.x : face.right
            let x1 = x0 + CGFloat(side) * depth

            var fold = Path()
            fold.move(to: CGPoint(x: x0, y: face.origin.y))
            fold.addLine(to: CGPoint(x: x1, y: face.origin.y - slant))
            fold.addLine(to: CGPoint(x: x1, y: face.top + slant))
            fold.addLine(to: CGPoint(x: x0, y: face.top))
            fold.closeSubpath()

            context.fill(fold, with: .color(Brand.inkFaint.opacity(0.22)))
            context.stroke(fold, with: .color(Brand.inkSoft.opacity(0.55)), lineWidth: 0.7)
        }
    }

    // MARK: - The face (§10, §2)

    /// White, under the same fine tan tile grid a selected room carries in
    /// plan (§2) — the texture is what says "this surface is the one in
    /// hand", and reusing it means the operator learns it once.
    private func drawFace(context: GraphicsContext, face: Face) {
        let rect = face.rect
        let outline = Path(rect)
        context.fill(outline, with: .color(Self.paper))

        // Model-space pitch, so the tiles hold their real size as a short
        // wall is drawn bigger than a long one.
        let pitch = 0.5
        let pitchPts = CGFloat(pitch) * face.scale
        if pitchPts >= 7 {
            var clipped = context
            clipped.clip(to: outline)
            var grid = Path()
            var u = pitch
            while u < face.length {
                let p = face.point(u, 0)
                grid.move(to: CGPoint(x: p.x, y: rect.minY))
                grid.addLine(to: CGPoint(x: p.x, y: rect.maxY))
                u += pitch
            }
            var v = pitch
            while v < face.height {
                let p = face.point(0, v)
                grid.move(to: CGPoint(x: rect.minX, y: p.y))
                grid.addLine(to: CGPoint(x: rect.maxX, y: p.y))
                v += pitch
            }
            clipped.stroke(grid, with: .color(Self.tile.opacity(0.38)), lineWidth: 0.5)
        }

        // Floor and ceiling read heavier than the corners: they are the two
        // lines every height on this drawing is measured from.
        context.stroke(outline, with: .color(Brand.inkSoft.opacity(0.7)), lineWidth: 0.8)
        var edges = Path()
        edges.move(to: CGPoint(x: rect.minX, y: rect.maxY))
        edges.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        edges.move(to: CGPoint(x: rect.minX, y: rect.minY))
        edges.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        context.stroke(edges, with: .color(Color(hex: 0x111111)), lineWidth: 1.6)
    }

    /// The tan of the tile grid. Warmer than anything else on the canvas so
    /// it cannot be mistaken for a dimension or a wall.
    private static let tile = Color(hex: 0xC08552)

    /// The drawing's own palette, fixed in both appearances.
    ///
    /// An elevation is a sheet of paper, and paper does not invert. Drawn
    /// against `.systemBackground` the face went black in dark mode under ink
    /// that stayed near-black, which is a drawing nobody can see;
    /// `FloorPlanView` already avoids that by fixing its floor fill. `paper`
    /// is the face, `sheet` the flat very light grey it sits on (§2) — the
    /// contrast between them is what makes the face read as a face.
    private static let paper = Color(hex: 0xFFFFFF)
    private static let sheet = Color(hex: 0xF2F2F5)

    /// Damage already marked on this wall, each in its cause's colour — the
    /// owner's *"different colour coatings for you to find them easily
    /// after"* (G6). Drawn over the tile grid and under the openings, so a
    /// window inside a wet region still reads as a window.
    ///
    /// Their polygons are in face metres, which is why they can be drawn with
    /// the same `face.point` the dimensions use and nothing else.
    private func drawAreas(context: GraphicsContext, face: Face, size: CGSize) {
        for area in wallAreas {
            var path = Path()
            for (index, point) in area.polygon.enumerated() {
                let at = face.point(point.x, point.y)
                if index == 0 { path.move(to: at) } else { path.addLine(to: at) }
            }
            path.closeSubpath()

            let colour = area.displayColor
            context.fill(path, with: .color(colour.opacity(0.28)))
            context.stroke(path, with: .color(colour), lineWidth: 1.5)

            // The name on the region itself: a colour says the cause, and
            // only the name says which of two wet patches this one is.
            let box = path.boundingRect
            guard box.width > 34, box.height > 16 else { continue }
            let text = context.resolve(
                Text(area.name)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(colour))
            context.draw(text, at: CGPoint(x: box.midX, y: box.midY), anchor: .center)
        }
    }

    /// Width and height for the areas marked `showDimensions` — ORD-32, and
    /// off by default: most areas exist to mark WHERE damage is, not to be
    /// measured against, so this is a deliberate choice per area rather than
    /// something every region prints.
    ///
    /// Measured from the polygon's own metres, not the screen box, so the
    /// figure is exact regardless of zoom. Drawn in the area's own colour —
    /// on a wall with two marked regions, a blue figure belonging to the
    /// wrong one is worse than no figure.
    private func drawAreaDimensions(context: GraphicsContext, face: Face, size: CGSize) {
        for area in wallAreas where area.showDimensions {
            let xs = area.polygon.map(\.x)
            let ys = area.polygon.map(\.y)
            guard let minX = xs.min(), let maxX = xs.max(),
                let minY = ys.min(), let maxY = ys.max()
            else { continue }
            let width = maxX - minX
            let height = maxY - minY
            guard width > 0.02, height > 0.02 else { continue }

            let colour = area.displayColor
            let topLeft = face.point(minX, maxY)
            let bottomLeft = face.point(minX, minY)
            let bottomRight = face.point(maxX, minY)

            // Width: a witness line under the region's own bottom edge,
            // pulled down a few points so it never sits on top of the fill.
            let widthY = bottomLeft.y + 12
            var widthLine = Path()
            widthLine.move(to: CGPoint(x: bottomLeft.x, y: widthY))
            widthLine.addLine(to: CGPoint(x: bottomRight.x, y: widthY))
            context.stroke(widthLine, with: .color(colour.opacity(0.8)), lineWidth: 0.7)
            for x in [bottomLeft.x, bottomRight.x] {
                var tick = Path()
                tick.move(to: CGPoint(x: x, y: widthY - 3))
                tick.addLine(to: CGPoint(x: x, y: widthY + 3))
                context.stroke(tick, with: .color(colour.opacity(0.8)), lineWidth: 1)
            }
            writeAreaFigure(
                UnitSettings.shared.format.format(Double(width)),
                at: CGPoint(x: (bottomLeft.x + bottomRight.x) / 2, y: widthY), colour: colour,
                context: context, size: size)

            // Height: a witness line beside the region's own left edge —
            // right of it if the region starts near the wall's own left
            // edge, so the figure never runs off the face.
            let toRight = minX < 0.3
            let heightX = toRight ? bottomLeft.x + 12 : bottomLeft.x - 12
            var heightLine = Path()
            heightLine.move(to: CGPoint(x: heightX, y: topLeft.y))
            heightLine.addLine(to: CGPoint(x: heightX, y: bottomLeft.y))
            context.stroke(heightLine, with: .color(colour.opacity(0.8)), lineWidth: 0.7)
            for y in [topLeft.y, bottomLeft.y] {
                var tick = Path()
                tick.move(to: CGPoint(x: heightX - 3, y: y))
                tick.addLine(to: CGPoint(x: heightX + 3, y: y))
                context.stroke(tick, with: .color(colour.opacity(0.8)), lineWidth: 1)
            }
            writeAreaFigure(
                UnitSettings.shared.format.format(Double(height)),
                at: CGPoint(x: heightX, y: (topLeft.y + bottomLeft.y) / 2), colour: colour,
                rotated: -90, context: context, size: size)
        }
    }

    /// `write()` fixes its figures to Brand.blue — right for the wall's own
    /// dimensions, wrong here, where the colour IS the information: it says
    /// which of possibly several marked regions this figure belongs to.
    private func writeAreaFigure(
        _ string: String, at point: CGPoint, colour: Color, rotated degrees: Double = 0,
        context: GraphicsContext, size: CGSize
    ) {
        let resolved = context.resolve(
            Text(string)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(colour))
        let measured = resolved.measure(in: size)
        context.drawLayer { layer in
            layer.translateBy(x: point.x, y: point.y)
            if degrees != 0 { layer.rotate(by: .degrees(degrees)) }
            layer.fill(
                Path(
                    roundedRect: CGRect(
                        x: -measured.width / 2 - 3, y: -measured.height / 2 - 1,
                        width: measured.width + 6, height: measured.height + 2),
                    cornerRadius: 3),
                with: .color(Self.paper.opacity(0.85)))
            layer.draw(resolved, at: .zero, anchor: .center)
        }
    }

    private func drawDraft(context: GraphicsContext, face: Face) {
        guard let draft, draft.areaSqm > 0 else { return }
        let path = Path(rectangle(draft, in: face))
        context.fill(path, with: .color(Brand.blue.opacity(0.22)))
        context.stroke(path, with: .color(Brand.blue), lineWidth: 2)
    }

    private func rectangle(_ region: FaceRect, in face: Face) -> CGRect {
        let a = face.point(region.minX, region.maxY)
        let b = face.point(region.maxX, region.minY)
        return CGRect(x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y)
    }

    // MARK: - Openings on the face (§10)

    /// A window as concentric rectangles, a door as a leaf with a handle —
    /// our own drafting, following the same conventions `OpeningGlyphs` uses
    /// in plan so the two views read as one drawing.
    private func drawOpenings(context: GraphicsContext, face: Face, size: CGSize) {
        for opening in wallOpenings {
            guard let box = openingRect(opening, in: face) else { continue }

            // Clear the tile grid out of the opening: a window is a hole in
            // the surface, not a pane of it.
            context.fill(Path(box), with: .color(Self.paper))

            let ink = Color(hex: 0x111111)
            switch opening.kind {
            case .windowStandard, .windowWide, .windowSmall:
                context.fill(Path(box), with: .color(Brand.blueLight.opacity(0.55)))
                // Concentric: casing, sash, glazing bead. Each inset by a
                // real thickness rather than a fraction, so a small hopper
                // does not get a frame thicker than its glass.
                for (step, weight) in [(0.0, 1.5), (0.045, 1.0), (0.085, 0.6)] {
                    let inset = CGFloat(step) * face.scale
                    let r = box.insetBy(dx: inset, dy: inset)
                    guard r.width > 1, r.height > 1 else { break }
                    context.stroke(Path(r), with: .color(ink), lineWidth: weight)
                }

            case .doorCased:
                // A passage closes with nothing, so it gets a jamb outline
                // and a dashed head — the drafting way of saying "open".
                var jambs = Path()
                jambs.move(to: CGPoint(x: box.minX, y: box.maxY))
                jambs.addLine(to: CGPoint(x: box.minX, y: box.minY))
                jambs.addLine(to: CGPoint(x: box.maxX, y: box.minY))
                jambs.addLine(to: CGPoint(x: box.maxX, y: box.maxY))
                context.stroke(jambs, with: .color(ink), lineWidth: 1.4)

            case .doorDouble:
                leaf(box.divided(atDistance: box.width / 2, from: .minXEdge).slice,
                     handleAtTrailing: true, context: context, face: face)
                leaf(box.divided(atDistance: box.width / 2, from: .maxXEdge).slice,
                     handleAtTrailing: false, context: context, face: face)

            case .doorSliding:
                // The bypass convention, in elevation: two panels just over
                // half the width each, offset so the overlap reads.
                let panel = box.width * 0.55
                context.stroke(
                    Path(CGRect(x: box.minX, y: box.minY, width: panel, height: box.height)),
                    with: .color(ink), lineWidth: 1.3)
                context.stroke(
                    Path(
                        CGRect(
                            x: box.maxX - panel, y: box.minY + 2,
                            width: panel, height: box.height - 2)),
                    with: .color(ink), lineWidth: 1.3)

            case .doorSingle:
                // Hinge at the jamb nearer a corner of the wall, exactly as
                // the plan glyph guesses it, so the handle is on the same
                // side in both views.
                let offset = PlanEditing.clampedOffset(
                    offset: opening.offset, width: opening.width, edgeLength: wallLength)
                let hingeAtStart = offset <= (wallLength - offset - opening.width)
                leaf(box, handleAtTrailing: hingeAtStart, context: context, face: face)
            }
        }
    }

    /// A door leaf: the panel, a recessed inner line, and a handle at the
    /// latch side. Handle height is the 1.0 m convention every joiner hangs
    /// to; it is a drawing detail, never a measurement.
    private func leaf(
        _ box: CGRect, handleAtTrailing: Bool, context: GraphicsContext, face: Face
    ) {
        let ink = Color(hex: 0x111111)
        context.stroke(Path(box), with: .color(ink), lineWidth: 1.5)
        let inner = box.insetBy(dx: 0.06 * face.scale, dy: 0.06 * face.scale)
        if inner.width > 2, inner.height > 2 {
            context.stroke(Path(inner), with: .color(ink.opacity(0.55)), lineWidth: 0.6)
        }
        let handleY = box.maxY - CGFloat(1.0) * face.scale
        guard handleY > box.minY, handleY < box.maxY else { return }
        let inset = min(0.07 * face.scale, box.width * 0.25)
        let x = handleAtTrailing ? box.maxX - inset : box.minX + inset
        let r: CGFloat = max(1.6, 0.02 * face.scale)
        context.fill(
            Path(ellipseIn: CGRect(x: x - r, y: handleY - r, width: r * 2, height: r * 2)),
            with: .color(ink))
    }

    /// Where an opening sits on the face.
    ///
    /// This used to head every opening on one line — the framer's 6'-8"
    /// header — and derive the sill by subtracting the opening's height,
    /// because at the time **nothing in the record stored a real sill** and a
    /// derived number that looks measured is worse than a stated convention.
    ///
    /// That premise no longer holds: `OpeningKind.sill` is a real stored
    /// height now (ORD-24), so the sill is read rather than reconstructed and
    /// the head falls out of it. A door still lands at 6'-8" because its sill
    /// is zero and its height is 6'-8"; a window sits where its sill puts it.
    ///
    /// Both ends are clamped into the wall, so a low ceiling clips the head
    /// instead of drawing an opening through it, and a hopper whose sill is
    /// above the ceiling is not drawn at all rather than upside down.
    private func openingRect(_ opening: PlanEditing.WallOpening, in face: Face) -> CGRect? {
        let offset = PlanEditing.clampedOffset(
            offset: opening.offset, width: opening.width, edgeLength: wallLength)
        // The opening's OWN sill and height now, not the kind's catalog
        // figure — independently editable since 18 Aug 2026, and this face
        // has to draw what was actually declared for THIS opening.
        let sill = min(opening.sill, wallHeight)
        let head = min(opening.sill + opening.height, wallHeight)
        guard head > sill else { return nil }
        let a = face.point(offset, head)
        let b = face.point(offset + opening.width, sill)
        let rect = CGRect(x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y)
        guard rect.width > 1, rect.height > 1 else { return nil }
        return rect
    }

    // MARK: - Dimensions (§6, §10, G3)

    private func drawDimensions(context: GraphicsContext, face: Face, size: CGSize) {
        drawOffsetChain(context: context, face: face, size: size)
        drawHeights(context: context, face: face, size: size)
        drawLength(context: context, face: face, size: size)
        drawOpeningHeights(context: context, face: face, size: size)
    }

    /// The offset chain along the top (G3): the wall's own pieces, gap ·
    /// opening · gap, from `PlanEditing.chain` — the same projection the plan
    /// prints, so the two views cannot disagree about where a door is.
    private func drawOffsetChain(context: GraphicsContext, face: Face, size: CGSize) {
        let pieces = PlanEditing.chain(corners, edge: edge, openings: openings)
        // One piece means no opening; the overall length along the bottom
        // already carries it, and a chain of one is just a repeat.
        guard pieces.count > 1 else { return }

        let y = face.top - 22
        var line = Path()
        line.move(to: CGPoint(x: face.origin.x, y: y))
        line.addLine(to: CGPoint(x: face.right, y: y))
        context.stroke(line, with: .color(Brand.inkSoft.opacity(0.8)), lineWidth: 0.7)

        var cursor = 0.0
        for (index, piece) in pieces.enumerated() {
            let midpoint = cursor + piece / 2
            cursor += piece

            if index < pieces.count - 1 {
                let x = face.point(cursor, 0).x
                var tick = Path()
                tick.move(to: CGPoint(x: x, y: y - 4))
                tick.addLine(to: CGPoint(x: x, y: y + 4))
                context.stroke(tick, with: .color(Brand.inkSoft), lineWidth: 1)
                // A witness line down to the jamb it measures.
                var witness = Path()
                witness.move(to: CGPoint(x: x, y: y + 4))
                witness.addLine(to: CGPoint(x: x, y: face.top - 2))
                context.stroke(
                    witness, with: .color(Brand.inkFaint.opacity(0.7)),
                    style: StrokeStyle(lineWidth: 0.5, dash: [2, 2]))
            }

            guard piece > 0.03 else { continue }
            // Openings sit at the odd indices by construction of the chain.
            let isOpening = index % 2 == 1
            write(
                UnitSettings.shared.format.format(piece),
                at: CGPoint(x: face.point(midpoint, 0).x, y: y - 9),
                bold: isOpening, context: context, size: size)
        }
    }

    /// Wall height down BOTH edges. That is a drafting convention rather than
    /// a duplicated number (§6): the eye reads a height off whichever edge is
    /// nearer the detail it is looking at, and a face with one height reads
    /// as a face that has been cropped.
    ///
    /// Drawn just inside the face because the ground outside it is taken by
    /// the folded walls; the string still terminates on the floor and ceiling
    /// lines, which is what makes it a height rather than a note.
    private func drawHeights(context: GraphicsContext, face: Face, size: CGSize) {
        let inset: CGFloat = min(20, face.widthPts / 4)
        let text = UnitSettings.shared.format.format(wallHeight)
        for x in [face.origin.x + inset, face.right - inset] {
            var line = Path()
            line.move(to: CGPoint(x: x, y: face.top))
            line.addLine(to: CGPoint(x: x, y: face.origin.y))
            context.stroke(line, with: .color(Brand.inkSoft.opacity(0.85)), lineWidth: 0.7)

            for y in [face.top, face.origin.y] {
                var tick = Path()
                tick.move(to: CGPoint(x: x - 4, y: y))
                tick.addLine(to: CGPoint(x: x + 4, y: y))
                context.stroke(tick, with: .color(Brand.inkSoft), lineWidth: 1.1)
            }

            write(
                text, at: CGPoint(x: x, y: (face.top + face.origin.y) / 2),
                rotated: -90, context: context, size: size)
        }
    }

    /// Wall length along the bottom (G3).
    private func drawLength(context: GraphicsContext, face: Face, size: CGSize) {
        let y = face.origin.y + 24
        var line = Path()
        line.move(to: CGPoint(x: face.origin.x, y: y))
        line.addLine(to: CGPoint(x: face.right, y: y))
        context.stroke(line, with: .color(Brand.inkSoft.opacity(0.85)), lineWidth: 0.7)

        for x in [face.origin.x, face.right] {
            var witness = Path()
            witness.move(to: CGPoint(x: x, y: face.origin.y + 3))
            witness.addLine(to: CGPoint(x: x, y: y + 4))
            context.stroke(witness, with: .color(Brand.inkSoft.opacity(0.7)), lineWidth: 0.5)
            var tick = Path()
            tick.move(to: CGPoint(x: x - 3.5, y: y + 3.5))
            tick.addLine(to: CGPoint(x: x + 3.5, y: y - 3.5))
            context.stroke(tick, with: .color(Brand.inkSoft), lineWidth: 1.1)
        }

        write(
            UnitSettings.shared.format.format(wallLength),
            at: CGPoint(x: (face.origin.x + face.right) / 2, y: y + 11),
            bold: true, context: context, size: size)
    }

    /// Per opening, its head height DOWN FROM THE CEILING and its sill height
    /// UP FROM THE FLOOR (G3). Two figures, two data, quoted the way the two
    /// trades that need them quote them: a header is set from the ceiling, a
    /// sill is set from the floor.
    ///
    /// They sit beside the opening they belong to rather than all at the
    /// right edge, because a wall with three windows and one column of
    /// numbers is a wall nobody can price.
    private func drawOpeningHeights(context: GraphicsContext, face: Face, size: CGSize) {
        for opening in wallOpenings {
            guard let box = openingRect(opening, in: face) else { continue }
            // The same clamped sill and head the rectangle was drawn from, so
            // the figures cannot disagree with the shape they annotate — the
            // opening's OWN, independently-editable values now, not the
            // kind's catalog figure.
            let sill = min(opening.sill, wallHeight)
            let head = min(opening.sill + opening.height, wallHeight)

            // Right of the opening by default; left when the right would run
            // off the face.
            let toRight = box.maxX + 34 <= face.right
            let x = toRight ? box.maxX + 10 : box.minX - 10

            func run(from: CGFloat, to: CGFloat, label: String) {
                guard abs(to - from) > 6 else { return }
                var line = Path()
                line.move(to: CGPoint(x: x, y: from))
                line.addLine(to: CGPoint(x: x, y: to))
                context.stroke(line, with: .color(Brand.blue.opacity(0.7)), lineWidth: 0.7)
                for y in [from, to] {
                    var tick = Path()
                    tick.move(to: CGPoint(x: x - 3, y: y))
                    tick.addLine(to: CGPoint(x: x + 3, y: y))
                    context.stroke(tick, with: .color(Brand.blue.opacity(0.7)), lineWidth: 1)
                }
                write(
                    label, at: CGPoint(x: x, y: (from + to) / 2),
                    small: true, rotated: -90, context: context, size: size)
            }

            run(
                from: face.top, to: box.minY,
                label: UnitSettings.shared.format.format(max(0, wallHeight - head)))
            if sill > 0.02 {
                run(
                    from: box.maxY, to: face.origin.y,
                    label: UnitSettings.shared.format.format(sill))
            }
        }
    }

    /// A dimension figure: brand blue, no plate, with a soft knockout so the
    /// tile grid clears from under the digits the way ruled paper clears
    /// under ink (§6).
    private func write(
        _ string: String, at point: CGPoint, bold: Bool = false, small: Bool = false,
        rotated degrees: Double = 0, context: GraphicsContext, size: CGSize
    ) {
        let resolved = context.resolve(
            Text(string)
                .font(.system(size: small ? 9 : 11, weight: bold ? .bold : .regular))
                .foregroundStyle(Brand.blue))
        let measured = resolved.measure(in: size)
        context.drawLayer { layer in
            layer.translateBy(x: point.x, y: point.y)
            if degrees != 0 { layer.rotate(by: .degrees(degrees)) }
            layer.fill(
                Path(
                    roundedRect: CGRect(
                        x: -measured.width / 2 - 3, y: -measured.height / 2 - 1,
                        width: measured.width + 6, height: measured.height + 2),
                    cornerRadius: 3),
                with: .color(Self.paper.opacity(0.88)))
            layer.draw(resolved, at: .zero, anchor: .center)
        }
    }
}

// MARK: - Naming the damage

/// Name the region and say what caused it.
///
/// Two questions, asked once, after the shape exists. The owner's own account
/// of the feature is a rectangle that is *named* and *colour-coded by cause*
/// (G6), and those are exactly the two fields the row needs to be findable
/// later and priceable at all — the cause is what decides which price-book
/// lines apply, so it cannot be an afterthought.
///
/// The measurement is shown but not editable. It is the drag's own arithmetic,
/// and a typed number that disagreed with the drawn rectangle would be a
/// figure with no shape behind it.
struct WallDamageSheet: View {
    let widthM: Double
    let heightM: Double
    let areaSqm: Double
    let wallNumber: Int
    let onSave: (String, DamageCause) -> Void
    let onCancel: () -> Void

    @State private var name = ""
    @State private var cause: DamageCause = .water
    @State private var saving = false

    var body: some View {
        NavigationStack {
            ZStack {
                Brand.canvas.ignoresSafeArea()

                VStack(alignment: .leading, spacing: Brand.Space.base) {
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Wall \(wallNumber)")
                                .font(.system(size: 11, weight: .heavy))
                                .tracking(0.3)
                                .foregroundStyle(Brand.inkFaint)
                            Text(
                                "\(UnitSettings.shared.format.format(widthM)) × "
                                    + UnitSettings.shared.format.format(heightM)
                            )
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Brand.inkSoft)
                        }
                        Spacer()
                        Text(Measure.sqftLabel(areaSqm))
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(cause.color)
                    }

                    TextField("Name it — \"below the window\"", text: $name)
                        .font(.system(size: 16, weight: .semibold))
                        .textFieldStyle(.plain)
                        .padding(Brand.Space.small)
                        .background(
                            Brand.surfaceRaised, in: .rect(cornerRadius: Brand.Radius.tile))

                    VStack(alignment: .leading, spacing: Brand.Space.tight) {
                        Text("Cause")
                            .font(.system(size: 11, weight: .heavy))
                            .tracking(0.3)
                            .foregroundStyle(Brand.inkFaint)
                        DamageCausePicker(cause: $cause)
                    }

                    Text("Wall damage totals separately from floor damage — stripping drywall and lifting a floor are different trades at different rates.")
                        .font(.system(size: 11))
                        .foregroundStyle(Brand.inkFaint)
                        .fixedSize(horizontal: false, vertical: true)

                    Spacer(minLength: 0)

                    Button(saving ? "Saving…" : "Save area") {
                        saving = true
                        onSave(name.trimmingCharacters(in: .whitespacesAndNewlines), cause)
                    }
                    .buttonStyle(PrimaryButtonStyle(enabled: !saving))
                    .disabled(saving)
                }
                .padding(Brand.Space.base)
            }
            .navigationTitle("Damaged area")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: onCancel)
                }
            }
        }
        .presentationDetents([.medium])
    }
}
