import Capacitor
import Foundation

/// Translates free text on iPhone and Mac. Not built yet: it reports "unavailable", so the app shows the original
/// text with its language named. TODO(G2): Apple's Translation framework, `TranslationSession(installedSource:target:)`
/// on iOS 26, only for pairs whose packs are installed on the device.
@objc(GigSyncTranslatePlugin)
public class GigSyncTranslatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GigSyncTranslatePlugin"
    public let jsName = "GigSyncTranslate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise),
    ]

    @objc func state(_ call: CAPPluginCall) {
        call.resolve(["state": "unavailable", "engine": "none"])
    }

    @objc func prepare(_ call: CAPPluginCall) {
        state(call)
    }

    @objc func translate(_ call: CAPPluginCall) {
        call.resolve(["available": false, "text": "", "engine": "none"])
    }
}
