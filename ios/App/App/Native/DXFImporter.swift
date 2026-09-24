import CoreGraphics
import Foundation

/// Reads a floor-plan DXF exported by another scanning app — Polycam's is
/// the one this was built against — into room polygons and openings this
/// app already knows how to draw.
///
/// **Why this exists instead of only tracing a photo.** A DXF from a real
/// scanner already carries exact vector geometry: closed room outlines,
/// individual walls, and door/window footprints, all dimensioned in the
/// file's own units. Reading it directly gives exact corners and openings
/// with nothing hand-traced; a photo can only ever be an approximation
/// pulled square by eye. Where a file has no such layers — a phone photo, a
/// scanned PDF, a hand sketch flattened to an image — there is nothing here
/// to read, and the caller falls back to tracing.
///
/// **What is read, and what is not.** Only the room outlines and door/window
/// footprints are lifted into the room this produces. Furniture, dimension
/// text, the compass rose and the exporter's own logo are real layers in the
/// file and are deliberately ignored — this app has its own object catalogue
/// and its own dimension chrome, and importing somebody else's furniture
/// placements would plant objects nobody scanned or measured here.
enum DXFImporter {
    struct ImportedRoom {
        /// From `Poly-RoomLabels`, when a label's anchor falls inside this
        /// room's own polygon — absent rather than guessed if none does.
        let name: String?
        /// The room's outline, in metres, in the file's own coordinate frame.
        /// Feeds `editedPolygon` directly — `toFloorPlan` normalises the
        /// origin itself.
        let polygonMeters: [CGPoint]
        /// Door and window centrelines that sit on this room's boundary, in
        /// the same frame as `polygonMeters` — feeds `editedOpenings`.
        let doors: [OpeningSegment]
        let windows: [OpeningSegment]
    }

    struct OpeningSegment {
        let x1: Double
        let y1: Double
        let x2: Double
        let y2: Double
    }

    enum DXFError: LocalizedError {
        case notDXF
        case noRooms

        var errorDescription: String? {
            switch self {
            case .notDXF:
                return "That doesn't look like a DXF file."
            case .noRooms:
                return
                    "No room outlines in this file — it may be from a different app, or missing its room layer."
            }
        }
    }

    /// A DXF's own unit is a per-file setting ($INSUNITS, header group 70),
    /// not something safe to assume. Polycam's own export has been observed
    /// carrying no $INSUNITS at all and geometry in FEET regardless — the
    /// file this was built against has a Living Room polygon whose bounding
    /// box, read directly off its vertices, is 16'5" × 14'8", matching its
    /// own CSV export to the inch. Metres is offered for a DXF that DOES
    /// declare unit 6, rather than assumed never to occur.
    private static func metersPerUnit(insunits: Int?) -> Double {
        switch insunits {
        case 6: return 1.0 // metres
        case 2: return 0.3048 // feet
        default: return 0.3048 // Polycam's observed default: unmarked, feet
        }
    }

    // MARK: - Group-code tokens

    /// One `(code, value)` pair — a DXF file is nothing but a flat stream of
    /// these, two lines each: the code, then the value, both trimmed.
    private struct Token {
        let code: Int
        let value: String
    }

    private static func tokenize(_ text: String) -> [Token] {
        // Two different ways CRLF breaks the obvious approach, both hit
        // while getting this to read this file's own line endings.
        // `.split(separator: "\n")` fails because Swift's `String` treats
        // `"\r\n"` as ONE grapheme cluster, never equal to a bare `"\n"`, so
        // the whole file reads as a single "line". Switching to
        // `.components(separatedBy: .newlines)` — a `CharacterSet`, not a
        // `Character` — fixed that, but `CharacterSet.newlines` still
        // contains `\r` AND `\n` as separate members, so Foundation's
        // Unicode-scalar-level split cuts BETWEEN them too and inserts an
        // empty "line" after every real one — which silently shifted every
        // code/value pair by one, so every code parsed fine and every value
        // read back empty. Normalising the line ending first, then
        // splitting on the now-lone `"\n"`, has exactly one boundary per
        // line either way.
        let normalised = text
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        var lines = normalised.split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
        // A trailing blank line from the final newline would otherwise pair
        // with nothing.
        if lines.last == "" { lines.removeLast() }
        var tokens: [Token] = []
        tokens.reserveCapacity(lines.count / 2)
        var i = 0
        while i + 1 < lines.count {
            if let code = Int(lines[i]) {
                tokens.append(Token(code: code, value: lines[i + 1]))
            }
            i += 2
        }
        return tokens
    }

    // MARK: - Entities

    /// One polyline entity, on its own layer, with the corner-order vertex
    /// list a `LWPOLYLINE`'s repeated 10/20 codes give — DUPLICATE closing
    /// vertex included exactly as the file wrote it, since callers here
    /// either want the shape (openings, which only look at extent) or
    /// already know to de-duplicate (`PlanEditing.selfIntersects` and
    /// friends tolerate a repeated last point the same way `toFloorPlan`
    /// does for `editedPolygon`).
    private struct RawPolyline {
        let layer: String
        let points: [CGPoint]
    }

    /// Also lifts `MTEXT` insertion points, keyed by layer, so room names
    /// can be matched to the polygon they sit inside without a second pass
    /// over the token stream.
    private struct RawText {
        let layer: String
        let anchor: CGPoint
        let text: String
    }

    /// `MTEXT`'s raw content carries its own formatting codes inline — this
    /// file's room labels come back as `\A1;Living Room`, not `Living Room`.
    /// `\A1;` is an alignment code; `\P` is a paragraph break; `\C1;`,
    /// `\f...;` and the like set colour and font. All of them are `\`, a
    /// letter, optional parameters, then `;` — except `\P`, which takes no
    /// semicolon and no parameters. Stripped rather than parsed for
    /// meaning: nothing this app draws needs MTEXT's own rich formatting,
    /// only the plain label underneath it.
    private static func plainText(from raw: String) -> String {
        var result = ""
        let chars = Array(raw)
        var i = 0
        while i < chars.count {
            if chars[i] == "\\", i + 1 < chars.count {
                if chars[i + 1] == "P" || chars[i + 1] == "p" {
                    result.append(" ")
                    i += 2
                    continue
                }
                if chars[i + 1].isLetter {
                    var j = i + 2
                    while j < chars.count, chars[j] != ";" { j += 1 }
                    i = j < chars.count ? j + 1 : chars.count
                    continue
                }
            }
            result.append(chars[i])
            i += 1
        }
        return result.trimmingCharacters(in: .whitespaces)
    }

    private static func entities(from tokens: [Token]) -> (
        polylines: [RawPolyline], texts: [RawText]
    ) {
        var polylines: [RawPolyline] = []
        var texts: [RawText] = []

        var i = 0
        // Skip to ENTITIES — HEADER, TABLES and BLOCKS carry their own
        // unrelated 10/20/8 codes (extents, line-type scales, block
        // definitions) that would otherwise be read as vertices.
        while i < tokens.count, !(tokens[i].code == 2 && tokens[i].value == "ENTITIES") {
            i += 1
        }

        var entityType: String?
        var layer: String?
        var points: [CGPoint] = []
        var pendingX: Double?
        var textAnchor: CGPoint?
        var textValue: String?

        func flush() {
            defer {
                entityType = nil
                layer = nil
                points = []
                pendingX = nil
                textAnchor = nil
                textValue = nil
            }
            guard let layer else { return }
            if entityType == "LWPOLYLINE", !points.isEmpty {
                polylines.append(RawPolyline(layer: layer, points: points))
            } else if entityType == "MTEXT" || entityType == "TEXT",
                let anchor = textAnchor, let value = textValue
            {
                texts.append(RawText(layer: layer, anchor: anchor, text: value))
            }
        }

        while i < tokens.count {
            let token = tokens[i]
            // Code 0 starts every new entity (and ends ENTITIES with
            // ENDSEC) — the one reliable boundary in the stream. Flushing
            // here, unconditionally, is what keeps a HATCH that follows a
            // LWPOLYLINE on the same layer from being read as more vertices
            // of the polyline before it.
            if token.code == 0 {
                flush()
                entityType = token.value == "ENDSEC" ? nil : token.value
            } else if token.code == 8 {
                layer = token.value
            } else if token.code == 10 {
                pendingX = Double(token.value)
                if entityType == "MTEXT" || entityType == "TEXT" {
                    // Read again on 20 below — anchor needs both.
                }
            } else if token.code == 20 {
                if let x = pendingX, let y = Double(token.value) {
                    if entityType == "LWPOLYLINE" {
                        points.append(CGPoint(x: x, y: y))
                    } else if entityType == "MTEXT" || entityType == "TEXT" {
                        textAnchor = CGPoint(x: x, y: y)
                    }
                }
                pendingX = nil
            } else if token.code == 1, entityType == "MTEXT" || entityType == "TEXT" {
                textValue = plainText(from: token.value)
            }
            if token.code == 0, token.value == "ENDSEC" { break }
            i += 1
        }
        flush()

        return (polylines, texts)
    }

    // MARK: - Rooms and openings

    /// The centreline of a door or window's footprint rectangle: the
    /// midpoint of each of its two SHORT sides. Polycam draws an opening as
    /// a thin rectangle spanning the wall's own thickness, so the short
    /// sides cross the wall and the long sides run along it — connecting
    /// the SHORT sides' midpoints threads a segment ALONG the wall whose
    /// length is the opening's actual width, which is what `editedOpenings`
    /// wants. (Connecting the long sides' midpoints instead was the first
    /// version of this, and it is wrong in the other direction from what it
    /// sounds like: that segment runs ACROSS the wall and is only as long
    /// as the wall is thick — verified against the real file this was
    /// built against, where every door came back reading 0.33 ft, the
    /// file's own wall thickness, rather than a door width.)
    ///
    /// Returns nil for anything that is not close to rectangular — four or
    /// five points (closed rectangles repeat the first corner) — rather than
    /// guessing at a shape this was not built to read.
    private static func centerline(of points: [CGPoint]) -> (CGPoint, CGPoint)? {
        var corners = points
        if corners.count == 5, corners[0] == corners[4] { corners.removeLast() }
        guard corners.count == 4 else { return nil }

        func edge(_ a: CGPoint, _ b: CGPoint) -> (mid: CGPoint, length: CGFloat) {
            (CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2), hypot(b.x - a.x, b.y - a.y))
        }
        let e0 = edge(corners[0], corners[1])
        let e1 = edge(corners[1], corners[2])
        let e2 = edge(corners[2], corners[3])
        let e3 = edge(corners[3], corners[0])
        if e0.length + e2.length <= e1.length + e3.length {
            return (e0.mid, e2.mid)
        } else {
            return (e1.mid, e3.mid)
        }
    }

    /// A point on or effectively touching a polygon's boundary — an
    /// opening's centreline endpoint sits ON the room's wall by
    /// construction, but floating-point corners from two independently
    /// drawn layers rarely land on the exact same bit pattern.
    private static func distanceToPolygon(_ point: CGPoint, _ polygon: [CGPoint]) -> Double {
        guard polygon.count >= 2 else { return .infinity }
        var best = Double.infinity
        for i in 0..<polygon.count {
            let a = polygon[i]
            let b = polygon[(i + 1) % polygon.count]
            let abx = b.x - a.x, aby = b.y - a.y
            let l2 = Double(abx * abx + aby * aby)
            let t: Double
            if l2 > 1e-12 {
                t = min(1, max(0, Double((point.x - a.x) * abx + (point.y - a.y) * aby) / l2))
            } else {
                t = 0
            }
            let projX = a.x + CGFloat(t) * abx
            let projY = a.y + CGFloat(t) * aby
            best = min(best, hypot(Double(point.x - projX), Double(point.y - projY)))
        }
        return best
    }

    private static func containsPoint(_ polygon: [CGPoint], _ point: CGPoint) -> Bool {
        var inside = false
        var j = polygon.count - 1
        for i in 0..<polygon.count {
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

    // MARK: - Entry point

    static func parse(data: Data) throws -> [ImportedRoom] {
        guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1)
        else { throw DXFError.notDXF }
        guard text.contains("ENTITIES") else { throw DXFError.notDXF }

        let (polylines, texts) = entities(from: tokenize(text))
        let scale = CGFloat(metersPerUnit(insunits: nil))

        let roomPolylines = polylines.filter { $0.layer == "Poly-Rooms" }
        guard !roomPolylines.isEmpty else { throw DXFError.noRooms }

        // A door/window centreline within 30cm of a room's boundary belongs
        // to it — wider than any real wall this trade frames (2×6 at most
        // is under 15cm), narrow enough that a door shared between two rooms
        // is not silently claimed by a third.
        let ownershipThreshold = 0.30

        func centerlines(layer: String) -> [(CGPoint, CGPoint)] {
            polylines.filter { $0.layer == layer }.compactMap { centerline(of: $0.points) }
        }
        let doorLines = centerlines(layer: "Poly-Doors")
        let windowLines = centerlines(layer: "Poly-Windows")
        let labels = texts.filter { $0.layer == "Poly-RoomLabels" }

        return roomPolylines.map { room in
            let polygonMeters = room.points.map {
                CGPoint(x: $0.x * scale, y: $0.y * scale)
            }
            let rawPolygon = room.points

            func belongsHere(_ segment: (CGPoint, CGPoint)) -> Bool {
                let mid = CGPoint(x: (segment.0.x + segment.1.x) / 2, y: (segment.0.y + segment.1.y) / 2)
                return distanceToPolygon(mid, rawPolygon) < ownershipThreshold
            }

            let doors = doorLines.filter(belongsHere).map {
                OpeningSegment(
                    x1: Double($0.0.x) * Double(scale), y1: Double($0.0.y) * Double(scale),
                    x2: Double($0.1.x) * Double(scale), y2: Double($0.1.y) * Double(scale))
            }
            let windows = windowLines.filter(belongsHere).map {
                OpeningSegment(
                    x1: Double($0.0.x) * Double(scale), y1: Double($0.0.y) * Double(scale),
                    x2: Double($0.1.x) * Double(scale), y2: Double($0.1.y) * Double(scale))
            }

            let name = labels.first { containsPoint(rawPolygon, $0.anchor) }?.text

            return ImportedRoom(
                name: name, polygonMeters: polygonMeters, doors: doors, windows: windows)
        }
    }
}
