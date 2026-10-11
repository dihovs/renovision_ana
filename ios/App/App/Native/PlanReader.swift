import CoreGraphics
import Foundation
import Vision

/// **Reads somebody else's floor plan into rooms, on the phone, with no
/// network and no paid service.**
///
/// The owner, 11 Oct 2026: *"We're not gonna use the API key for this. We
/// need to have an offline logic."* So everything here is the phone's own:
/// Apple's on-device text recognition for the labels, and plain image
/// arithmetic for the walls. It works in a basement with no signal and costs
/// nothing per plan.
///
/// The method is the one worked out by hand on the owner's two reference
/// plans, turned into steps:
///
/// 1. **Read the labels.** Names ("BEDROOM 4"), printed sizes ("11-4 x
///    12-6") and ceiling heights, with the recogniser's usual slips mended
///    ("EOYER" → Foyer, "140×146" → 14-0 × 14-6).
/// 2. **Find each room as the paper its label sits on.** Door and window
///    gaps are sealed first, so a room is an enclosed patch of paper; a
///    patch holding two labels (a kitchen open to its breakfast nook) is cut
///    at its narrowest point between them.
/// 3. **Snap every wall to the ink.** Each edge moves to the strongest
///    paper-to-wall step near it; an edge with no wall of its own (an open
///    side, a wall that is all garage door) takes the nearest wall another
///    room did find.
/// 4. **Scale from the printed sizes** — the median of the ones that agree
///    with their drawn rooms. The drawing is then kept as drawn: on the
///    owner's second plan the Foyer is labelled 11'-0" but drawn as deep as
///    the 11'-6" bedroom beside it, and typing the label is what left a gap
///    at the porch.
/// 5. **Doors and windows are the gaps in each room's walls.** A clean gap
///    is a door or an opening; a gap crossed by thin glazing lines is a
///    window.
enum PlanReader {
    struct Reading {
        var rooms: [PlanImportResult.Room]
        var notes: [String]
        /// Pixels per metre on the working image, and where floor metres
        /// start on it — for drawing the result back over the original.
        var scale: Double
        var origin: CGPoint
        var workingSize: CGSize
    }

    enum Failure: LocalizedError {
        case unreadable, noRooms, noScale
        var errorDescription: String? {
            switch self {
            case .unreadable: return "That image could not be read as a plan."
            case .noRooms: return "No labelled rooms were found on that plan."
            case .noScale:
                return "No room sizes could be read, so the plan's scale is unknown. A plan with sizes printed in the rooms works best."
            }
        }
    }

    static func read(_ image: CGImage) throws -> Reading {
        guard let sheet = Sheet(image) else { throw Failure.unreadable }
        let labels = Labels.read(image, size: sheet.size)
        var notes: [String] = []

        // Labels are erased before the walls are looked for: text inside a
        // room would otherwise split it, and a label's strokes read as wall.
        var ink = sheet.ink
        var faint = sheet.faint
        for label in labels.all {
            ink.clear(label.box.insetBy(dx: -2, dy: -2))
            faint.clear(label.box.insetBy(dx: -2, dy: -2))
        }
        let paper = Paper(ink: ink, faint: faint)

        let found = Rooms.find(labels: labels.rooms, sealInk: paper.sealInk, reach: paper.reach)
        guard let rough = firstScale(found.candidates, labels: labels) else { throw Failure.noScale }

        var candidates = found.candidates
        secondLook(&candidates, labels: labels, paper: paper, rough: rough)
        let shares = shareOut(candidates, labels: labels, paper: paper)
        let placed = place(candidates, labels: labels, shares: shares, rough: rough)
        var rooms = placed.rooms
        if !placed.bySize.isEmpty {
            notes.append("Placed by their printed size (open to a neighbour, or the drawing was unclear): \(placed.bySize.joined(separator: ", ")).")
        }
        if !placed.dropped.isEmpty {
            notes.append("Not drawn — no walls round \(placed.dropped.count == 1 ? "it" : "them") and no size printed: \(placed.dropped.joined(separator: ", ")).")
        }
        guard !rooms.isEmpty else { throw Failure.noRooms }

        let extra = Rooms.unlabelled(
            region: found.region, sealed: found.sealed, reach: paper.reach, scale: rough, cell: found.cell)
        if !extra.isEmpty {
            rooms += extra
            notes.append("\(extra.count) unlabelled space\(extra.count == 1 ? "" : "s") (\(extra.map(\.name).joined(separator: ", "))) named by shape — check \(extra.count == 1 ? "it" : "them").")
        }

        settle(&rooms, paper: paper, rough: rough, longEdge: Double(max(sheet.size.width, sheet.size.height)))

        let scale =
            Geometry.estimateScale(rooms.map { ($0.polygon, $0.printedSize) }, imperial: labels.imperial)
            ?? Geometry.estimateScale(areas: rooms.compactMap { r in r.printedArea.map { (r.polygon, $0.squareMetres) } })
            ?? rough

        let openings = Openings.find(
            rooms: rooms, walls: paper.walls, lines: paper.faint, thickness: paper.thickness, scale: scale)
        let assembled = Geometry.assemble(rooms, openings: openings, scale: scale, imperial: labels.imperial)
        let unsized = rooms.filter { $0.printedSize == nil }.count
        if unsized > 0 {
            notes.append("\(unsized) space\(unsized == 1 ? "" : "s") had no size printed; \(unsized == 1 ? "it was" : "they were") measured off the drawing.")
        }
        return Reading(
            rooms: assembled.rooms, notes: notes, scale: scale, origin: assembled.origin,
            workingSize: sheet.size)
    }

    // `read` is kept to a list of steps on purpose: as one long function
    // the optimiser took fifteen minutes over it — a release build that
    // never finishes.

    /// The plan's ink in the forms the steps need.
    private struct Paper {
        let ink: InkMask
        let faint: InkMask
        let thickness: Int
        /// Walls without the thin lines: fixtures, counters, glazing, door
        /// arcs, dashes. Used to find wall FACES.
        let walls: InkMask
        /// What seals a room: the walls, plus long thin lines — glazing and
        /// door arcs close their gaps — but not short ones. A dashed tray
        /// ceiling or a dashed garage-door track is a row of short lines,
        /// and sealing on it boxed the master bedroom into its own ceiling.
        let sealInk: InkMask
        let reach: Int

        init(ink: InkMask, faint: InkMask) {
            self.ink = ink
            self.faint = faint
            thickness = ink.wallThickness()
            walls = ink.eroded(max(1, thickness / 3)).dilated(max(1, thickness / 3))
            sealInk = walls.union(ink.subtracting(walls).keepingComponents(longerThan: thickness * 4))
            reach = max(4, Int(Double(thickness) * 4.2))
        }
    }

    /// A first scale from the rooms that are plainly themselves: one label,
    /// walls all round — by their printed sides, else their printed areas.
    private static func firstScale(_ candidates: [Rooms.Candidate], labels: Labels) -> Double? {
        let plain = candidates.compactMap { c -> ([CGPoint], String?)? in
            guard case .enclosed(let outline) = c.shape else { return nil }
            return (outline, labels.rooms[c.label].printedSize)
        }
        let plainAreas = candidates.compactMap { c -> ([CGPoint], Double)? in
            guard case .enclosed(let outline) = c.shape, let area = labels.rooms[c.label].printedArea else { return nil }
            return (outline, area.squareMetres)
        }
        return Geometry.estimateScale(plain, imperial: labels.imperial) ?? Geometry.estimateScale(areas: plainAreas)
    }

    /// A second look for the rooms the first could not enclose and has no
    /// printed sides to place by — a room full of furniture, or a plan that
    /// prints areas. The first look gave the scale; doors are under a metre
    /// wide, so gaps are now sealed by 45 cm a side, and thin lines seal
    /// only where they run wall to wall (glazing): a bed's outline or a
    /// door's swing no longer cuts a bedroom in two.
    private static func secondLook(_ candidates: inout [Rooms.Candidate], labels: Labels, paper: Paper, rough: Double) {
        let lost = candidates.indices.filter { i in
            if case .enclosed = candidates[i].shape { return false }
            return labels.rooms[candidates[i].label].printedSize == nil
        }
        guard !lost.isEmpty else { return }
        let glazed = paper.walls.union(
            paper.ink.subtracting(paper.walls).keepingGlazing(walls: paper.walls, thickness: paper.thickness))
        let second = Rooms.secondLook(
            labels: labels.rooms, which: lost.map { candidates[$0].label }, sealInk: glazed,
            reach: max(3, Int(0.45 * rough)))
        for i in lost {
            if let better = second[candidates[i].label] { candidates[i] = better }
        }
    }

    /// Open-plan rooms with no printed sides: their share of the open space
    /// says where they are and their proportions. Rooms already traced are
    /// taken out of the paper, and nothing past the outermost walls counts —
    /// a window gap otherwise lets a share run round the outside of the
    /// house.
    private static func shareOut(_ candidates: [Rooms.Candidate], labels: Labels, paper: Paper) -> [Int: CGRect] {
        let wanting = candidates.filter { c in
            if case .enclosed = c.shape { return false }
            return labels.rooms[c.label].printedSize == nil
        }.map(\.label)
        guard !wanting.isEmpty else { return [:] }
        var blocked = paper.sealInk.dilated(paper.reach)
        for candidate in candidates {
            guard case .enclosed(let outline) = candidate.shape else { continue }
            blocked.fill(outline)
        }
        return Rooms.shares(
            of: labels.rooms, indices: wanting, sealed: blocked, reach: paper.reach, within: paper.walls.extent)
    }

    /// Each candidate made a room: its tracing, or a rectangle of its
    /// printed size (or area) where the drawing cannot say.
    private static func place(_ candidates: [Rooms.Candidate], labels: Labels, shares: [Int: CGRect], rough: Double)
        -> (rooms: [FoundRoom], bySize: [String], dropped: [String])
    {
        var rooms: [FoundRoom] = []
        var bySize: [String] = []
        var dropped: [String] = []
        for candidate in candidates {
            let label = labels.rooms[candidate.label]
            guard let (polygon, sized) = outline(of: candidate, label: label, imperial: labels.imperial, share: shares[candidate.label], rough: rough)
            else {
                dropped.append(label.name)
                continue
            }
            if sized { bySize.append(label.name) }
            rooms.append(FoundRoom(
                name: label.name, roomType: Rooms.type(for: label.name), printedSize: label.printedSize,
                printedArea: label.printedArea, ceiling: label.ceiling, polygon: polygon, bySize: sized))
        }
        return (rooms, bySize, dropped)
    }

    private static func outline(
        of candidate: Rooms.Candidate, label: Labels.RoomLabel, imperial: Bool, share: CGRect?, rough: Double
    ) -> (polygon: [CGPoint], bySize: Bool)? {
        var size = label.printedSize.flatMap { Lengths.printedSize($0, imperial: imperial) }
        if size == nil, let share, let area = label.printedArea, share.width > 0, share.height > 0 {
            // The share's proportions, the printed area — never wider or
            // taller than the share itself, so the other side gives.
            let m2 = area.squareMetres
            let shareW = Double(share.width) / rough, shareH = Double(share.height) / rough
            var a = (m2 * shareW / shareH).squareRoot(), b = m2 / a
            if a > shareW { a = shareW; b = m2 / a }
            if b > shareH { b = shareH; a = m2 / b }
            size = (a, b)
        }
        switch candidate.shape {
        case .enclosed(let outline):
            // The drawing, unless it plainly is not the room the label
            // describes — a tub's outline or shelving cut it short.
            if let (a, b) = size, !Geometry.fits(Geometry.bounds(outline), a * rough, b * rough, tolerance: 0.2) {
                return (Geometry.rectangle(around: label.centre, size: (a, b), scale: rough, within: candidate.regionBox), true)
            }
            return (outline, false)
        case .open, .unbounded:
            // Open to its neighbours, or to the outside: placed by its
            // printed size, centred on its label (or its share), then
            // snapped. With no size or area at all — UTILITIES behind a
            // storage room's door — its share of the paper, snapped like a
            // tracing.
            if size == nil, label.printedArea == nil, let share {
                let box = [
                    CGPoint(x: share.minX, y: share.minY), CGPoint(x: share.maxX, y: share.minY),
                    CGPoint(x: share.maxX, y: share.maxY), CGPoint(x: share.minX, y: share.maxY),
                ]
                return (box, false)
            }
            guard let (a, b) = size else { return nil }
            var within: CGRect? = share
            if within == nil, case .open = candidate.shape { within = candidate.regionBox }
            let centre = share.map { CGPoint(x: $0.midX, y: $0.midY) } ?? label.centre
            return (Geometry.rectangle(around: centre, size: (a, b), scale: rough, within: within), true)
        }
    }

    /// Snap, then line loose edges up with walls other rooms found. The
    /// search reaches 0.7 m: a kitchen's counters run along its walls and
    /// the room's rough outline stops at the counter, not the wall.
    private static func settle(_ rooms: inout [FoundRoom], paper: Paper, rough: Double, longEdge: Double) {
        let snapReach = max(6, Int(max(longEdge * 0.02, 0.7 * rough)))
        for i in rooms.indices {
            let snapped = Geometry.snap(rooms[i].polygon, walls: paper.walls, ink: paper.ink, reach: snapReach)
            if rooms[i].bySize {
                let moved = Geometry.translated(
                    rooms[i].polygon, toward: snapped.polygon, flags: snapped.edgeSnapped, tolerance: 0.15 * rough)
                rooms[i].polygon = moved.polygon
                rooms[i].edgeSnapped = moved.edgeSnapped
            } else {
                rooms[i].polygon = snapped.polygon
                rooms[i].edgeSnapped = snapped.edgeSnapped
            }
        }
        Geometry.pushClear(&rooms, gap: Double(paper.thickness))
        // A room placed by its size keeps that size: none of its sides is
        // loose for this purpose.
        let lined = Geometry.alignLooseEdges(
            rooms.map { ($0.polygon, $0.bySize ? $0.edgeSnapped.map { _ in true } : $0.edgeSnapped) },
            reach: snapReach, alongLimit: longEdge * 0.25)
        for i in rooms.indices { rooms[i].polygon = lined[i] }
    }
}

/// A drawn plan read into rooms — what `PlanReader` produces and
/// `PlanImportSheet` files.
struct PlanImportResult {
    struct Point { let x: Double; let y: Double }
    struct Opening {
        let edge: Int
        let offset: Double
        let width: Double
        let kind: String
    }
    struct Room: Identifiable {
        var id: String { "\(name)-\(planX)-\(planY)" }
        let name: String
        let roomType: String
        let outdoor: Bool
        let ceilingHeightM: Double?
        /// The room's own metres, its min corner at 0,0.
        let polygon: [Point]
        /// Where that corner sits on the floor, metres.
        let planX: Double
        let planY: Double
        let openings: [Opening]
        let printedSize: String?
        let note: String?

        var size: (w: Double, h: Double) {
            (polygon.map(\.x).max() ?? 0, polygon.map(\.y).max() ?? 0)
        }
    }

    let rooms: [Room]
    let notes: [String]
}


// MARK: - The sheet: the image as ink and paper

/// A binary picture: 1 is ink.
struct InkMask {
    let width: Int
    let height: Int
    var bits: [UInt8]

    subscript(x: Int, y: Int) -> UInt8 {
        x < 0 || y < 0 || x >= width || y >= height ? 0 : bits[y * width + x]
    }

    /// The box round all the ink — the house, outermost walls included.
    var extent: CGRect {
        var minX = width, maxX = -1, minY = height, maxY = -1
        for y in 0..<height {
            for x in 0..<width where bits[y * width + x] == 1 {
                minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
            }
        }
        return maxX < 0 ? .zero : CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
    }

    /// Ink laid over a polygon's inside — a room already traced, taken out
    /// of the paper.
    mutating func fill(_ polygon: [CGPoint]) {
        let box = Geometry.bounds(polygon)
        let x0 = max(0, Int(box.minX)), x1 = min(width, Int(box.maxX.rounded(.up)))
        let y0 = max(0, Int(box.minY)), y1 = min(height, Int(box.maxY.rounded(.up)))
        guard x0 < x1, y0 < y1 else { return }
        for y in y0..<y1 {
            for x in x0..<x1 where Geometry.contains(polygon, CGPoint(x: Double(x) + 0.5, y: Double(y) + 0.5)) {
                bits[y * width + x] = 1
            }
        }
    }

    mutating func clear(_ rect: CGRect) {
        let x0 = max(0, Int(rect.minX)), x1 = min(width, Int(rect.maxX.rounded(.up)))
        let y0 = max(0, Int(rect.minY)), y1 = min(height, Int(rect.maxY.rounded(.up)))
        guard x0 < x1, y0 < y1 else { return }
        for y in y0..<y1 { for x in x0..<x1 { bits[y * width + x] = 0 } }
    }

    /// Summed-area table, so a square neighbourhood is counted in O(1).
    private func integral() -> [Int32] {
        let w1 = width + 1
        var table = [Int32](repeating: 0, count: w1 * (height + 1))
        for y in 0..<height {
            var row: Int32 = 0
            for x in 0..<width {
                row += Int32(bits[y * width + x])
                table[(y + 1) * w1 + x + 1] = table[y * w1 + x + 1] + row
            }
        }
        return table
    }

    private func neighbourhood(_ r: Int, keep: (Int32, Int32) -> Bool) -> InkMask {
        let table = integral()
        let w1 = width + 1
        var out = [UInt8](repeating: 0, count: bits.count)
        for y in 0..<height {
            let y0 = max(0, y - r), y1 = min(height, y + r + 1)
            for x in 0..<width {
                let x0 = max(0, x - r), x1 = min(width, x + r + 1)
                let sum = table[y1 * w1 + x1] - table[y0 * w1 + x1] - table[y1 * w1 + x0] + table[y0 * w1 + x0]
                if keep(sum, Int32((x1 - x0) * (y1 - y0))) { out[y * width + x] = 1 }
            }
        }
        return InkMask(width: width, height: height, bits: out)
    }

    func dilated(_ r: Int) -> InkMask { neighbourhood(r) { sum, _ in sum > 0 } }

    func union(_ other: InkMask) -> InkMask {
        InkMask(width: width, height: height, bits: zip(bits, other.bits).map { $0 | $1 })
    }

    func subtracting(_ other: InkMask) -> InkMask {
        InkMask(width: width, height: height, bits: zip(bits, other.bits).map { $0 & (1 - $1) })
    }

    /// Only the connected strokes whose extent reaches `length` pixels.
    func keepingComponents(longerThan length: Int) -> InkMask {
        keepingComponents { box, _ in max(box.width, box.height) >= CGFloat(length) }
    }

    /// Straight thin lines that run from wall to wall — the glazing drawn
    /// across a window — and nothing else thin: not a bed's outline, a
    /// counter, or a door's leaf and swing, which touch a wall at one end
    /// at most.
    func keepingGlazing(walls: InkMask, thickness: Int) -> InkMask {
        let near = walls.dilated(3)
        return keepingComponents { box, members in
            let long = max(box.width, box.height), thin = min(box.width, box.height)
            guard long >= CGFloat(thickness * 2), thin <= CGFloat(thickness) * 1.5 else { return false }
            let horizontal = box.width >= box.height
            let ends = horizontal
                ? (members.min { $0.x < $1.x }!, members.max { $0.x < $1.x }!)
                : (members.min { $0.y < $1.y }!, members.max { $0.y < $1.y }!)
            return near[ends.0.x, ends.0.y] == 1 && near[ends.1.x, ends.1.y] == 1
        }
    }

    func keepingComponents(where keep: (CGRect, [(x: Int, y: Int)]) -> Bool) -> InkMask {
        var label = [Int32](repeating: -1, count: bits.count)
        var out = [UInt8](repeating: 0, count: bits.count)
        var next: Int32 = 0
        for start in bits.indices where bits[start] == 1 && label[start] == -1 {
            var stack = [start], members: [Int] = []
            label[start] = next
            var minX = width, maxX = 0, minY = height, maxY = 0
            while let p = stack.popLast() {
                members.append(p)
                let x = p % width, y = p / width
                minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
                for dy in -1...1 {
                    for dx in -1...1 where dx != 0 || dy != 0 {
                        let nx = x + dx, ny = y + dy
                        guard nx >= 0, ny >= 0, nx < width, ny < height else { continue }
                        let q = ny * width + nx
                        if bits[q] == 1 && label[q] == -1 { label[q] = next; stack.append(q) }
                    }
                }
            }
            let box = CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
            if keep(box, members.map { (x: $0 % width, y: $0 / width) }) { for p in members { out[p] = 1 } }
            next += 1
        }
        return InkMask(width: width, height: height, bits: out)
    }
    func eroded(_ r: Int) -> InkMask { neighbourhood(r) { sum, area in sum == area } }

    /// How thick the partitions are drawn: the thinnest run of ink across a
    /// line that is common — at least a quarter as common as the commonest —
    /// counting runs of 3 px or more so hairlines and text do not vote.
    /// Not simply the commonest: a plan that draws its outside walls twice
    /// as thick as its partitions (the owner's first plan, 22 px against 9)
    /// had every partition erased as "thin line" and every gap sealed at
    /// twice a door's width.
    func wallThickness() -> Int {
        var votes = [Int](repeating: 0, count: 61)
        func count(_ run: Int) { if run >= 3 && run <= 60 { votes[run] += 1 } }
        for y in stride(from: 0, to: height, by: 2) {
            var run = 0
            for x in 0..<width {
                if bits[y * width + x] == 1 { run += 1 } else { count(run); run = 0 }
            }
            count(run)
        }
        for x in stride(from: 0, to: width, by: 2) {
            var run = 0
            for y in 0..<height {
                if bits[y * width + x] == 1 { run += 1 } else { count(run); run = 0 }
            }
            count(run)
        }
        let most = votes.max() ?? 0
        guard most > 0 else { return 5 }
        return (3..<60).first { run in
            votes[run] * 4 >= most && votes[run] >= votes[run - 1] && votes[run] >= votes[run + 1]
        } ?? (votes.indices.max { votes[$0] < votes[$1] } ?? 5)
    }

    /// Ink along a horizontal or vertical line, as a fraction of its length.
    func coverage(horizontal: Bool, line: Int, from: Double, to: Double) -> Double {
        let limit = horizontal ? height : width
        guard line >= 0, line < limit else { return 0 }
        let a = max(0, Int(from)), b = min(horizontal ? width : height, Int(to.rounded(.up)))
        guard b - a >= 2 else { return 0 }
        var dark = 0
        for i in a..<b { dark += Int(horizontal ? bits[line * width + i] : bits[i * width + line]) }
        return Double(dark) / Double(b - a)
    }
}

/// The plan resized once to a working size and split into ink and paper by
/// the threshold that best separates them (Otsu's), so a photo of a printed
/// sheet in poor light works as well as a clean PDF.
struct Sheet {
    let size: CGSize
    let ink: InkMask
    /// Everything visibly darker than the paper — the grey lines a plan
    /// draws its glazing and door swings in, which the ink threshold
    /// drops. Never used for walls; only to tell a window from a door.
    let faint: InkMask

    static let targetPixels = 2_000_000.0

    init?(_ image: CGImage) {
        let scale = min(1.6, sqrt(Self.targetPixels / Double(image.width * image.height)))
        let w = max(1, Int(Double(image.width) * scale)), h = max(1, Int(Double(image.height) * scale))
        guard w >= 100, h >= 100 else { return nil }
        var grey = [UInt8](repeating: 255, count: w * h)
        guard let context = CGContext(
            data: &grey, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
            space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)
        else { return nil }
        context.setFillColor(gray: 1, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: w, height: h))
        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))

        var histogram = [Double](repeating: 0, count: 256)
        for v in grey { histogram[Int(v)] += 1 }
        let threshold = min(170, max(60, Self.otsu(histogram)))
        size = CGSize(width: w, height: h)
        // With `data` supplied, row 0 of the buffer is the TOP of the image.
        ink = InkMask(width: w, height: h, bits: grey.map { $0 < threshold ? 1 : 0 })
        // The paper is the commonest light grey (white, or a plan's yellow
        // fill); faint is anything 35 levels under it.
        let paper = (Int(threshold)..<256).max { histogram[$0] < histogram[$1] } ?? 255
        let faintBelow = UInt8(max(Int(threshold), paper - 35))
        faint = InkMask(width: w, height: h, bits: grey.map { $0 < faintBelow ? 1 : 0 })
    }

    static func otsu(_ histogram: [Double]) -> UInt8 {
        let total = histogram.reduce(0, +)
        let sum = histogram.enumerated().reduce(0) { $0 + Double($1.offset) * $1.element }
        var weightB = 0.0, sumB = 0.0, best = 0.0, threshold = 128
        for t in 0..<256 {
            weightB += histogram[t]
            guard weightB > 0 else { continue }
            let weightF = total - weightB
            guard weightF > 0 else { break }
            sumB += Double(t) * histogram[t]
            let meanB = sumB / weightB, meanF = (sum - sumB) / weightF
            let between = weightB * weightF * (meanB - meanF) * (meanB - meanF)
            if between > best { best = between; threshold = t }
        }
        return UInt8(threshold)
    }
}

// MARK: - Labels

struct Labels {
    struct Text {
        let string: String
        let box: CGRect
    }
    struct RoomLabel {
        var name: String
        var box: CGRect
        var printedSize: String?
        /// "137 sq ft", "12.7 m²" — what a plan or a report prints when it
        /// gives areas rather than sides.
        var printedArea: PrintedArea?
        var ceiling: Double?
        var centre: CGPoint { CGPoint(x: box.midX, y: box.midY) }
        var searchRadius: Int { Int(max(box.width, box.height) / 2) + 12 }
    }

    var all: [Text]
    var rooms: [RoomLabel]
    /// Whether sizes are feet-and-inches — decides how "9.10" is read.
    var imperial: Bool

    static func read(_ image: CGImage, size: CGSize) -> Labels {
        // Upright, then turned each way: plans write HALL and ENTRY up the
        // side of a narrow room, and the recogniser reads only level text.
        var texts = recognise(image, orientation: .up, size: size)
        for turned in [CGImagePropertyOrientation.right, .left] {
            for text in recognise(image, orientation: turned, size: size)
            where !texts.contains(where: { overlap($0.box, text.box) > 0.3 }) {
                texts.append(text)
            }
        }

        let imperial = texts.contains {
            $0.string.range(of: #"\d+\s*[-'’]\s*\d|sq\.?\s*ft|ft²|pi²"#, options: [.regularExpression, .caseInsensitive]) != nil
        }
        var names: [RoomLabel] = []
        var sizes: [Text] = []
        var areas: [(Text, PrintedArea)] = []
        var ceilings: [(Text, Double)] = []
        for text in texts {
            if let height = ceilingHeight(text.string) {
                ceilings.append((text, height))
            } else if let area = Lengths.area(text.string) {
                areas.append((text, area))
            } else if Lengths.printedSize(text.string, imperial: imperial) != nil {
                sizes.append(text)
            } else if let name = roomName(text.string) {
                names.append(RoomLabel(name: name, box: text.box))
            }
        }

        // Two-line names: "MASTER" over "BEDROOM", "TWO CAR" over "GARAGE".
        names.sort { $0.box.minY < $1.box.minY }
        var merged: [RoomLabel] = []
        for label in names {
            if label.box.width >= label.box.height, let i = merged.lastIndex(where: { above in
                guard above.box.width >= above.box.height else { return false }
                let gap = label.box.minY - above.box.maxY
                let overlap = min(above.box.maxX, label.box.maxX) - max(above.box.minX, label.box.minX)
                return gap > -above.box.height * 0.3 && gap < above.box.height * 0.9 && overlap > min(above.box.width, label.box.width) * 0.3
            }), !merged[i].name.contains(" \(label.name)") {
                merged[i].name = Labels.titled("\(merged[i].name) \(label.name)")
                merged[i].box = merged[i].box.union(label.box)
            } else {
                merged.append(label)
            }
        }

        // A size or ceiling belongs to the name just above it.
        func nearestName(below text: Text) -> Int? {
            merged.indices
                .filter { i in
                    let name = merged[i].box
                    let gap = text.box.minY - name.maxY
                    let overlap = min(name.maxX, text.box.maxX) - max(name.minX, text.box.minX)
                    return gap > -name.height && gap < name.height * 3 && overlap > -name.height
                }
                .min { abs(text.box.minY - merged[$0].box.maxY) < abs(text.box.minY - merged[$1].box.maxY) }
        }
        for size in sizes {
            if let i = nearestName(below: size), merged[i].printedSize == nil {
                merged[i].printedSize = size.string
                merged[i].box = merged[i].box.union(size.box)
            }
        }
        for (text, area) in areas {
            if let i = nearestName(below: text), merged[i].printedArea == nil {
                merged[i].printedArea = area
                merged[i].box = merged[i].box.union(text.box)
            }
        }
        for (text, height) in ceilings {
            if let i = nearestName(below: text) {
                merged[i].ceiling = height > 0 ? height : nil
                merged[i].box = merged[i].box.union(text.box)
            }
        }

        // Only a label with a printed size or a room word is a room. A plan
        // also labels its fixtures — OVEN, TUB, REF, EATING BAR — and each of
        // those taken as a room would cut the real room it sits in.
        merged.removeAll { $0.printedSize == nil && $0.printedArea == nil && Rooms.type(for: $0.name) == "other" }

        // Duplicate names get numbers, the way a plan would print them.
        var seen: [String: Int] = [:]
        for name in merged.map(\.name) { seen[name, default: 0] += 1 }
        var counter: [String: Int] = [:]
        for i in merged.indices where (seen[merged[i].name] ?? 0) > 1 {
            counter[merged[i].name, default: 0] += 1
            merged[i].name += " \(counter[merged[i].name]!)"
        }
        return Labels(all: texts, rooms: merged, imperial: imperial)
    }

    private static func recognise(_ image: CGImage, orientation: CGImagePropertyOrientation, size: CGSize) -> [Text] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.recognitionLanguages = ["en-US", "fr-CA"]
        try? VNImageRequestHandler(cgImage: image, orientation: orientation).perform([request])
        let W = size.width, H = size.height
        return (request.results ?? []).compactMap { observation in
            guard let string = observation.topCandidates(1).first?.string else { return nil }
            let b = observation.boundingBox
            // Corners in the turned image's own top-left pixels, then back to
            // the sheet. `.right`: the sheet turned 90° clockwise, so it is H
            // wide and W tall; `.left`: turned counter-clockwise.
            let corners: [CGPoint]
            switch orientation {
            case .right:
                corners = [(b.minX, b.minY), (b.maxX, b.maxY)].map { u, v in
                    let X = u * H, Y = (1 - v) * W
                    return CGPoint(x: Y, y: H - X)
                }
            case .left:
                corners = [(b.minX, b.minY), (b.maxX, b.maxY)].map { u, v in
                    let X = u * H, Y = (1 - v) * W
                    return CGPoint(x: W - Y, y: X)
                }
            default:
                corners = [CGPoint(x: b.minX * W, y: (1 - b.maxY) * H), CGPoint(x: b.maxX * W, y: (1 - b.minY) * H)]
            }
            let xs = corners.map(\.x), ys = corners.map(\.y)
            return Text(
                string: string.trimmingCharacters(in: .whitespaces),
                box: CGRect(x: xs.min()!, y: ys.min()!, width: xs.max()! - xs.min()!, height: ys.max()! - ys.min()!))
        }
    }

    private static func overlap(_ a: CGRect, _ b: CGRect) -> Double {
        let i = a.intersection(b)
        guard !i.isNull else { return 0 }
        return Double(i.width * i.height) / Double(min(a.width * a.height, b.width * b.height))
    }

    /// "10' CLG. HT.", "10 CLÓ.HT.", "11'-6\" CEILING" → metres; nil if this
    /// is not a ceiling label or the number is not a believable ceiling.
    static func ceilingHeight(_ raw: String) -> Double? {
        let text = raw.uppercased()
        guard text.contains("HT") || text.contains("CEIL") else { return nil }
        guard let match = text.range(of: #"^\s*(\d{1,2})\s*[°'’\-]?\s*(\d{1,2})?"#, options: .regularExpression)
        else { return 0 }
        let numbers = text[match].split(whereSeparator: { !$0.isNumber }).compactMap { Double($0) }
        guard let feet = numbers.first, (7...14).contains(feet) else { return 0 }
        let inches = numbers.count > 1 && numbers[1] < 12 ? numbers[1] : 0
        return (feet + inches / 12) * 0.3048
    }

    private static let vocabulary = [
        "BEDROOM", "BATH", "BATHROOM", "KITCHEN", "DINING", "LIVING", "GREAT", "ROOM", "FAMILY", "FOYER",
        "ENTRY", "HALL", "HALLWAY", "CLOSET", "PANTRY", "LAUNDRY", "GARAGE", "PORCH", "DECK", "PATIO",
        "BALCONY", "STORAGE", "OFFICE", "STUDY", "DEN", "MASTER", "PRIMARY", "BREAKFAST", "NOOK", "MUD",
        "UTILITY", "MECHANICAL", "LINEN", "POWDER", "SUITE", "REAR", "FRONT", "CAR", "TWO", "THREE",
        "WALK-IN", "BONUS", "LOFT", "MEDIA", "GUEST", "OPEN", "TO", "BELOW", "CHAMBRE", "CUISINE",
        "SALON", "SALLE", "BAIN", "ENTREE", "GARDE-ROBE", "BUREAU", "BUANDERIE", "SOUS-SOL", "WIC",
    ]

    /// A room name, mended, or nil if this text is not one.
    static func roomName(_ raw: String) -> String? {
        let cleaned = raw.uppercased().replacingOccurrences(of: #"[^A-Z0-9\- ]"#, with: "", options: .regularExpression)
        let words = cleaned.split(separator: " ").map(String.init).filter { !$0.isEmpty }
        let letters = cleaned.filter(\.isLetter).count
        // Mostly Latin letters, at least three of them; Cyrillic or noise
        // from a fixture symbol is dropped.
        guard letters >= 3, Double(letters) >= Double(raw.count) * 0.6 else { return nil }
        let abbreviations = ["CLOS": "CLOSET", "CL": "CLOSET", "WIC": "WALK-IN CLOSET", "MBR": "MASTER BEDROOM", "BR": "BEDROOM", "BDRM": "BEDROOM", "BEDRM": "BEDROOM", "LIN": "LINEN", "DN": "DOWN", "UP": "UP", "IWO": "TWO", "TW0": "TWO"]
        let mended = words.map { word -> String in
            if let full = abbreviations[word] { return full }
            if word.count >= 4, !vocabulary.contains(word),
                let fix = vocabulary.first(where: { $0.count == word.count && distance($0, word) == 1 })
            {
                return fix
            }
            return word
        }
        let joined = mended.joined(separator: " ")
        // Stair and note text is not a room.
        if ["UP", "DOWN", "DN", "OPEN TO BELOW", "BUILT-IN", "BUILTIN"].contains(joined) { return nil }
        return titled(joined)
    }

    static func titled(_ text: String) -> String {
        text.lowercased().split(separator: " ").map { word in
            word.split(separator: "-").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: "-")
        }.joined(separator: " ")
    }

    private static func distance(_ a: String, _ b: String) -> Int {
        zip(a, b).filter { $0 != $1 }.count
    }
}

// MARK: - Lengths

enum Lengths {
    static let foot = 0.3048

    /// One printed length in metres. `imperial` decides "9.10" (nine feet
    /// ten) against "5.69" (metres).
    static func length(_ raw: String, imperial: Bool) -> Double? {
        var text = raw.lowercased()
            .replacingOccurrences(of: "’", with: "'").replacingOccurrences(of: "”", with: "\"")
            .replacingOccurrences(of: "°", with: "'").replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "o", with: "0")
        text = text.replacingOccurrences(of: #"[\"]$"#, with: "", options: .regularExpression)
        if !imperial, let metres = Double(text.replacingOccurrences(of: "m", with: "").replacingOccurrences(of: ",", with: ".")),
            metres > 0.3, metres < 40
        {
            return metres
        }
        if imperial { text = text.replacingOccurrences(of: ".", with: "-") }
        let parts = text.split(whereSeparator: { $0 == "-" || $0 == "'" }).map(String.init).filter { !$0.isEmpty }
        func number(_ s: String) -> Double? { Double(s.filter { $0.isNumber || $0 == "." }) }
        if parts.count >= 2, let feet = number(parts[0]), var inches = number(parts[1]) {
            // "5-81": a stray stroke read as a digit; keep the first.
            if inches >= 12, parts[1].count == 2 { inches = Double(String(parts[1].prefix(1))) ?? 0 }
            guard inches < 12 else { return nil }
            return (feet + inches / 12) * foot
        }
        if parts.count == 1, let digits = Optional(parts[0].filter(\.isNumber)), digits.count == parts[0].count {
            // "140" with the dash lost: 14-0. "1010": 10-10.
            if digits.count == 3, let f = Double(digits.prefix(2)), let i = Double(digits.suffix(1)) { return (f + i / 12) * foot }
            if digits.count == 4, let f = Double(digits.prefix(2)), let i = Double(digits.suffix(2)), i < 12 { return (f + i / 12) * foot }
            if digits.count == 2, text.hasSuffix("'") == false, let f = Double(digits.prefix(1)), let i = Double(digits.suffix(1)) {
                return (f + i / 12) * foot
            }
            if let f = Double(digits), text.hasSuffix("'") { return f * foot }
        }
        return nil
    }

    /// "137 sq ft", "57 sq. ft.", "12,7 m²", "85 pi²" → square metres.
    static func area(_ raw: String) -> PrintedArea? {
        let pattern = #"^(\d+(?:[.,]\d+)?)\s*(sq\.?\s*f[tl]?\.?|ft2|ft²|sf|pi2|pi²|pc|p\.c\.|sq\.?\s*m\.?|m2|m²)$"#
        guard let match = raw.range(of: pattern, options: [.regularExpression, .caseInsensitive]) else { return nil }
        let text = String(raw[match])
        let number = text.prefix { $0.isNumber || $0 == "." || $0 == "," }.replacingOccurrences(of: ",", with: ".")
        guard let value = Double(number), value > 0 else { return nil }
        let unit = text.dropFirst(number.count).lowercased()
        let metric = unit.contains("m") && !unit.contains("sq ft")
        let m2 = metric ? value : value * foot * foot
        guard m2 > 0.5, m2 < 400 else { return nil }
        return PrintedArea(text: text, squareMetres: m2)
    }

    /// "12-10 x 11-6", "14-0x 12-6", "140×146" → two lengths.
    static func printedSize(_ raw: String, imperial: Bool) -> (Double, Double)? {
        let parts = raw.replacingOccurrences(of: "×", with: "x").replacingOccurrences(of: "X", with: "x")
            .split(separator: "x", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count == 2, let a = length(parts[0], imperial: imperial), let b = length(parts[1], imperial: imperial),
            a > 0.5, b > 0.5, a < 30, b < 30
        else { return nil }
        return (a, b)
    }
}

// MARK: - Rooms

struct PrintedArea {
    let text: String
    let squareMetres: Double
}

struct FoundRoom {
    var name: String
    var roomType: String
    var printedSize: String?
    var printedArea: PrintedArea?
    var ceiling: Double?
    var polygon: [CGPoint]
    var edgeSnapped: [Bool] = []
    var unbounded = false
    /// Placed from its printed size rather than traced: its size is the
    /// trusted fact, so it is moved to fit the walls, never stretched.
    var bySize = false
}

enum Rooms {
    static func type(for name: String) -> String {
        let n = name.lowercased()
        let table: [(String, [String])] = [
            ("closet", ["closet", "wic", "linen", "garde-robe"]),
            ("pantry", ["pantry"]),
            ("bathroom", ["bath", "powder", "wc", "salle de bain"]),
            ("bedroom", ["bed", "chambre", "suite"]),
            ("kitchen", ["kitchen", "cuisine"]),
            ("dining_room", ["dining", "breakfast", "nook"]),
            ("living_room", ["living", "great", "family", "den", "salon", "media"]),
            ("entry", ["foyer", "entry", "mud", "entree"]),
            ("hallway", ["hall"]),
            ("laundry", ["laundry", "buanderie"]),
            ("garage", ["garage"]),
            ("porch", ["porch"]),
            ("balcony", ["deck", "balcony", "patio"]),
            ("storage", ["storage"]),
            ("utility", ["utility", "utilities", "mechanical"]),
            ("office", ["office", "study", "bureau"]),
        ]
        return table.first { $0.1.contains(where: n.contains) }?.0 ?? "other"
    }

    struct Candidate {
        enum Shape {
            /// One label, walls all round: the traced outline.
            case enclosed([CGPoint])
            /// Shares its paper with other labelled rooms — open plan.
            case open
            /// Reaches the edge of the sheet even with wide gaps sealed.
            case unbounded
        }
        let label: Int
        let shape: Shape
        /// The paper's extent, for keeping a size-placed room inside it.
        let regionBox: CGRect?
    }

    /// Each label's patch of paper, door gaps sealed.
    ///
    /// The sealing shrinks every patch by its reach from every line, so a
    /// traced outline is moved back out by the same amount — side by side,
    /// not by growing the paper, which would leak through every doorway.
    /// A patch that reaches the sheet's edge is tried again with wider
    /// gaps sealed (a garage door is sixteen feet), up to six times the
    /// first reach.
    static func find(labels: [Labels.RoomLabel], sealInk: InkMask, reach: Int)
        -> (candidates: [Candidate], region: [Int32], sealed: InkMask, cell: Int)
    {
        let sealed = sealInk.dilated(reach)
        let w = sealed.width, h = sealed.height
        let cell = max(2, reach / 3)
        var region = [Int32](repeating: -1, count: w * h)
        var touchesEdge: [Bool] = []
        var seedsByRegion: [Int32: [Int]] = [:]

        var unseeded: [Int] = []
        for (index, label) in labels.enumerated() {
            // No paper left by the label once gaps are sealed: a closet
            // smaller than the sealing. Placed by its printed size instead.
            guard let seed = freePixel(near: label.centre, in: sealed, within: label.searchRadius) else {
                unseeded.append(index)
                continue
            }
            let existing = region[seed.y * w + seed.x]
            if existing >= 0 {
                seedsByRegion[existing, default: []].append(index)
                continue
            }
            let id = Int32(touchesEdge.count)
            touchesEdge.append(fill(from: seed, id: id, region: &region, sealed: sealed))
            seedsByRegion[id, default: []].append(index)
        }

        var boxes: [Int32: (Int, Int, Int, Int)] = [:]
        var pixelsByRegion: [Int32: [(Int, Int)]] = [:]
        for y in 0..<h {
            for x in 0..<w {
                let id = region[y * w + x]
                guard id >= 0 else { continue }
                pixelsByRegion[id, default: []].append((x, y))
                let b = boxes[id] ?? (x, y, x, y)
                boxes[id] = (min(b.0, x), min(b.1, y), max(b.2, x), max(b.3, y))
            }
        }
        func box(_ id: Int32) -> CGRect? {
            guard let b = boxes[id] else { return nil }
            return CGRect(x: b.0, y: b.1, width: b.2 - b.0, height: b.3 - b.1).insetBy(dx: -CGFloat(reach), dy: -CGFloat(reach))
        }

        var candidates: [Candidate] = []
        var wider: [Int: InkMask] = [:]
        var swallowed: [Int] = []
        for (id, allSeeds) in seedsByRegion {
            // Labels without a size give way to labels with one — a "LINEN"
            // cabinet inside a bathroom must not make the bathroom open plan.
            let sized = allSeeds.filter { labels[$0].printedSize != nil || labels[$0].printedArea != nil }
            let seeds = allSeeds.count > 1 && !sized.isEmpty ? sized : allSeeds
            swallowed += allSeeds.filter { !seeds.contains($0) }

            if touchesEdge[Int(id)] {
                for seed in seeds {
                    var outline: [CGPoint]?
                    for factor in [2, 3, 4, 6] {
                        let r = reach * factor
                        let mask = wider[factor] ?? sealInk.dilated(r)
                        wider[factor] = mask
                        guard let start = freePixel(near: labels[seed].centre, in: mask, within: labels[seed].searchRadius)
                        else { break }
                        var own = [Int32](repeating: -1, count: w * h)
                        if fill(from: start, id: 0, region: &own, sealed: mask) { continue }
                        var pixels: [(Int, Int)] = []
                        for p in own.indices where own[p] == 0 { pixels.append((p % w, p / w)) }
                        let traced = Outline.trace(pixels, width: w, height: h, cell: max(2, r / 3))
                            .map { Outline.offset($0, by: Double(r)) }
                        // Only this room's own if it holds its own label and
                        // no other sized label: wider sealing that swallows a
                        // neighbour will not get better with more.
                        if let traced, Geometry.contains(traced, labels[seed].centre),
                            !labels.indices.contains(where: { other in
                                other != seed && (labels[other].printedSize != nil || labels[other].printedArea != nil)
                                    && Geometry.contains(traced, labels[other].centre)
                            })
                        {
                            outline = traced
                        }
                        break
                    }
                    if let outline {
                        candidates.append(Candidate(label: seed, shape: .enclosed(outline), regionBox: Geometry.bounds(outline)))
                    } else {
                        candidates.append(Candidate(label: seed, shape: .unbounded, regionBox: nil))
                    }
                }
            } else if seeds.count == 1 {
                guard let outline = Outline.trace(pixelsByRegion[id] ?? [], width: w, height: h, cell: cell) else { continue }
                candidates.append(Candidate(
                    label: seeds[0], shape: .enclosed(Outline.offset(outline, by: Double(reach))), regionBox: box(id)))
            } else {
                for seed in seeds { candidates.append(Candidate(label: seed, shape: .open, regionBox: box(id))) }
            }
        }
        // Small rooms — a closet off a bedroom — whose paper vanished under
        // the sealing, or was swallowed by the bigger room next door: tried
        // again with gaps sealed tighter, just around their own label.
        let tight = max(2, reach * 3 / 5)
        let tightMask = sealInk.dilated(tight)
        for index in unseeded + swallowed {
            var outline: [CGPoint]?
            if let start = freePixel(near: labels[index].centre, in: tightMask, within: labels[index].searchRadius) {
                var own = [Int32](repeating: -1, count: w * h)
                if !fill(from: start, id: 0, region: &own, sealed: tightMask) {
                    var pixels: [(Int, Int)] = []
                    for p in own.indices where own[p] == 0 { pixels.append((p % w, p / w)) }
                    if let traced = Outline.trace(pixels, width: w, height: h, cell: max(2, tight / 3))
                        .map({ Outline.offset($0, by: Double(tight)) }),
                        Geometry.contains(traced, labels[index].centre),
                        !labels.indices.contains(where: { $0 != index && Geometry.contains(traced, labels[$0].centre) })
                    {
                        outline = traced
                    }
                }
            }
            if let outline {
                candidates.append(Candidate(label: index, shape: .enclosed(outline), regionBox: Geometry.bounds(outline)))
            } else if unseeded.contains(index) {
                candidates.append(Candidate(label: index, shape: .unbounded, regionBox: nil))
            } else {
                candidates.append(Candidate(label: index, shape: .open, regionBox: nil))
            }
        }
        return (candidates, region, sealed, cell)
    }

    /// Open-plan paper shared out between its labels: each pixel goes to
    /// the label it is the fewest steps from, walking round the walls, not
    /// through them. Each label's share, as a box grown back out by the
    /// sealing's reach — where in the open space that room is, and its
    /// proportions. Used for rooms that print an area but not their sides.
    static func shares(of labels: [Labels.RoomLabel], indices: [Int], sealed: InkMask, reach: Int, within house: CGRect) -> [Int: CGRect] {
        let w = sealed.width, h = sealed.height
        var owner = [Int32](repeating: -1, count: w * h)
        var queue: [Int] = []
        for index in indices {
            guard let seed = freePixel(near: labels[index].centre, in: sealed, within: labels[index].searchRadius) else { continue }
            let p = seed.y * w + seed.x
            guard owner[p] == -1 else { continue }
            owner[p] = Int32(index)
            queue.append(p)
        }
        var head = 0
        while head < queue.count {
            let p = queue[head]
            head += 1
            let x = p % w, y = p / w
            // Never out past the outermost walls: in from the outside
            // through a window gap, a porch's share took the bedrooms' sills.
            let x0 = Int(house.minX), x1 = Int(house.maxX) - 1, y0 = Int(house.minY), y1 = Int(house.maxY) - 1
            for q in [x + 1 <= x1 ? p + 1 : -1, x > x0 ? p - 1 : -1, y + 1 <= y1 ? p + w : -1, y > y0 ? p - w : -1]
            where q >= 0 && owner[q] == -1 && sealed.bits[q] == 0 {
                owner[q] = owner[p]
                queue.append(q)
            }
        }
        // Each share's box with its outermost 4% trimmed off each way: a
        // thin tendril — a sill, a passage between a bathroom and a sofa —
        // must not stretch a room across the plan.
        var xs: [Int: [Int]] = [:], ys: [Int: [Int]] = [:]
        for p in owner.indices where owner[p] >= 0 {
            xs[Int(owner[p]), default: []].append(p % w)
            ys[Int(owner[p]), default: []].append(p / w)
        }
        var out: [Int: CGRect] = [:]
        for (index, column) in xs {
            guard let row = ys[index], column.count > 50 else { continue }
            let sx = column.sorted(), sy = row.sorted()
            let cut = sx.count / 25
            let box = CGRect(
                x: sx[cut], y: sy[cut], width: sx[sx.count - 1 - cut] - sx[cut], height: sy[sy.count - 1 - cut] - sy[cut])
            out[index] = box.insetBy(dx: -CGFloat(reach), dy: -CGFloat(reach)).intersection(house)
        }
        return out
    }

    /// The second look (see `PlanReader.read`): each lost label's paper with
    /// gaps sealed by `reach`. Its own outline if the paper holds no other
    /// label; open plan, with the shared paper's extent, if it does.
    static func secondLook(labels: [Labels.RoomLabel], which: [Int], sealInk: InkMask, reach: Int) -> [Int: Candidate] {
        let sealed = sealInk.dilated(reach)
        let w = sealed.width, h = sealed.height
        var out: [Int: Candidate] = [:]
        for index in which {
            var own = [Int32](repeating: -1, count: w * h)
            var pixels: [(Int, Int)] = []
            for p in own.indices where own[p] == 0 { pixels.append((p % w, p / w)) }
            guard let traced = Outline.trace(pixels, width: w, height: h, cell: max(2, reach / 3))
                .map({ Outline.offset($0, by: Double(reach)) })
            else { continue }
            let others = labels.indices.filter { $0 != index && Geometry.contains(traced, labels[$0].centre) }
            out[index] = others.isEmpty
                ? Candidate(label: index, shape: .enclosed(traced), regionBox: Geometry.bounds(traced))
                : Candidate(label: index, shape: .open, regionBox: Geometry.bounds(traced))
        }
        return out
    }

    /// Enclosed paper no label claimed: a hall, a linen closet, a powder
    /// room whose label the recogniser could not read. Kept if it is big
    /// enough to stand in — at least 15 cm of paper left after sealing,
    /// which a bathtub or a kitchen island never is — and named by shape.
    static func unlabelled(region: [Int32], sealed: InkMask, reach: Int, scale: Double, cell: Int) -> [FoundRoom] {
        let w = sealed.width, h = sealed.height
        var claimed = region
        var next = (claimed.max() ?? -1) + 1
        var found: [FoundRoom] = []
        var counts: [String: Int] = [:]
        for start in 0..<(w * h) where claimed[start] == -1 && sealed.bits[start] == 0 {
            let id = next
            next += 1
            let touches = fill(from: (start % w, start / w), id: id, region: &claimed, sealed: sealed)
            guard !touches else { continue }
            var pixels: [(Int, Int)] = []
            var minX = w, maxX = 0, minY = h, maxY = 0
            for p in start..<(w * h) where claimed[p] == id {
                let x = p % w, y = p / w
                pixels.append((x, y))
                minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
            }
            let minimum = 0.15 * scale
            guard Double(maxX - minX) >= minimum, Double(maxY - minY) >= minimum,
                let outline = Outline.trace(pixels, width: w, height: h, cell: cell)
            else { continue }
            let polygon = Outline.offset(outline, by: Double(reach))
            let box = Geometry.bounds(polygon)
            let areaM = abs(Geometry.signedArea(polygon)) / (scale * scale)
            guard areaM >= 0.6, areaM <= 40 else { continue }
            let aspect = max(box.width, box.height) / max(min(box.width, box.height), 1)
            let (name, type) = aspect >= 2.5 ? ("Hall", "hallway") : (areaM < 4 ? ("Closet", "closet") : ("Room", "other"))
            counts[name, default: 0] += 1
            found.append(FoundRoom(
                name: counts[name]! > 1 ? "\(name) \(counts[name]!)" : name, roomType: type,
                printedSize: nil, ceiling: nil, polygon: polygon))
        }
        return found
    }

    /// Flood the sealed paper from a seed; true if it reached the sheet's
    /// edge — an outdoor space with no walls round it.
    private static func fill(from seed: (x: Int, y: Int), id: Int32, region: inout [Int32], sealed: InkMask) -> Bool {
        let w = sealed.width, h = sealed.height
        var touches = false
        var stack = [seed.y * w + seed.x]
        region[seed.y * w + seed.x] = id
        while let p = stack.popLast() {
            let x = p % w, y = p / w
            if x == 0 || y == 0 || x == w - 1 || y == h - 1 { touches = true }
            if x + 1 < w, region[p + 1] == -1, sealed.bits[p + 1] == 0 { region[p + 1] = id; stack.append(p + 1) }
            if x > 0, region[p - 1] == -1, sealed.bits[p - 1] == 0 { region[p - 1] = id; stack.append(p - 1) }
            if y + 1 < h, region[p + w] == -1, sealed.bits[p + w] == 0 { region[p + w] = id; stack.append(p + w) }
            if y > 0, region[p - w] == -1, sealed.bits[p - w] == 0 { region[p - w] = id; stack.append(p - w) }
        }
        return touches
    }

    /// The nearest paper to a label, searched no further than the label's
    /// own size — further, and an open room's label finds its neighbour's
    /// paper and takes the neighbour's outline (the Breakfast became the
    /// Great Room this way).
    private static func freePixel(near point: CGPoint, in mask: InkMask, within radius: Int = 40) -> (x: Int, y: Int)? {
        let cx = Int(point.x), cy = Int(point.y)
        for r in 0..<max(1, radius) {
            for dy in -r...r {
                for dx in (abs(dy) == r ? Array(-r...r) : [-r, r]) {
                    let x = cx + dx, y = cy + dy
                    if x >= 0, y >= 0, x < mask.width, y < mask.height, mask.bits[y * mask.width + x] == 0 {
                        return (x, y)
                    }
                }
            }
        }
        return nil
    }

}

// MARK: - Outline

enum Outline {
    /// The outline of a patch as a polygon with only horizontal and vertical
    /// sides, steps smaller than three cells smoothed out, clockwise on
    /// screen. Traced on a coarse grid so a ragged edge does not become a
    /// staircase.
    static func trace(_ pixels: [(Int, Int)], width: Int, height: Int, cell: Int) -> [CGPoint]? {
        guard pixels.count > 50 else { return nil }
        let gw = width / cell + 1, gh = height / cell + 1
        var counts = [Int](repeating: 0, count: gw * gh)
        for (x, y) in pixels { counts[(y / cell) * gw + x / cell] += 1 }
        let full = cell * cell
        var filled = counts.map { $0 * 2 >= full }
        // The largest connected block only.
        filled = largestComponent(filled, gw: gw, gh: gh)
        func at(_ x: Int, _ y: Int) -> Bool { x >= 0 && y >= 0 && x < gw && y < gh && filled[y * gw + x] }

        // Directed boundary edges, interior on the right (clockwise on screen).
        var next: [Int: [Int]] = [:]
        func key(_ x: Int, _ y: Int) -> Int { y * (gw + 1) + x }
        var start: Int?
        for y in 0..<gh {
            for x in 0..<gw where at(x, y) {
                if !at(x, y - 1) { next[key(x, y), default: []].append(key(x + 1, y)) }
                if !at(x + 1, y) { next[key(x + 1, y), default: []].append(key(x + 1, y + 1)) }
                if !at(x, y + 1) { next[key(x + 1, y + 1), default: []].append(key(x, y + 1)) }
                if !at(x - 1, y) { next[key(x, y + 1), default: []].append(key(x, y)) }
                if start == nil, !at(x, y - 1) { start = key(x, y) }
            }
        }
        guard let first = start else { return nil }
        var loop: [Int] = [first]
        var current = first
        var guardCount = 0
        while guardCount < 100_000 {
            guardCount += 1
            guard var options = next[current], !options.isEmpty else { break }
            let chosen = options.removeFirst()
            next[current] = options
            if chosen == first { break }
            loop.append(chosen)
            current = chosen
        }
        var points = loop.map { CGPoint(x: Double($0 % (gw + 1)), y: Double($0 / (gw + 1))) }
        points = simplify(points, minimum: 3)
        guard points.count >= 4 else { return nil }
        return points.map { CGPoint(x: $0.x * Double(cell), y: $0.y * Double(cell)) }
    }

    /// Every side moved `r` outward; corners follow. An outline with only
    /// horizontal and vertical sides alternates between the two, so each
    /// corner takes its x from one neighbouring side and its y from the other.
    static func offset(_ polygon: [CGPoint], by r: Double) -> [CGPoint] {
        let n = polygon.count
        let clockwise = Geometry.signedArea(polygon) > 0
        var line = [Double](repeating: 0, count: n)
        var horizontal = [Bool](repeating: false, count: n)
        for i in 0..<n {
            let p = polygon[i], q = polygon[(i + 1) % n]
            horizontal[i] = abs(q.y - p.y) < abs(q.x - p.x)
            if horizontal[i] {
                line[i] = p.y + ((q.x - p.x > 0) == clockwise ? -r : r)
            } else {
                line[i] = p.x + ((q.y - p.y > 0) == clockwise ? r : -r)
            }
        }
        return (0..<n).map { i in
            let before = (i - 1 + n) % n
            return horizontal[i]
                ? CGPoint(x: line[before], y: line[i])
                : CGPoint(x: line[i], y: line[before])
        }
    }

    private static func largestComponent(_ filled: [Bool], gw: Int, gh: Int) -> [Bool] {
        var label = [Int](repeating: -1, count: filled.count)
        var sizes: [Int] = []
        for i in filled.indices where filled[i] && label[i] == -1 {
            let id = sizes.count
            var stack = [i], size = 0
            label[i] = id
            while let p = stack.popLast() {
                size += 1
                let x = p % gw, y = p / gw
                for (nx, ny) in [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
                where nx >= 0 && ny >= 0 && nx < gw && ny < gh {
                    let q = ny * gw + nx
                    if filled[q] && label[q] == -1 { label[q] = id; stack.append(q) }
                }
            }
            sizes.append(size)
        }
        guard let best = sizes.indices.max(by: { sizes[$0] < sizes[$1] }) else { return filled }
        return label.map { $0 == best }
    }

    /// Drop collinear points, then remove steps shorter than `minimum`.
    static func simplify(_ input: [CGPoint], minimum: Double) -> [CGPoint] {
        var points = collinear(input)
        var changed = true
        while changed && points.count > 4 {
            changed = false
            let n = points.count
            guard let i = (0..<n).min(by: {
                distance(points[$0], points[($0 + 1) % n]) < distance(points[$1], points[($1 + 1) % n])
            }), distance(points[i], points[(i + 1) % n]) < minimum else { break }
            // Short edge i → i+1. Its neighbours are parallel; move the
            // shorter neighbour onto the line of the longer one.
            let a = (i - 1 + n) % n, b = (i + 1) % n, c = (i + 2) % n
            let before = distance(points[a], points[i]), after = distance(points[b], points[c])
            let horizontal = abs(points[i].y - points[b].y) < 1e-9
            if before >= after {
                // Keep the line through a–i; pull b and c onto it.
                if horizontal { points[b].x = points[i].x; points[c].x = points[i].x } else { points[b].y = points[i].y; points[c].y = points[i].y }
            } else {
                if horizontal { points[i].x = points[b].x; points[a].x = points[b].x } else { points[i].y = points[b].y; points[a].y = points[b].y }
            }
            points = collinear(points)
            changed = true
        }
        return points
    }

    private static func collinear(_ input: [CGPoint]) -> [CGPoint] {
        var points = input
        var removed = true
        while removed && points.count > 3 {
            removed = false
            for i in points.indices {
                let p = points[(i - 1 + points.count) % points.count], q = points[i], r = points[(i + 1) % points.count]
                let same = distance(p, q) < 1e-9 || distance(q, r) < 1e-9
                let straight = (abs(p.x - q.x) < 1e-9 && abs(q.x - r.x) < 1e-9) || (abs(p.y - q.y) < 1e-9 && abs(q.y - r.y) < 1e-9)
                if same || straight { points.remove(at: i); removed = true; break }
            }
        }
        return points
    }

    private static func distance(_ a: CGPoint, _ b: CGPoint) -> Double { hypot(a.x - b.x, a.y - b.y) }
}

// MARK: - Geometry

enum Geometry {
    static func bounds(_ polygon: [CGPoint]) -> CGRect {
        let xs = polygon.map(\.x), ys = polygon.map(\.y)
        return CGRect(x: xs.min() ?? 0, y: ys.min() ?? 0, width: (xs.max() ?? 0) - (xs.min() ?? 0), height: (ys.max() ?? 0) - (ys.min() ?? 0))
    }

    /// A rectangle moved — not resized — by what its snapped sides agree
    /// on: across by the left and right sides' shifts, down by the top and
    /// bottom's. Where the two disagree by more than `tolerance`, the
    /// smaller shift wins; a side counts as snapped afterwards only if it
    /// now sits on the wall it found.
    static func translated(_ polygon: [CGPoint], toward snapped: [CGPoint], flags: [Bool], tolerance: Double)
        -> (polygon: [CGPoint], edgeSnapped: [Bool])
    {
        guard polygon.count == 4, snapped.count == 4, flags.count == 4 else { return (polygon, flags) }
        // Sides: 0 top, 1 right, 2 bottom, 3 left (clockwise from top-left).
        let top = snapped[0].y - polygon[0].y, bottom = snapped[2].y - polygon[2].y
        let left = snapped[0].x - polygon[0].x, right = snapped[1].x - polygon[1].x
        func agree(_ a: Double?, _ b: Double?) -> Double {
            switch (a, b) {
            case let (a?, b?): return abs(a - b) <= tolerance ? (a + b) / 2 : (abs(a) < abs(b) ? a : b)
            case let (a?, nil): return a
            case let (nil, b?): return b
            default: return 0
            }
        }
        let dx = agree(flags[3] ? left : nil, flags[1] ? right : nil)
        let dy = agree(flags[0] ? top : nil, flags[2] ? bottom : nil)
        let moved = polygon.map { CGPoint(x: $0.x + dx, y: $0.y + dy) }
        let sits = [
            flags[0] && abs(top - dy) <= tolerance, flags[1] && abs(right - dx) <= tolerance,
            flags[2] && abs(bottom - dy) <= tolerance, flags[3] && abs(left - dx) <= tolerance,
        ]
        return (moved, sits)
    }

    /// Rooms placed by size are moved out of rooms the drawing defines —
    /// the smallest move that clears all of them at once, a wall's
    /// thickness away. A kitchen centred on a label that sits low in the
    /// room must not run into the pantry or the dining room.
    static func pushClear(_ rooms: inout [FoundRoom], gap: Double) {
        let fixed = rooms.filter { !$0.bySize }.map { bounds($0.polygon) }
        func clashes(_ box: CGRect) -> Bool {
            fixed.contains { let o = box.intersection($0); return !o.isNull && o.width > 1 && o.height > 1 }
        }
        for i in rooms.indices where rooms[i].bySize {
            let a = bounds(rooms[i].polygon)
            guard clashes(a) else { continue }
            let near = fixed.filter { $0.insetBy(dx: -a.width, dy: -a.height).intersects(a) }
            let dxs = [0.0] + near.flatMap { [Double($0.minX - gap - a.maxX), Double($0.maxX + gap - a.minX)] }
            let dys = [0.0] + near.flatMap { [Double($0.minY - gap - a.maxY), Double($0.maxY + gap - a.minY)] }
            let limit = Double(max(a.width, a.height)) * 0.4
            var best: (Double, Double)?
            for dx in dxs where abs(dx) < limit {
                for dy in dys where abs(dx) + abs(dy) < limit {
                    if let b = best, abs(dx) + abs(dy) >= abs(b.0) + abs(b.1) { continue }
                    if !clashes(a.offsetBy(dx: dx, dy: dy)) { best = (dx, dy) }
                }
            }
            guard let (dx, dy) = best else { continue }
            rooms[i].polygon = rooms[i].polygon.map { CGPoint(x: $0.x + dx, y: $0.y + dy) }
        }
    }

    static func contains(_ polygon: [CGPoint], _ point: CGPoint) -> Bool {
        var inside = false
        var j = polygon.count - 1
        for i in polygon.indices {
            let a = polygon[i], b = polygon[j]
            if (a.y > point.y) != (b.y > point.y),
                point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x
            {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    /// Whether a drawn box is the printed size (either way round) within a
    /// fraction.
    static func fits(_ box: CGRect, _ a: Double, _ b: Double, tolerance: Double) -> Bool {
        func close(_ x: Double, _ y: Double) -> Bool { abs(x - y) <= y * tolerance }
        return (close(box.width, a) && close(box.height, b)) || (close(box.width, b) && close(box.height, a))
    }

    /// A room of its printed size centred on its label — the first number
    /// across, as plans print it — kept inside `within` where that is given
    /// and big enough.
    static func rectangle(around centre: CGPoint, size: (Double, Double), scale: Double, within: CGRect?) -> [CGPoint] {
        var w = size.0 * scale, h = size.1 * scale
        if let within, (w > within.width * 1.05 || h > within.height * 1.05),
            h <= within.width * 1.05, w <= within.height * 1.05
        {
            swap(&w, &h)
        }
        var x = centre.x - w / 2, y = centre.y - h / 2
        if let within {
            if w <= within.width { x = min(max(x, within.minX), within.maxX - w) }
            if h <= within.height { y = min(max(y, within.minY), within.maxY - h) }
        }
        return [CGPoint(x: x, y: y), CGPoint(x: x + w, y: y), CGPoint(x: x + w, y: y + h), CGPoint(x: x, y: y + h)]
    }

    static func signedArea(_ polygon: [CGPoint]) -> Double {
        var twice = 0.0
        for i in polygon.indices {
            let p = polygon[i], q = polygon[(i + 1) % polygon.count]
            twice += p.x * q.y - q.x * p.y
        }
        return twice / 2
    }

    /// Move each side to the strongest paper-to-wall step within `reach`:
    /// the ink just outside the line (two lines of it, so a thick wall beats
    /// a hairline) minus the ink just inside, with a mild pull toward where
    /// it started. A step under 0.15 is no wall.
    static func snap(_ polygon: [CGPoint], walls: InkMask, ink: InkMask, reach: Int) -> (polygon: [CGPoint], edgeSnapped: [Bool]) {
        let n = polygon.count
        var result = polygon
        var snapped = [Bool](repeating: false, count: n)
        let clockwise = signedArea(polygon) > 0
        let inkMask = ink
        for i in 0..<n {
            let p = polygon[i], q = polygon[(i + 1) % n]
            let horizontal = abs(q.y - p.y) < 0.5
            let vertical = abs(q.x - p.x) < 0.5
            guard horizontal || vertical else { continue }
            let inward: Int = horizontal
                ? ((q.x - p.x > 0) == clockwise ? 1 : -1)
                : ((q.y - p.y > 0) == clockwise ? -1 : 1)
            let a0 = horizontal ? min(p.x, q.x) : min(p.y, q.y)
            let a1 = horizontal ? max(p.x, q.x) : max(p.y, q.y)
            let inset = (a1 - a0) * 0.15
            let at = Int((horizontal ? p.y : p.x).rounded())
            // A wall that is mostly windows is mostly thin glazing lines;
            // those count half, so it can still be found — but a counter's
            // single line beside a real wall does not outscore the wall.
            func ink(_ line: Int) -> Double {
                let solid = walls.coverage(horizontal: horizontal, line: line, from: a0 + inset, to: a1 - inset)
                let any = inkMask.coverage(horizontal: horizontal, line: line, from: a0 + inset, to: a1 - inset)
                return solid + 0.5 * max(0, any - solid)
            }
            var best: (Int, Double)?
            for d in -reach...reach {
                let boundary = at + d
                let interiorLine = inward > 0 ? boundary : boundary - 1
                let wallLine = inward > 0 ? boundary - 1 : boundary
                let outside = ink(wallLine) * 0.6 + ink(wallLine - inward) * 0.4
                let inside = (ink(interiorLine) + ink(interiorLine + inward)) / 2
                let step = outside - inside
                guard step >= 0.15 else { continue }
                let value = step - 0.3 * Double(abs(d)) / Double(reach)
                if best == nil || value > best!.1 { best = (boundary, value) }
            }
            guard let found = best else { continue }
            snapped[i] = true
            if horizontal { result[i].y = Double(found.0); result[(i + 1) % n].y = Double(found.0) }
            else { result[i].x = Double(found.0); result[(i + 1) % n].x = Double(found.0) }
        }
        return (result, snapped)
    }

    /// Sides that found no wall take the nearest wall another room found on
    /// the same axis — an open join's neighbour, or the rest of the outside
    /// wall a garage door sits in.
    static func alignLooseEdges(_ rooms: [([CGPoint], [Bool])], reach: Int, alongLimit: Double) -> [[CGPoint]] {
        struct Face { let horizontal: Bool; let at: Double; let from: Double; let to: Double }
        func face(_ poly: [CGPoint], _ i: Int) -> Face? {
            let p = poly[i], q = poly[(i + 1) % poly.count]
            if abs(q.y - p.y) < 0.5 { return Face(horizontal: true, at: p.y, from: min(p.x, q.x), to: max(p.x, q.x)) }
            if abs(q.x - p.x) < 0.5 { return Face(horizontal: false, at: p.x, from: min(p.y, q.y), to: max(p.y, q.y)) }
            return nil
        }
        var found: [Face] = []
        for (poly, snapped) in rooms { for i in poly.indices where i < snapped.count && snapped[i] { if let f = face(poly, i) { found.append(f) } } }
        return rooms.map { poly, snapped in
            var out = poly
            for i in poly.indices where i < snapped.count && !snapped[i] {
                guard let f = face(poly, i) else { continue }
                var nearest: (Double, Double)?
                for other in found where other.horizontal == f.horizontal {
                    let d = abs(other.at - f.at)
                    guard d <= Double(reach), d > 0.01 else { continue }
                    let gap = max(0, max(other.from, f.from) - min(other.to, f.to))
                    guard gap <= alongLimit else { continue }
                    if nearest == nil || d < nearest!.1 { nearest = (other.at, d) }
                }
                guard let target = nearest?.0 else { continue }
                let j = (i + 1) % out.count
                if f.horizontal { out[i].y = target; out[j].y = target } else { out[i].x = target; out[j].x = target }
            }
            return out
        }
    }

    /// Pixels per metre: every rectangle whose printed size fits its drawn
    /// box votes, whichever way round the size is printed; the median of
    /// the votes that agree wins.
    static func estimateScale(_ rooms: [([CGPoint], String?)], imperial: Bool) -> Double? {
        var votes: [Double] = []
        for (polygon, printed) in rooms {
            guard polygon.count == 4, let printed, let (a, b) = Lengths.printedSize(printed, imperial: imperial) else { continue }
            let box = bounds(polygon)
            guard box.width > 4, box.height > 4 else { continue }
            let straight = (box.width / a, box.height / b), turned = (box.width / b, box.height / a)
            func spread(_ pair: (Double, Double)) -> Double { abs(log(pair.0 / pair.1)) }
            let pair = spread(straight) <= spread(turned) ? straight : turned
            guard spread(pair) < 0.12 else { continue }
            votes += [pair.0, pair.1]
        }
        guard !votes.isEmpty else { return nil }
        let first = median(votes)
        let agreeing = votes.filter { abs($0 / first - 1) < 0.08 }
        return median(agreeing.isEmpty ? votes : agreeing)
    }

    /// Pixels per metre from printed areas, when a plan gives "137 sq ft"
    /// instead of its sides: each traced room votes √(pixel area ÷ area);
    /// the median of the votes that agree wins.
    static func estimateScale(areas rooms: [([CGPoint], Double)]) -> Double? {
        let votes = rooms.compactMap { polygon, m2 -> Double? in
            let pixels = abs(signedArea(polygon))
            return pixels > 16 ? (pixels / m2).squareRoot() : nil
        }
        guard !votes.isEmpty else { return nil }
        let first = median(votes)
        let agreeing = votes.filter { abs($0 / first - 1) < 0.1 }
        return median(agreeing.isEmpty ? votes : agreeing)
    }

    static func median(_ values: [Double]) -> Double {
        let s = values.sorted()
        return s.count % 2 == 1 ? s[s.count / 2] : (s[s.count / 2 - 1] + s[s.count / 2]) / 2
    }

    /// Pixel rooms → metres on one floor: faces within 4 cm made one face,
    /// each room's min corner its position, openings attached.
    static func assemble(
        _ rooms: [FoundRoom], openings: [Int: [PlanImportResult.Opening]], scale: Double, imperial: Bool
    ) -> (rooms: [PlanImportResult.Room], origin: CGPoint) {
        let metric = rooms.map { $0.polygon.map { CGPoint(x: $0.x / scale, y: $0.y / scale) } }
        func aligned(_ values: [Double]) -> [Double: Double] {
            let sorted = Array(Set(values.map { ($0 * 1000).rounded() / 1000 })).sorted()
            var map: [Double: Double] = [:], group: [Double] = []
            func flush() { let mean = group.reduce(0, +) / Double(max(group.count, 1)); for v in group { map[v] = mean }; group = [] }
            for v in sorted { if let last = group.last, v - last > 0.04 { flush() }; group.append(v) }
            flush()
            return map
        }
        let r = { (v: Double) in (v * 1000).rounded() / 1000 }
        let xs = aligned(metric.flatMap { $0.map { Double($0.x) } }), ys = aligned(metric.flatMap { $0.map { Double($0.y) } })
        let floor = metric.map { $0.map { CGPoint(x: xs[r(Double($0.x))] ?? Double($0.x), y: ys[r(Double($0.y))] ?? Double($0.y)) } }
        let all = floor.flatMap { $0 }
        let origin = CGPoint(x: all.map { Double($0.x) }.min() ?? 0, y: all.map { Double($0.y) }.min() ?? 0)

        let out = rooms.enumerated().map { index, room -> PlanImportResult.Room in
            let shifted = floor[index].map { CGPoint(x: $0.x - origin.x, y: $0.y - origin.y) }
            let box = bounds(shifted)
            let local = shifted.map { PlanImportResult.Point(x: r($0.x - box.minX), y: r($0.y - box.minY)) }
            var note: String?
            if let printed = room.printedSize, let (a, b) = Lengths.printedSize(printed, imperial: imperial), local.count == 4 {
                let off = min(max(abs(box.width - a), abs(box.height - b)), max(abs(box.width - b), abs(box.height - a)))
                if off > 0.1 {
                    note = "Labelled \(printed); drawn \(feetInches(box.width)) × \(feetInches(box.height)). Kept the drawing."
                }
            } else if let printed = room.printedArea {
                let drawn = abs(signedArea(local.map { CGPoint(x: $0.x, y: $0.y) }))
                if abs(drawn / printed.squareMetres - 1) > 0.12 {
                    let shown = imperial ? "\(Int((drawn / (Lengths.foot * Lengths.foot)).rounded())) sq ft" : String(format: "%.1f m²", drawn)
                    note = "Labelled \(printed.text); drawn \(shown). Kept the drawing."
                }
            }
            return PlanImportResult.Room(
                name: room.name, roomType: room.roomType, outdoor: ["porch", "balcony"].contains(room.roomType),
                ceilingHeightM: room.ceiling, polygon: local, planX: r(box.minX), planY: r(box.minY),
                openings: openings[index] ?? [], printedSize: room.printedSize, note: note)
        }
        return (out, origin)
    }

    static func feetInches(_ metres: Double) -> String {
        let inches = Int((metres / 0.0254).rounded())
        return "\(inches / 12)'-\(inches % 12)\""
    }
}

// MARK: - Openings

enum Openings {
    /// Gaps in each room's walls. Each side's wall band (out to 2½ wall
    /// thicknesses) is walked along its length; where the solid wall is
    /// missing for at least 0.5 m there is an opening. Thin glazing lines
    /// across the gap make it a window; a clean gap is a door, a double
    /// door or a cased opening by width — a garage door in a garage.
    static func find(rooms: [FoundRoom], walls: InkMask, lines ink: InkMask, thickness: Int, scale: Double) -> [Int: [PlanImportResult.Opening]] {
        var result: [Int: [PlanImportResult.Opening]] = [:]
        let band = max(3, Int(Double(thickness) * 2.5))
        for (index, room) in rooms.enumerated() where !["porch", "balcony"].contains(room.roomType) {
            let poly = room.polygon
            let clockwise = Geometry.signedArea(poly) > 0
            // Only sides that found their wall: a side placed by size alone
            // may be standing in open floor, and all of it would read as gap.
            for i in poly.indices where i < room.edgeSnapped.count && room.edgeSnapped[i] {
                let p = poly[i], q = poly[(i + 1) % poly.count]
                let horizontal = abs(q.y - p.y) < 0.5
                guard horizontal || abs(q.x - p.x) < 0.5 else { continue }
                let length = hypot(q.x - p.x, q.y - p.y)
                guard length > scale * 0.6 else { continue }
                let outward: Double = horizontal ? ((q.x - p.x > 0) == clockwise ? -1 : 1) : ((q.y - p.y > 0) == clockwise ? 1 : -1)
                let steps = Int(length)
                var solid = [Bool](repeating: true, count: steps)
                var glazed = [Bool](repeating: false, count: steps)
                for s in 0..<steps {
                    let t = Double(s) / Double(steps)
                    let x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t
                    var wallHits = 0, runs = 0, inRun = false
                    for k in 1...band {
                        let sx = Int(horizontal ? x : x + outward * Double(k))
                        let sy = Int(horizontal ? y + outward * Double(k) : y)
                        wallHits += Int(walls[sx, sy])
                        let line = ink[sx, sy] == 1
                        if line && !inRun { runs += 1 }
                        inRun = line
                    }
                    solid[s] = wallHits >= max(2, thickness / 2)
                    // Glazing is two or three lines along the wall, side by
                    // side across its thickness. One line is a threshold —
                    // the French doors onto a porch have one.
                    glazed[s] = !solid[s] && runs >= 2
                }
                // Runs of missing wall, ignoring the corners where the next
                // room's wall meets this one.
                let margin = Int(Double(thickness) * 1.5)
                var s = margin
                while s < steps - margin {
                    guard !solid[s] else { s += 1; continue }
                    var e = s
                    while e < steps - margin && !solid[e] { e += 1 }
                    let widthM = Double(e - s) / scale
                    // A gap running into the corner margin is usually the
                    // corner itself, not a door — unless it is wide.
                    let bounded = s > margin && e < steps - margin
                    if widthM >= 0.5 && (bounded || widthM >= 1.5) {
                        let glazedShare = Double((s..<e).filter { glazed[$0] }.count) / Double(e - s)
                        let along = { (step: Int) -> CGPoint in
                            let t = Double(step) / Double(steps)
                            return CGPoint(x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t)
                        }
                        let a = along(s), b = along(e)
                        let swings = swingArc(from: a, to: b, horizontal: horizontal, lines: ink, walls: walls) >= 0.3
                        let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
                        let beyond = horizontal
                            ? CGPoint(x: mid.x, y: mid.y + outward * Double(band + 3))
                            : CGPoint(x: mid.x + outward * Double(band + 3), y: mid.y)
                        let outside = !rooms.enumerated().contains { j, other in
                            j != index && !["porch", "balcony"].contains(other.roomType)
                                && Geometry.contains(other.polygon, beyond)
                        }
                        let kind: String
                        if room.roomType == "garage" && widthM >= 2.2 {
                            kind = "doorGarage"
                        } else if glazedShare > 0.6 || (outside && !swings) {
                            // Glazing drawn across it — or an outside wall's
                            // gap with no door drawn beside it: a window.
                            // Glazing wins over strokes beside the gap; a
                            // kitchen's counters run up to its windows.
                            kind = widthM >= 1.5 ? "windowWide" : (widthM <= 0.65 ? "windowSmall" : "windowStandard")
                        } else if swings {
                            kind = widthM <= 1.1 ? "doorSingle" : (widthM <= 1.8 ? "doorDouble" : "doorCased")
                        } else {
                            // Between two rooms with no swing drawn: an
                            // open join, not a door.
                            kind = "doorCased"
                        }
                        result[index, default: []].append(PlanImportResult.Opening(
                            edge: i, offset: (Double(s) / scale * 1000).rounded() / 1000,
                            width: (widthM * 1000).rounded() / 1000, kind: kind))
                    }
                    s = e + 1
                }
            }
        }
        return result
    }

    /// How much of a door is drawn beside a gap: strokes that run away
    /// from the wall — a leaf standing open, a swing's arc, the V of a pair
    /// of French doors — on either side, out to six tenths of the gap's
    /// width. Lines that run along the wall across most of the gap do not
    /// count: glazing, an outside wall's hatching, a threshold. The share
    /// of that depth where such strokes are found, the better side.
    static func swingArc(from a: CGPoint, to b: CGPoint, horizontal: Bool, lines: InkMask, walls: InkMask) -> Double {
        let width = horizontal ? abs(b.x - a.x) : abs(b.y - a.y)
        guard width >= 6 else { return 0 }
        let lo = Int(horizontal ? min(a.x, b.x) : min(a.y, b.y)), hi = lo + Int(width)
        let face = Int(horizontal ? a.y : a.x)
        let depth = max(4, Int(width * 0.6))
        var best = 0.0
        for side in [-1, 1] {
            var rows = 0
            for d in 3...depth {
                let across = face + side * d
                var count = 0
                for along in (lo + 1)..<hi {
                    let x = horizontal ? along : across, y = horizontal ? across : along
                    if lines[x, y] == 1 && walls[x, y] == 0 { count += 1 }
                }
                if count > 0 && Double(count) < 0.7 * width { rows += 1 }
            }
            best = max(best, Double(rows) / Double(depth - 2))
        }
        return best
    }
}
