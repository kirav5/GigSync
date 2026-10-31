import Capacitor
import Foundation

/// Voice on iPhone (spec §3.1, ADR 0023): speech to text in `Recognizer`, reading aloud in `Speaker`. iOS has no
/// download an app can start (dictation languages and voices come from the phone's Settings), so `prepare` only
/// reports the state.
@objc(GigSyncSpeechPlugin)
public class GigSyncSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GigSyncSpeechPlugin"
    public let jsName = "GigSyncSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSpeaking", returnType: CAPPluginReturnPromise),
    ]

    private lazy var recognizer = Recognizer { [weak self] text in
        self?.notifyListeners(Speech.partial, data: [Speech.text: text])
    }
    private let speaker = Speaker()

    @objc func state(_ call: CAPPluginCall) {
        guard let lang = call.getString(Speech.lang) else {
            return call.resolve(Speech.status(Speech.unavailable, Speech.none))
        }
        call.resolve(call.getString(Speech.mode) == Speech.speak ? speaker.state(lang) : recognizer.state(lang))
    }

    @objc func prepare(_ call: CAPPluginCall) {
        state(call)
    }

    @objc func listen(_ call: CAPPluginCall) {
        recognizer.listen(call)
    }

    @objc func stop(_ call: CAPPluginCall) {
        recognizer.stop()
        call.resolve()
    }

    @objc func speak(_ call: CAPPluginCall) {
        speaker.speak(call)
    }

    @objc func stopSpeaking(_ call: CAPPluginCall) {
        speaker.stop()
        call.resolve()
    }
}

/// Names the web layer reads (definitions.ts), written once for the three Swift files.
enum Speech {
    static let partial = "partial"
    static let speak = "speak"

    static let lang = "lang"
    static let mode = "mode"
    static let text = "text"
    static let hints = "hints"
    static let allowCloud = "allowCloud"
    static let state = "state"
    static let engine = "engine"
    static let cloud = "cloud"
    static let vendor = "vendor"
    static let onDevice = "onDevice"

    static let available = "available"
    static let unavailable = "unavailable"
    static let denied = "denied"
    static let busy = "busy"
    static let none = "none"

    static func status(_ state: String, _ engine: String) -> [String: Any] {
        [Speech.state: state, Speech.engine: engine]
    }
}
