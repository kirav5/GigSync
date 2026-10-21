// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CollabPluginLlm",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "CollabPluginLlm", targets: ["CollabLLMPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "CollabLLMPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CollabLLMPlugin"
        )
    ]
)
