import Capacitor
import Foundation

/// Runs a language model on iPhone and Mac. M0 reports "no model". The iOS/macOS 26 build will wrap Apple
/// Foundation Models here, reusing the Swift Collab app's AppleIntelligence and CollabMLX code.
@objc(GigSyncLLMPlugin)
public class GigSyncLLMPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GigSyncLLMPlugin"
    public let jsName = "GigSyncLLM"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
    ]

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["available": false, "engine": "none", "freeMemoryMb": ProcessInfo.processInfo.physicalMemory / (1024 * 1024)])
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt"), !prompt.isEmpty else {
            call.reject("prompt is required")
            return
        }
        // TODO(M1): LanguageModelSession().respond(to: prompt) behind `#if canImport(FoundationModels)`.
        call.resolve(["available": false, "text": "", "engine": "none"])
    }
}
