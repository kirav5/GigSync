package app.gigsync.speech

import android.Manifest
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Voice on Android (spec §3.1, ADR 0023): speech to text in [Recognizer], reading aloud in [Speaker]. The mic is asked
 * for at the first listen, never earlier, through Capacitor's "microphone" alias; a refusal the owner can no longer
 * undo here reports "denied", and the app points them to the phone's settings.
 */
@CapacitorPlugin(
    name = "GigSyncSpeech",
    permissions = [Permission(alias = Speech.MICROPHONE, strings = [Manifest.permission.RECORD_AUDIO])],
)
class GigSyncSpeechPlugin : Plugin() {
    private lateinit var recognizer: Recognizer
    private lateinit var speaker: Speaker

    override fun load() {
        recognizer = Recognizer(context) { text -> notifyListeners(Speech.PARTIAL, JSObject().put(Speech.TEXT, text)) }
        speaker = Speaker(context)
    }

    @PluginMethod
    fun state(call: PluginCall) {
        val lang = call.getString(Speech.LANG) ?: return call.resolve(Speech.status(Speech.UNAVAILABLE, Speech.NONE))
        if (call.getString(Speech.MODE) == Speech.SPEAK) return speaker.state(lang, call::resolve)
        recognizer.state(lang, getPermissionState(Speech.MICROPHONE) == PermissionState.DENIED, call::resolve)
    }

    /** Fetches the language's recognizer model or voice data. The app calls it only from the owner's tap. */
    @PluginMethod
    fun prepare(call: PluginCall) {
        val lang = call.getString(Speech.LANG) ?: return call.resolve(Speech.status(Speech.UNAVAILABLE, Speech.NONE))
        if (call.getString(Speech.MODE) == Speech.SPEAK) speaker.prepare(lang, call::resolve)
        else recognizer.prepare(lang, call::resolve)
    }

    @PluginMethod
    fun listen(call: PluginCall) {
        if (getPermissionState(Speech.MICROPHONE) == PermissionState.GRANTED) return recognizer.listen(call)
        requestPermissionForAlias(Speech.MICROPHONE, call, MIC_ANSWERED)
    }

    @PermissionCallback
    private fun micAnswered(call: PluginCall) {
        if (getPermissionState(Speech.MICROPHONE) == PermissionState.GRANTED) recognizer.listen(call)
        else call.reject("microphone not allowed", Speech.DENIED)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        recognizer.stop()
        call.resolve()
    }

    @PluginMethod
    fun speak(call: PluginCall) {
        speaker.speak(call)
    }

    @PluginMethod
    fun stopSpeaking(call: PluginCall) {
        speaker.stop()
        call.resolve()
    }

    override fun handleOnDestroy() {
        recognizer.destroy()
        speaker.shutdown()
    }

    private companion object {
        /** The name of [micAnswered], which Capacitor calls once the owner has answered the mic prompt. */
        const val MIC_ANSWERED = "micAnswered"
    }
}

/** Names the web layer reads (definitions.ts), written once for the three Kotlin files. */
internal object Speech {
    const val MICROPHONE = "microphone"
    const val PARTIAL = "partial"
    const val SPEAK = "speak"

    const val LANG = "lang"
    const val MODE = "mode"
    const val TEXT = "text"
    const val HINTS = "hints"
    const val ALLOW_CLOUD = "allowCloud"
    const val STATE = "state"
    const val ENGINE = "engine"
    const val CLOUD = "cloud"
    const val VENDOR = "vendor"
    const val ON_DEVICE = "onDevice"

    const val AVAILABLE = "available"
    const val DOWNLOADABLE = "downloadable"
    const val DOWNLOADING = "downloading"
    const val UNAVAILABLE = "unavailable"
    const val DENIED = "denied"
    const val BUSY = "busy"
    const val NONE = "none"

    fun status(state: String, engine: String): JSObject = JSObject().put(STATE, state).put(ENGINE, engine)
}
