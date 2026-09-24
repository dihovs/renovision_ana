import ARKit
import RoomPlan
import simd

/**
 * Corrects a RoomPlan wall's length against the raw LiDAR mesh.
 *
 * **Why RoomPlan's own number needs a second opinion.** `CapturedRoom` is
 * not a measurement — it is Apple's own simplified rectangle FIT to the
 * scene mesh, and the report's own history has already found that fit
 * disagreeing with itself (`roomScan.ts`'s `totalFloorAreaSquareMeters`
 * comment: a live report printed `AREA 87.21 m²` beside `WIDTH 7.559 ×
 * LENGTH 5.137`, which multiply to 38.8). The dense mesh ARKit builds while
 * scanning — `ARMeshAnchor`, sceneReconstruction — is the literal measured
 * geometry RoomPlan's own fit was built from, and this app has never once
 * looked at it. This does: for each wall, it asks the mesh directly "where
 * does this surface actually start and stop" instead of trusting RoomPlan's
 * simplification.
 *
 * **Conservative by construction.** A refinement is used only when enough
 * mesh points support it and it does not disagree sharply with RoomPlan's
 * own figure — a wild disagreement is the signature of the wrong slab of
 * mesh being picked up (a doorway, an adjacent room's wall a few
 * centimetres away), not a better answer. When either guard fails, the
 * caller keeps RoomPlan's own number, unchanged.
 */
@available(iOS 17.0, *)
enum WallMeshRefinement {
    struct Refined {
        let lengthMeters: Double
        let centerX: Double
        let centerZ: Double
        let supportingPoints: Int
    }

    /// Every mesh vertex ARKit has accumulated so far, in world space —
    /// read once at the moment the operator taps Done, while the session is
    /// still live. `ARMeshAnchor`'s vertices are in the anchor's own local
    /// space; the anchor's `transform` is what brings them to world space,
    /// same as any other ARKit anchor.
    static func worldVertices(from anchors: [ARMeshAnchor]) -> [SIMD3<Float>] {
        var points: [SIMD3<Float>] = []
        for anchor in anchors {
            let source = anchor.geometry.vertices
            guard source.format == .float3 else { continue }
            let transform = anchor.transform
            let buffer = source.buffer.contents()
            points.reserveCapacity(points.count + source.count)
            for i in 0..<source.count {
                let offset = source.offset + source.stride * i
                let local = buffer.advanced(by: offset)
                    .assumingMemoryBound(to: SIMD3<Float>.self).pointee
                let world = transform * SIMD4<Float>(local, 1)
                points.append(SIMD3<Float>(world.x, world.y, world.z))
            }
        }
        return points
    }

    /// Refine one wall's length and centre against the mesh, or return nil
    /// when the mesh does not support a confident correction.
    static func refine(
        wallTransform: simd_float4x4,
        lengthMeters: Float,
        heightMeters: Float,
        points: [SIMD3<Float>]
    ) -> Refined? {
        let center = SIMD3<Float>(
            wallTransform.columns.3.x, wallTransform.columns.3.y, wallTransform.columns.3.z)
        let axisX = simd_normalize(
            SIMD3<Float>(wallTransform.columns.0.x, wallTransform.columns.0.y, wallTransform.columns.0.z))
        let axisY = simd_normalize(
            SIMD3<Float>(wallTransform.columns.1.x, wallTransform.columns.1.y, wallTransform.columns.1.z))
        let axisZ = simd_normalize(
            SIMD3<Float>(wallTransform.columns.2.x, wallTransform.columns.2.y, wallTransform.columns.2.z))

        // A thin slab either side of the wall's own plane — thinner than any
        // real framed wall (a 2×6 with board either side is still under
        // 15cm), so a point off the ADJACENT room's wall, a few centimetres
        // through this one, is never mistaken for this wall's own surface.
        let slab: Float = 0.06
        let halfHeight = heightMeters / 2 + 0.05
        // A little past the wall's own reported ends: the true edge may sit
        // outside RoomPlan's own guess in either direction, which is the
        // entire question being asked here.
        let searchHalfLength = lengthMeters / 2 + 0.3

        var xs: [Float] = []
        xs.reserveCapacity(512)
        for point in points {
            let d = point - center
            let localZ = simd_dot(d, axisZ)
            guard abs(localZ) < slab else { continue }
            let localY = simd_dot(d, axisY)
            guard abs(localY) < halfHeight else { continue }
            let localX = simd_dot(d, axisX)
            guard abs(localX) < searchHalfLength else { continue }
            xs.append(localX)
        }

        // Fewer points than this is not a measurement, it is noise — refuse
        // rather than fit a line to a handful of stray vertices.
        guard xs.count >= 40 else { return nil }

        xs.sort()
        // The 2nd and 98th percentile, not the true min/max: the mesh
        // occasionally carries a stray vertex past a wall's real edge — a
        // doorframe corner, a shadow the depth sensor misread — and one
        // outlier at either end would silently lengthen the wall.
        let lowIndex = max(0, Int(Double(xs.count) * 0.02))
        let highIndex = min(xs.count - 1, Int(Double(xs.count) * 0.98))
        let low = xs[lowIndex]
        let high = xs[highIndex]
        let refinedLength = high - low
        guard refinedLength > 0.2 else { return nil }

        // Refuse a refinement that disagrees sharply with RoomPlan's own
        // figure. 15%: enough to correct the centimetres RoomPlan's own
        // simplification costs, not enough to silently swap in a different
        // wall's measurement.
        let deviation = abs(refinedLength - lengthMeters) / max(lengthMeters, 0.01)
        guard deviation < 0.15 else { return nil }

        let midX = (low + high) / 2
        let refinedCenter = center + axisX * midX

        return Refined(
            lengthMeters: Double(refinedLength),
            centerX: Double(refinedCenter.x),
            centerZ: Double(refinedCenter.z),
            supportingPoints: xs.count)
    }
}
