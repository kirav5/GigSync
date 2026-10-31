import AVFoundation
import Capacitor
import Foundation

/// Reads text aloud with `AVSpeechSynthesizer` and a voice installed on this iPhone (spec §3.1); iOS voices run on the
/// phone. A language with no installed voice (Kannada today) reports "unavailable", and the app shows no speaker.
/// Unchecked Sendable: the synthesizer and the pending call are only touched on the main queue.
final class Speaker: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    private let synth = AVSpeechSynthesizer()
    /// The utterance being spoken and the call waiting for it to end.
    private var pending: (words: AVSpeechUtterance, call: CAPPluginCall)?

    private static let engine = "apple-ondevice"

    override init() {
        super.init()
        synth.delegate = self
    }

    func state(_ lang: String) -> [String: Any] {
        let voice = AVSpeechSynthesisVoice(language: lang)
        return Speech.status(voice == nil ? Speech.unavailable : Speech.available, Self.engine)
    }

    /// Resolves when the words have been spoken, or when the app stops or replaces them.
    func speak(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let lang = call.getString(Speech.lang), let text = call.getString(Speech.text), !text.isEmpty,
                  let voice = AVSpeechSynthesisVoice(language: lang)
            else {
                return call.reject("no voice for this language on this iPhone", Speech.unavailable)
            }
            self.settle()
            if self.synth.isSpeaking { self.synth.stopSpeaking(at: .immediate) }
            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try? session.setActive(true)
            let words = AVSpeechUtterance(string: text)
            words.voice = voice
            self.pending = (words, call)
            self.synth.speak(words)
        }
    }

    func stop() {
        DispatchQueue.main.async {
            self.synth.stopSpeaking(at: .immediate)
            self.settle()
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        ended(utterance)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        ended(utterance)
    }

    /// Only the utterance still pending settles its call: a replaced one ends after the new one has started.
    private func ended(_ words: AVSpeechUtterance) {
        DispatchQueue.main.async {
            guard self.pending?.words === words else { return }
            self.settle()
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func settle() {
        pending?.call.resolve()
        pending = nil
    }
}
