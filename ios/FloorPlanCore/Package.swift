// swift-tools-version:5.10
import PackageDescription

/// The floor-plan geometry core — Docs/vinsnipe-floor-plan-spec.md, M1 onward.
///
/// Pure Swift, Foundation only: no UIKit, no ARKit, no RoomPlan. That is what
/// lets `swift test` run it on the Mac in a second, and what keeps the maths
/// honest — nothing in here can reach for the screen to fix a number.
let package = Package(
    name: "FloorPlanCore",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [
        .library(name: "FloorPlanCore", targets: ["FloorPlanCore"]),
    ],
    targets: [
        .target(name: "FloorPlanCore"),
        .testTarget(name: "FloorPlanCoreTests", dependencies: ["FloorPlanCore"]),
    ]
)
