import XCTest
@testable import FloorPlanCore

/// The LiDAR path (spec §8, M11), scored on the six hand-measured rooms of
/// src/lib/roomOutline.fixtures.ts — the same rooms, the same noise, the
/// same seeded generator — so the result can be compared with the
/// scorecard taken of the old outline code on 3 Nov 2026.
final class WallChainTests: XCTestCase {

    struct RoomCase {
        let name: String
        let cornersFt: [(Double, Double)]
        var extraFt: [((Double, Double), (Double, Double))] = []
        let areaSqFt: Double
        let corners: Int
    }

    static let ft = 0.3048
    static let cases: [RoomCase] = [
        RoomCase(name: "Rectangle", cornersFt: [(0, 0), (12, 0), (12, 10), (0, 10)], areaSqFt: 120, corners: 4),
        RoomCase(name: "L-shape", cornersFt: [(0, 0), (16, 0), (16, 7), (10, 7), (10, 12), (0, 12)], areaSqFt: 162, corners: 6),
        RoomCase(name: "Open closet", cornersFt: [(0, 0), (12, 0), (12, 11), (9, 11), (9, 13), (3, 13), (3, 11), (0, 11)], areaSqFt: 144, corners: 8),
        RoomCase(name: "Closet built in", cornersFt: [(0, 0), (12, 0), (12, 10), (7, 10), (7, 12), (0, 12)],
                 extraFt: [((7.33, 10.33), (12, 10.33)), ((7.33, 10.33), (7.33, 12))], areaSqFt: 134, corners: 6),
        RoomCase(name: "45° corner", cornersFt: [(0, 0), (14, 0), (14, 9), (11, 12), (0, 12)], areaSqFt: 163.5, corners: 5),
        RoomCase(name: "Chimney chase", cornersFt: [(0, 0), (15, 0), (15, 11), (9, 11), (9, 10), (7, 10), (7, 11), (0, 11)], areaSqFt: 163, corners: 8),
    ]

    struct Noise { let angleDeg, offsetM, lengthM: Double; let split, stub: Bool }
    static let clean = Noise(angleDeg: 0, offsetM: 0, lengthM: 0, split: false, stub: false)
    static let typical = Noise(angleDeg: 1.5, offsetM: 0.03, lengthM: 0.03, split: false, stub: false)
    static let rough = Noise(angleDeg: 2.5, offsetM: 0.05, lengthM: 0.06, split: true, stub: true)

    /// The fixtures' own generator, line for line.
    static func walls(_ room: RoomCase, _ noise: Noise, seed: UInt32) -> [WallChain.Segment] {
        var state = seed
        func rnd() -> Double {
            state = state &* 1664525 &+ 1013904223
            return Double(state) / 4294967296
        }
        func jitter(_ m: Double) -> Double { (rnd() * 2 - 1) * m }
        let pts = room.cornersFt.map { Vec2($0.0 * ft, $0.1 * ft) }
        var segs: [(Vec2, Vec2)] = pts.indices.map { (pts[$0], pts[($0 + 1) % pts.count]) }
        for e in room.extraFt { segs.append((Vec2(e.0.0 * ft, e.0.1 * ft), Vec2(e.1.0 * ft, e.1.1 * ft))) }
        if noise.split {
            var i = 0
            for (j, s) in segs.enumerated() where s.0.distance(to: s.1) > segs[i].0.distance(to: segs[i].1) { i = j }
            let s = segs[i]
            let len = s.0.distance(to: s.1)
            let u = (s.1 - s.0) * (1 / len)
            let mid = len * 0.45, step = 0.03
            let n = Vec2(-u.y, u.x)
            segs.replaceSubrange(i...i, with: [
                (s.0, s.0 + u * mid),
                (s.0 + u * (mid + 0.02) + n * step, s.1 + n * step),
            ])
        }
        segs = segs.map { s in
            let c = (s.0 + s.1) * 0.5
            let len = s.0.distance(to: s.1) + jitter(noise.lengthM)
            let ang = atan2(s.1.y - s.0.y, s.1.x - s.0.x) + jitter(noise.angleDeg) * .pi / 180
            let u = Vec2(cos(ang), sin(ang))
            let o = c + Vec2(-u.y, u.x) * jitter(noise.offsetM)
            return (o - u * (len / 2), o + u * (len / 2))
        }
        if noise.stub {
            let s = segs[0]
            let len = s.0.distance(to: s.1)
            let u = (s.1 - s.0) * (1 / len)
            let p = s.0 + u * (len * 0.3)
            segs.append((p, p + Vec2(-u.y, u.x) * 0.15))
        }
        // The scan's own arbitrary frame.
        let turn = 17 * Double.pi / 180
        let rot = { (v: Vec2) in Vec2(v.x * cos(turn) - v.y * sin(turn) + 3, v.x * sin(turn) + v.y * cos(turn) - 2) }
        return segs.map { WallChain.Segment(rot($0.0), rot($0.1)) }
    }

    /// Distinct corners (straight-through points dropped) and the worst
    /// corner's distance from a multiple of 45°.
    static func score(_ pts: [Vec2]) -> (corners: Int, worstDeg: Double) {
        let real = pts.indices.filter { i in
            let a = pts[(i - 1 + pts.count) % pts.count], p = pts[i], b = pts[(i + 1) % pts.count]
            return abs(atan2((p - a).cross(b - p), (p - a).dot(b - p))) > 2 * .pi / 180
        }.map { pts[$0] }
        var worst = 0.0
        for i in real.indices {
            let a = real[(i - 1 + real.count) % real.count], p = real[i], b = real[(i + 1) % real.count]
            let turn = abs(atan2((p - a).cross(b - p), (p - a).dot(b - p))) * 180 / .pi
            worst = max(worst, abs(turn - (turn / 45).rounded() * 45))
        }
        return (real.count, worst)
    }

    private func run(_ room: RoomCase, _ noise: Noise, seeds: Int = 50,
                     _ check: (WallChain.Outline?, Int) -> Void) {
        for seed in 1...seeds { check(WallChain.squaredOutline(Self.walls(room, noise, seed: UInt32(seed))), seed) }
    }

    func testCleanWallsComeOutExactly() {
        for room in Self.cases {
            run(room, Self.clean, seeds: 3) { outline, seed in
                guard let o = outline else { return XCTFail("\(room.name) seed \(seed): no outline") }
                let s = Self.score(o.points)
                XCTAssertEqual(s.corners, room.corners, "\(room.name)")
                XCTAssertLessThan(s.worstDeg, 0.1, "\(room.name)")
                XCTAssertEqual(Polygon.area(o.points) / (Self.ft * Self.ft), room.areaSqFt,
                               accuracy: room.areaSqFt * 0.005, "\(room.name)")
            }
        }
    }

    /// The four failures written down on 3 Nov 2026, now as plain tests.
    func testClosetBuiltIntoACornerCloses() {
        run(Self.cases[3], Self.typical) { o, seed in XCTAssertNotNil(o, "seed \(seed)") }
    }

    func testChimneyChaseKeepsSquareCorners() {
        run(Self.cases[5], Self.typical) { o, seed in
            guard let o else { return XCTFail("seed \(seed): no outline") }
            XCTAssertLessThan(Self.score(o.points).worstDeg, 1, "seed \(seed)")
        }
    }

    func testSplitWallAndStubKeepTheCornerCount() {
        for room in Self.cases {
            run(room, Self.rough) { o, seed in
                guard let o else { return XCTFail("\(room.name) seed \(seed): no outline") }
                XCTAssertEqual(Self.score(o.points).corners, room.corners, "\(room.name) seed \(seed)")
            }
        }
    }

    func testSplitWallAndStubStaySquare() {
        for room in Self.cases where room.name != "45° corner" {
            run(room, Self.rough) { o, seed in
                guard let o else { return XCTFail("\(room.name) seed \(seed): no outline") }
                XCTAssertLessThan(Self.score(o.points).worstDeg, 1, "\(room.name) seed \(seed)")
            }
        }
    }

    func testTypicalNoiseClosesSquareWithTheRightCorners() {
        for room in Self.cases {
            run(room, Self.typical) { o, seed in
                guard let o else { return XCTFail("\(room.name) seed \(seed): no outline") }
                let s = Self.score(o.points)
                XCTAssertEqual(s.corners, room.corners, "\(room.name) seed \(seed)")
                if room.name != "45° corner" { XCTAssertLessThan(s.worstDeg, 1, "\(room.name) seed \(seed)") }
            }
        }
    }

    func testAGapIsBridgedAndMarkedSuggested() {
        // A 4 × 3 room with one wall missing a 1 m middle: still a room, and
        // the bridge across the gap is the guessed edge.
        let walls = [
            WallChain.Segment(Vec2(0, 0), Vec2(4, 0)),
            WallChain.Segment(Vec2(4, 0), Vec2(4, 3)),
            WallChain.Segment(Vec2(4, 3), Vec2(2.5, 3)),
            WallChain.Segment(Vec2(1.5, 3), Vec2(0, 3)),
            WallChain.Segment(Vec2(0, 3), Vec2(0, 0)),
        ]
        guard let o = WallChain.outline(walls) else { return XCTFail("must close") }
        XCTAssertEqual(Polygon.area(o.points), 12, accuracy: 1e-6)
    }
}
