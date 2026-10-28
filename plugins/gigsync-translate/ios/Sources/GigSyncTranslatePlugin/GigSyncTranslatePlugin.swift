import Capacitor
import Foundation
#if canImport(Translation) && os(iOS)
import SwiftUI
import Translation
#endif

/// Translates free text on iPhone with Apple's Translation framework, entirely on the device (multilanguage plan
/// §3.4, Tier 0). `state` asks the OS whether the pair is installed, downloadable or unsupported (iOS 18+);
/// `translate` uses an installed pair outside SwiftUI (iOS 26+); `prepare` shows Apple's own download sheet, from
/// the owner's tap. Pairs the OS does not support, and older iOS versions, report "unavailable", so the app shows
/// the original text with its language named.
@objc(GigSyncTranslatePlugin)
public class GigSyncTranslatePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GigSyncTranslatePlugin"
    public let jsName = "GigSyncTranslate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepare", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translate", returnType: CAPPluginReturnPromise),
    ]

    private static let engine = "apple-translation"
    private static let none = "none"

    @available(iOS 18.0, *)
    private func pair(_ call: CAPPluginCall) -> (from: Locale.Language, to: Locale.Language)? {
        guard let from = call.getString("from"), let to = call.getString("to") else { return nil }
        return (Locale.Language(identifier: from), Locale.Language(identifier: to))
    }

    @objc func state(_ call: CAPPluginCall) {
        #if canImport(Translation) && os(iOS)
        if #available(iOS 18.0, *), let langs = pair(call) {
            Task {
                let status = await LanguageAvailability().status(from: langs.from, to: langs.to)
                call.resolve(["state": Self.stateName(status), "engine": Self.engine])
            }
            return
        }
        #endif
        call.resolve(["state": "unavailable", "engine": Self.none])
    }

    @objc func prepare(_ call: CAPPluginCall) {
        #if canImport(Translation) && os(iOS)
        if #available(iOS 18.0, *), let langs = pair(call) {
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                guard let presenter = self.bridge?.viewController else { return self.state(call) }
                let config = TranslationSession.Configuration(source: langs.from, target: langs.to)
                let host = UIHostingController(rootView: PrepareView(config: config) {
                    presenter.dismiss(animated: false) { self.state(call) }
                })
                host.modalPresentationStyle = .overFullScreen
                host.view.backgroundColor = .clear
                presenter.present(host, animated: false)
            }
            return
        }
        #endif
        state(call)
    }

    @objc func translate(_ call: CAPPluginCall) {
        #if canImport(Translation) && os(iOS)
        if #available(iOS 26.0, *), let langs = pair(call), let text = call.getString("text"), !text.isEmpty {
            Task {
                do {
                    let session = TranslationSession(installedSource: langs.from, target: langs.to)
                    let response = try await session.translate(text)
                    call.resolve(["available": true, "text": response.targetText, "engine": Self.engine])
                } catch {
                    call.resolve(["available": false, "text": "", "engine": Self.engine])
                }
            }
            return
        }
        #endif
        call.resolve(["available": false, "text": "", "engine": Self.none])
    }

    #if canImport(Translation) && os(iOS)
    @available(iOS 18.0, *)
    private static func stateName(_ status: LanguageAvailability.Status) -> String {
        switch status {
        case .installed: return "available"
        case .supported: return "downloadable"
        default: return "unavailable"
        }
    }
    #endif
}

#if canImport(Translation) && os(iOS)
/// An invisible view whose only job is Apple's download sheet for one language pair.
@available(iOS 18.0, *)
private struct PrepareView: View {
    let config: TranslationSession.Configuration
    let done: () -> Void

    var body: some View {
        Color.clear.translationTask(config) { session in
            try? await session.prepareTranslation()
            await MainActor.run { done() }
        }
    }
}
#endif
