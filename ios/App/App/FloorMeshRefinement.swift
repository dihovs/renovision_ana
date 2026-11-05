import ARKit
import CoreGraphics
import simd

/**
 * Traces the room's actual floor boundary from the LiDAR mesh, independent
 * of RoomPlan's own wall list.
 *
 * **Why this is a different fix from `WallMeshRefinement`.** Correcting each
 * wall's length along its own axis cannot recover a wall RoomPlan simplified
 * away — a short jog, a bump-out — and cannot correct a corner's ANGLE, only
 * a wall's position along the angle it was already given. This asks a
 * different, more basic question: forget what RoomPlan says the walls are,
 * where does the mesh say the FLOOR actually is. `refine` still exists and
 * still helps every ordinary rectangular wall; this exists for the room
 * shapes it structurally cannot.
 *
 * **The method, and why each step is checked rather than trusted.**
 * 1. Every upward-facing mesh triangle (its normal points within ~30° of
 *    straight up) is a candidate horizontal surface — a floor, but also a
 *    countertop, a windowsill, a table. Only the LOWEST cluster of these is
 *    kept, on the assumption nothing scanned stands below the floor.
 * 2. Those points are rasterised onto a fine grid in the floor plane and the
 *    largest connected blob of occupied cells is kept — rejecting a stray
 *    patch of "floor-height, upward-facing" mesh the sensor picked up
 *    somewhere it should not have (through an open doorway, off a low
 *    windowsill the height filter did not fully exclude).
 * 3. The blob's outer boundary is traced and simplified into a polygon.
 *
 * **And the result is only used when it passes a sanity check against what
 * RoomPlan's own wall chain already says** — the caller does that
 * comparison, not this file, because the caller is what knows the wall
 * chain's own area to compare against.
 */
@available(iOS 17.0, *)
enum FloorMeshRefinement {
    /// A traced floor, in world X/Z metres — the same frame every wall's
    /// `centerX`/`centerZ` already lives in.
    struct TracedFloor {
        let polygon: [CGPoint]
        let areaSquareMeters: Double
    }

    // MARK: - ARKit-facing entry point

    static func trace(anchors: [ARMeshAnchor]) -> TracedFloor? {
        let floorPoints = floorPlanePoints(from: anchors)
        guard floorPoints.count >= 300 else { return nil }
        return trace(points: floorPoints)
    }

    /// Every mesh vertex belonging to an upward-facing triangle within 15cm
    /// of the lowest such cluster — the floor, read geometrically rather
    /// than from ARKit's semantic classification (which needs a scene-
    /// reconstruction mode this app does not control — `RoomCaptureSession`
    /// owns the session configuration internally).
    private static func floorPlanePoints(from anchors: [ARMeshAnchor]) -> [SIMD2<Float>] {
        var upwardVertices: [SIMD3<Float>] = []
        upwardVertices.reserveCapacity(4096)

        for anchor in anchors {
            let geometry = anchor.geometry
            guard geometry.vertices.format == .float3, geometry.faces.bytesPerIndex == 4 || geometry.faces.bytesPerIndex == 2
            else { continue }
            let transform = anchor.transform
            let vertexSource = geometry.vertices
            let vertexBuffer = vertexSource.buffer.contents()

            func vertex(_ index: Int32) -> SIMD3<Float> {
                let offset = vertexSource.offset + vertexSource.stride * Int(index)
                let local = vertexBuffer.advanced(by: offset)
                    .assumingMemoryBound(to: SIMD3<Float>.self).pointee
                let world = transform * SIMD4<Float>(local, 1)
                return SIMD3<Float>(world.x, world.y, world.z)
            }

            let faces = geometry.faces
            let facePointer = faces.buffer.contents()
            let bytesPerIndex = faces.bytesPerIndex
            for f in 0..<faces.count {
                func index(_ corner: Int) -> Int32 {
                    let byteOffset = (f * faces.indexCountPerPrimitive + corner) * bytesPerIndex
                    if bytesPerIndex == 4 {
                        return facePointer.advanced(by: byteOffset)
                            .assumingMemoryBound(to: Int32.self).pointee
                    } else {
                        return Int32(
                            facePointer.advanced(by: byteOffset)
                                .assumingMemoryBound(to: UInt16.self).pointee)
                    }
                }
                let a = vertex(index(0))
                let b = vertex(index(1))
                let c = vertex(index(2))
                let normal = simd_normalize(simd_cross(b - a, c - a))
                // Within ~30° of straight up. RoomPlan's own wall-detection
                // tolerance is not exposed, so this is a plain, generous
                // threshold rather than a borrowed constant.
                guard normal.y > 0.85 else { continue }
                upwardVertices.append(a)
                upwardVertices.append(b)
                upwardVertices.append(c)
            }
        }

        guard !upwardVertices.isEmpty else { return [] }

        // The 5th percentile height, not the true minimum: a single stray
        // low vertex (mesh noise at a threshold or a reflective floor
        // patch ARKit misread) would otherwise anchor the whole floor
        // level on one bad point.
        let heights = upwardVertices.map(\.y).sorted()
        let floorLevel = heights[heights.count / 20]

        return upwardVertices
            .filter { abs($0.y - floorLevel) < 0.15 }
            .map { SIMD2<Float>($0.x, $0.z) }
    }

    // MARK: - Pure geometry: grid, largest blob, boundary trace, simplify
    //
    // No ARKit types below this line — this half is ordinary 2D geometry,
    // and is exercised directly by `scripts/floor-mesh-check.swift` against
    // synthetic point sets before ever touching a real scan, the same
    // discipline `DXFImporter` was checked against a real file with.

    /// Grid cell size. Fine enough to trace a real jog or bump-out (RoomPlan
    /// itself does not report anything smaller than about 10cm), coarse
    /// enough that a scan's normal point-to-point noise does not turn a
    /// straight wall into a saw-tooth — and, found only by testing this
    /// against a synthetic filled rectangle before it ever reached a real
    /// scan: coarse enough to stay reliably denser than the mesh's own
    /// vertex spacing. 5cm cells against a mesh with ~6cm gaps anywhere
    /// (normal — LiDAR mesh density is not uniform) fragmented one solid
    /// floor into two hundred disconnected scraps and the largest-blob step
    /// kept a seventeenth of the room. 8cm, plus 8-connected flood fill
    /// below as a second line of defence, does not.
    static let cellSize: Float = 0.08

    static func trace(points: [SIMD2<Float>]) -> TracedFloor? {
        guard !points.isEmpty else { return nil }

        let minX = points.map(\.x).min()!
        let minY = points.map(\.y).min()!

        var occupied: Set<SIMD2<Int32>> = []
        occupied.reserveCapacity(points.count)
        for p in points {
            let cell = SIMD2<Int32>(
                Int32(floor((p.x - minX) / cellSize)), Int32(floor((p.y - minY) / cellSize)))
            occupied.insert(cell)
        }

        guard let blob = largestConnectedBlob(occupied) else { return nil }
        guard let ring = traceBoundary(of: blob) else { return nil }
        let simplified = simplify(ring, toleranceCells: 2)
        guard simplified.count >= 3 else { return nil }

        let worldPolygon = simplified.map {
            CGPoint(x: Double(Float($0.x) * cellSize + minX), y: Double(Float($0.y) * cellSize + minY))
        }
        let area = polygonArea(worldPolygon)
        guard area > 0.5 else { return nil }

        return TracedFloor(polygon: worldPolygon, areaSquareMeters: area)
    }

    /// 8-connected flood fill, largest component only — the floor the
    /// operator actually walked, not a doorway sliver of a neighbouring
    /// room's floor the mesh also happened to cover. 8-connected rather
    /// than 4- as a second line of defence beyond `cellSize` itself: two
    /// occupied cells touching only at a corner are still one floor, and
    /// refusing to bridge that corner is exactly what turned one solid
    /// synthetic rectangle into two hundred scraps during testing.
    private static func largestConnectedBlob(_ cells: Set<SIMD2<Int32>>) -> Set<SIMD2<Int32>>? {
        var unvisited = cells
        var best: Set<SIMD2<Int32>> = []
        let neighbourDeltas: [SIMD2<Int32>] = [
            SIMD2<Int32>(1, 0), SIMD2<Int32>(-1, 0), SIMD2<Int32>(0, 1), SIMD2<Int32>(0, -1),
            SIMD2<Int32>(1, 1), SIMD2<Int32>(1, -1), SIMD2<Int32>(-1, 1), SIMD2<Int32>(-1, -1),
        ]

        while let start = unvisited.first {
            var component: Set<SIMD2<Int32>> = []
            var stack = [start]
            unvisited.remove(start)
            while let cell = stack.popLast() {
                component.insert(cell)
                for delta in neighbourDeltas {
                    let neighbour = cell &+ delta
                    if unvisited.contains(neighbour) {
                        unvisited.remove(neighbour)
                        stack.append(neighbour)
                    }
                }
            }
            if component.count > best.count { best = component }
        }
        return best.isEmpty ? nil : best
    }

    /// Moore-neighbour boundary tracing on the occupied-cell mask: walk the
    /// outer edge of the blob and return it as an ordered ring of cell
    /// corners (not cell centres — a corner is where two edges actually
    /// meet, which is what turns a staircase of unit steps into a
    /// recognisable rectangle once simplified).
    private static func traceBoundary(of cells: Set<SIMD2<Int32>>) -> [SIMD2<Int32>]? {
        guard !cells.isEmpty else { return nil }

        // Walk every cell's four edges; an edge shared by two occupied cells
        // is interior and cancels out, leaving only the boundary — the
        // standard way to read a boundary off a filled raster without a
        // dedicated contour walk needing to reason about which side is
        // "outside".
        struct Edge: Hashable { let a: SIMD2<Int32>; let b: SIMD2<Int32> }
        var edgeCount: [Edge: Int] = [:]
        func add(_ a: SIMD2<Int32>, _ b: SIMD2<Int32>) {
            let key = (a.x, a.y) < (b.x, b.y) ? Edge(a: a, b: b) : Edge(a: b, b: a)
            edgeCount[key, default: 0] += 1
        }
        for cell in cells {
            let x = cell.x, y = cell.y
            let corners = [
                SIMD2<Int32>(x, y), SIMD2<Int32>(x + 1, y),
                SIMD2<Int32>(x + 1, y + 1), SIMD2<Int32>(x, y + 1),
            ]
            for i in 0..<4 { add(corners[i], corners[(i + 1) % 4]) }
        }
        let boundaryEdges = edgeCount.filter { $0.value == 1 }.map(\.key)
        guard !boundaryEdges.isEmpty else { return nil }

        var adjacency: [SIMD2<Int32>: [SIMD2<Int32>]] = [:]
        for edge in boundaryEdges {
            adjacency[edge.a, default: []].append(edge.b)
            adjacency[edge.b, default: []].append(edge.a)
        }

        // Walk the outer ring from its lowest-leftmost corner, which is
        // never interior to a hole a floor plan would not have anyway.
        guard let start = adjacency.keys.min(by: { ($0.x, $0.y) < ($1.x, $1.y) }) else { return nil }
        var ring: [SIMD2<Int32>] = [start]
        var previous: SIMD2<Int32>? = nil
        var current = start
        while true {
            guard let neighbours = adjacency[current] else { return nil }
            let next = neighbours.first { $0 != previous } ?? neighbours.first
            guard let next else { return nil }
            if next == start { break }
            ring.append(next)
            previous = current
            current = next
            if ring.count > cells.count * 4 + 8 { return nil } // malformed mask; refuse rather than loop
        }
        return ring
    }

    /// Douglas-Peucker on the cell-corner ring, in CELL units — collapses
    /// the raster's own unit stair-step on an axis-aligned wall down to one
    /// straight edge, while a genuine jog wider than the tolerance survives.
    private static func simplify(_ ring: [SIMD2<Int32>], toleranceCells: Float) -> [SIMD2<Int32>] {
        guard ring.count > 2 else { return ring }
        let points = ring.map { SIMD2<Float>(Float($0.x), Float($0.y)) }

        func distance(_ p: SIMD2<Float>, _ a: SIMD2<Float>, _ b: SIMD2<Float>) -> Float {
            let ab = b - a
            let length = simd_length(ab)
            guard length > 1e-6 else { return simd_length(p - a) }
            let t = max(0, min(1, simd_dot(p - a, ab) / (length * length)))
            return simd_length(p - (a + ab * t))
        }

        func douglasPeucker(_ pts: ArraySlice<SIMD2<Float>>) -> [SIMD2<Float>] {
            guard let first = pts.first, let last = pts.last, pts.count > 2 else {
                return pts.isEmpty ? [] : [pts.first!]
            }
            var maxDistance: Float = 0
            var splitIndex = pts.startIndex
            for i in pts.indices.dropFirst().dropLast() {
                let d = distance(pts[i], first, last)
                if d > maxDistance { maxDistance = d; splitIndex = i }
            }
            if maxDistance > toleranceCells {
                let left = douglasPeucker(pts[pts.startIndex...splitIndex])
                let right = douglasPeucker(pts[splitIndex...(pts.endIndex - 1)])
                return left.dropLast() + right
            }
            return [first, last]
        }

        var simplified = douglasPeucker(points[points.indices])
        if simplified.count > 1, simplified.first == simplified.last { simplified.removeLast() }
        return simplified.map { SIMD2<Int32>(Int32($0.x.rounded()), Int32($0.y.rounded())) }
    }

    static func polygonArea(_ polygon: [CGPoint]) -> Double {
        guard polygon.count >= 3 else { return 0 }
        var sum = 0.0
        for i in 0..<polygon.count {
            let a = polygon[i]
            let b = polygon[(i + 1) % polygon.count]
            sum += a.x * b.y - b.x * a.y
        }
        return abs(sum) / 2
    }
}
