// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "KebaKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "KebaKit", targets: ["KebaKit"]),
    ],
    targets: [
        .target(name: "KebaKit"),
        .testTarget(name: "KebaKitTests", dependencies: ["KebaKit"]),
    ]
)
