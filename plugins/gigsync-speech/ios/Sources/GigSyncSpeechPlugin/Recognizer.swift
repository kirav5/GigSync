import AVFoundation
import Capacitor
import Foundation
import Speech

/// Speech to text on iPhone (spec §3.1, ADR 0023). On the phone first: `SFSpeechRecognizer` with
/// `requiresOnDeviceRecognition`, where the locale supports it (en-IN does; Hindi and Kannada don't). Otherwise Apple's
/// servers, with `requiresOnDeviceRecognition = false`, only when the app passes allowCloud, which it does only after
/// the owner allowed Apple, and only for a locale Apple lists. Listening ends after a short quiet, at `stop()`, or at a
/// cap. All state lives on the main queue.
final class Recognizer {
    private enum Failure: Error {
        case noMicrophone
    }

    private let partial: (String) -> Void
    private let audio = AVAudioEngine()
    private var call: CAPPluginCall?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var quiet: Timer?
    private var cap: Timer?
    private var heard = ""
    private var onDevice = true

    /// Before the first word, silence for this long ends listening with nothing heard.
    private static let firstWordSeconds: TimeInterval = 8
    /// After a word, this much quiet means the owner has finished.
    private static let quietSeconds: TimeInterval = 1.5
    /// Once the mic stops, the recognizer gets this long to send its last words.
    private static let lastWordsSeconds: TimeInterval = 2
    /// Nobody answers one question for longer; a noisy room must not keep the mic open.
    private static let capSeconds: TimeInterval = 60
    private static let deviceEngine = "apple-ondevice"
    private static let cloudEngine = "apple-cloud"
    private static let apple = "apple"
    private static let bus: AVAudioNodeBus = 0
    private static let bufferSize: AVAudioFrameCount = 1024

    init(partial: @escaping (String) -> Void) {
        self.partial = partial
    }

    func state(_ lang: String) -> [String: Any] {
        guard let r = SFSpeechRecognizer(locale: Locale(identifier: lang)) else {
            return Speech.status(Speech.unavailable, Speech.none)
        }
        let engine = r.supportsOnDeviceRecognition ? Self.deviceEngine : Speech.none
        if Self.denied() { return Speech.status(Speech.denied, engine) }
        if r.supportsOnDeviceRecognition && r.isAvailable { return Speech.status(Speech.available, engine) }
        var status = Speech.status(Speech.unavailable, engine)
        if Self.cloudServes(r, lang) {
            status[Speech.cloud] = [Speech.engine: Self.cloudEngine, Speech.vendor: Self.apple]
        }
        return status
    }

    func listen(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.begin(call) }
    }

    /// Ends listening; the words heard so far still come back from listen.
    func stop() {
        DispatchQueue.main.async { self.endAudio() }
    }

    private func begin(_ call: CAPPluginCall) {
        guard self.call == nil else { return call.reject("already listening", Speech.busy) }
        guard let lang = call.getString(Speech.lang), let r = SFSpeechRecognizer(locale: Locale(identifier: lang)) else {
            return call.reject("no recognizer for this language", Speech.unavailable)
        }
        let device = r.supportsOnDeviceRecognition && r.isAvailable
        guard device || (call.getBool(Speech.allowCloud, false) && Self.cloudServes(r, lang)) else {
            return call.reject("no recognizer for this language", Speech.unavailable)
        }
        self.call = call
        Self.authorize { granted in
            guard self.call === call else { return }
            guard granted else {
                self.call = nil
                return call.reject("microphone or speech recognition not allowed", Speech.denied)
            }
            do {
                try self.start(r, device: device, hints: call.getArray(Speech.hints, String.self) ?? [])
            } catch {
                self.call = nil
                self.teardown()
                call.reject("could not start listening")
            }
        }
    }

    private func start(_ r: SFSpeechRecognizer, device: Bool, hints: [String]) throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        let input = audio.inputNode
        let format = input.outputFormat(forBus: Self.bus)
        guard format.channelCount > 0 else { throw Failure.noMicrophone }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = device
        request.contextualStrings = hints
        input.installTap(onBus: Self.bus, bufferSize: Self.bufferSize, format: format) { buffer, _ in
            request.append(buffer)
        }
        audio.prepare()
        try audio.start()
        self.request = request
        onDevice = device
        heard = ""
        task = r.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async { self?.receive(result, error) }
        }
        wait(Self.firstWordSeconds)
        cap = Timer.scheduledTimer(withTimeInterval: Self.capSeconds, repeats: false) { [weak self] _ in
            self?.endAudio()
        }
    }

    private func receive(_ result: SFSpeechRecognitionResult?, _ error: Error?) {
        guard call != nil else { return }
        if let result {
            heard = result.bestTranscription.formattedString
            partial(heard)
            if result.isFinal { return finish() }
            wait(Self.quietSeconds)
        }
        // Silence, a network failure or a stop all end here with whatever was heard, maybe nothing.
        if error != nil { finish() }
    }

    private func wait(_ seconds: TimeInterval) {
        quiet?.invalidate()
        quiet = Timer.scheduledTimer(withTimeInterval: seconds, repeats: false) { [weak self] _ in self?.endAudio() }
    }

    /// Stops the mic; the recognizer then sends its last words, or `finish` runs anyway after a short wait.
    private func endAudio() {
        guard call != nil, request != nil else { return }
        stopMic()
        request?.endAudio()
        quiet?.invalidate()
        quiet = Timer.scheduledTimer(withTimeInterval: Self.lastWordsSeconds, repeats: false) { [weak self] _ in
            self?.finish()
        }
    }

    private func finish() {
        guard let call else { return }
        self.call = nil
        teardown()
        call.resolve([
            Speech.text: heard,
            Speech.engine: onDevice ? Self.deviceEngine : Self.cloudEngine,
            Speech.onDevice: onDevice,
        ])
    }

    private func stopMic() {
        if audio.isRunning { audio.stop() }
        audio.inputNode.removeTap(onBus: Self.bus)
    }

    private func teardown() {
        quiet?.invalidate()
        cap?.invalidate()
        quiet = nil
        cap = nil
        stopMic()
        request?.endAudio()
        request = nil
        task?.cancel()
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private static func denied() -> Bool {
        let speech = SFSpeechRecognizer.authorizationStatus()
        if speech == .denied || speech == .restricted { return true }
        if #available(iOS 17.0, *) { return AVAudioApplication.shared.recordPermission == .denied }
        return AVAudioSession.sharedInstance().recordPermission == .denied
    }

    /// Apple's servers serve the locale: the owner is told their voice goes to Apple, so it must be a locale Apple lists.
    private static func cloudServes(_ r: SFSpeechRecognizer, _ lang: String) -> Bool {
        let want = tag(lang)
        return r.isAvailable && SFSpeechRecognizer.supportedLocales().contains { tag($0.identifier) == want }
    }

    private static func tag(_ id: String) -> String {
        id.replacingOccurrences(of: "_", with: "-").lowercased()
    }

    /// Speech recognition, then the mic: iOS asks the owner for each once, at the first listen.
    private static func authorize(_ done: @escaping (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { return DispatchQueue.main.async { done(false) } }
            askMicrophone { granted in DispatchQueue.main.async { done(granted) } }
        }
    }

    private static func askMicrophone(_ done: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: done)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(done)
        }
    }
}
