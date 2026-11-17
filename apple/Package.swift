// swift-tools-version: 5.9
// CodexCore: the platform-independent part of the CODEX_LMS Apple app (table of contents, saved
// progress, search). It has no UI code, so `swift test` runs on macOS and on Linux.
// The app itself is generated from project.yml with XcodeGen.
import PackageDescription

let package = Package(
    name: "CodexCore",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [
        .library(name: "CodexCore", targets: ["CodexCore"]),
    ],
    targets: [
        .target(name: "CodexCore"),
        .testTarget(name: "CodexCoreTests", dependencies: ["CodexCore"]),
    ]
)
