package app.gigsync.speech

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognitionService
import android.speech.RecognitionSupport
import android.speech.RecognitionSupportCallback
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.annotation.RequiresApi
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import org.json.JSONException

/**
 * Speech to text (spec §3.1, ADR 0023). On the phone first, with `createOnDeviceSpeechRecognizer` (Android 12+), whose
 * audio never leaves the phone; on Android 13+ its per-language support says whether a language is installed,
 * downloading or downloadable. Otherwise Google's recognizer on the phone, bound by name so the audio goes only to the
 * company the owner was told about, and only when the app passes allowCloud, which it does only after the owner
 * allowed Google. SpeechRecognizer must be created and called on the main thread, so everything here runs there.
 */
internal class Recognizer(private val context: Context, private val partial: (String) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private var active: SpeechRecognizer? = null
    private var downloader: SpeechRecognizer? = null
    private var busy = false

    /** Languages a recognizer refused while listening; they stay refused until the app restarts. */
    private val refusedOnDevice = mutableSetOf<String>()
    private val refusedInCloud = mutableSetOf<String>()

    fun state(lang: String, denied: Boolean, done: (JSObject) -> Unit) {
        main.post { deviceState(lang) { done(status(lang, if (denied) Speech.DENIED else it)) } }
    }

    /** Asks the on-device service to fetch the language (Android 13+); it downloads in the background. */
    fun prepare(lang: String, done: (JSObject) -> Unit) {
        main.post {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
                downloader?.destroy()
                downloader = SpeechRecognizer.createOnDeviceSpeechRecognizer(context).also {
                    it.triggerModelDownload(intent(lang, emptyList()))
                }
            }
            deviceState(lang) { done(status(lang, it)) }
        }
    }

    fun listen(call: PluginCall) {
        main.post {
            if (busy) return@post call.reject("already listening", Speech.BUSY)
            val lang = call.getString(Speech.LANG) ?: return@post call.reject("no language", Speech.UNAVAILABLE)
            val allowCloud = call.getBoolean(Speech.ALLOW_CLOUD, false) == true
            val hints = hints(call)
            busy = true
            deviceState(lang) { state ->
                val cloud = if (allowCloud && lang !in refusedInCloud) cloudService() else null
                when {
                    state == Speech.AVAILABLE && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
                        start(call, lang, SpeechRecognizer.createOnDeviceSpeechRecognizer(context), hints, true)
                    cloud != null -> start(call, lang, SpeechRecognizer.createSpeechRecognizer(context, cloud), hints, false)
                    else -> {
                        busy = false
                        val waiting = state == Speech.DOWNLOADABLE || state == Speech.DOWNLOADING
                        call.reject("no recognizer for this language", if (waiting) Speech.DOWNLOADABLE else Speech.UNAVAILABLE)
                    }
                }
            }
        }
    }

    /** Ends listening; the words heard so far still come back from listen. */
    fun stop() {
        main.post { active?.stopListening() }
    }

    fun destroy() {
        main.post {
            active?.destroy()
            downloader?.destroy()
            active = null
            downloader = null
            busy = false
        }
    }

    private fun start(call: PluginCall, lang: String, r: SpeechRecognizer, hints: List<String>, onDevice: Boolean) {
        active = r
        r.setRecognitionListener(Listener(call, lang, onDevice))
        r.startListening(intent(lang, hints))
    }

    private fun finish() {
        active?.destroy()
        active = null
        busy = false
    }

    private fun deviceState(lang: String, done: (String) -> Unit) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || lang in refusedOnDevice) return done(Speech.UNAVAILABLE)
        if (!SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) return done(Speech.UNAVAILABLE)
        // Android 12: no per-language check before listening; a language error while listening refuses it instead.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return done(Speech.AVAILABLE)
        support(lang, done)
    }

    /** The on-device service's answer for the language; a service that never answers counts as unavailable. */
    @RequiresApi(Build.VERSION_CODES.TIRAMISU)
    private fun support(lang: String, done: (String) -> Unit) {
        val checker = SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        var answered = false
        val answer = { state: String ->
            if (!answered) {
                answered = true
                checker.destroy()
                done(state)
            }
        }
        val callback = object : RecognitionSupportCallback {
            override fun onSupportResult(support: RecognitionSupport) =
                answer(
                    when {
                        has(support.installedOnDeviceLanguages, lang) -> Speech.AVAILABLE
                        has(support.pendingOnDeviceLanguages, lang) -> Speech.DOWNLOADING
                        has(support.supportedOnDeviceLanguages, lang) -> Speech.DOWNLOADABLE
                        else -> Speech.UNAVAILABLE
                    },
                )

            override fun onError(error: Int) = answer(Speech.UNAVAILABLE)
        }
        main.postDelayed({ answer(Speech.UNAVAILABLE) }, SUPPORT_MS)
        checker.checkRecognitionSupport(intent(lang, emptyList()), context.mainExecutor, callback)
    }

    private fun has(langs: List<String>, lang: String) = langs.any { it.replace('_', '-').equals(lang, ignoreCase = true) }

    /** Google's recognizer, by name: the owner was told their voice goes to Google, so it may go nowhere else. */
    @Suppress("DEPRECATION")
    private fun cloudService(): ComponentName? {
        val found = context.packageManager.queryIntentServices(Intent(RecognitionService.SERVICE_INTERFACE), 0)
            .map { ComponentName(it.serviceInfo.packageName, it.serviceInfo.name) }
        return GOOGLE_RECOGNIZERS.firstNotNullOfOrNull { pkg -> found.firstOrNull { it.packageName == pkg } }
    }

    private fun status(lang: String, state: String): JSObject {
        val onDeviceApi = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
        val s = Speech.status(state, if (onDeviceApi) DEVICE_ENGINE else Speech.NONE)
        val offerCloud = state != Speech.AVAILABLE && state != Speech.DENIED && lang !in refusedInCloud
        if (offerCloud && cloudService() != null) {
            s.put(Speech.CLOUD, JSObject().put(Speech.ENGINE, CLOUD_ENGINE).put(Speech.VENDOR, GOOGLE))
        }
        return s
    }

    private fun hints(call: PluginCall): List<String> =
        try {
            call.getArray(Speech.HINTS)?.toList<String>() ?: emptyList()
        } catch (e: JSONException) {
            emptyList()
        }

    private fun intent(lang: String, hints: List<String>) =
        Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (hints.isNotEmpty()) putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS, ArrayList(hints))
                putExtra(RecognizerIntent.EXTRA_ENABLE_FORMATTING, RecognizerIntent.FORMATTING_OPTIMIZE_QUALITY)
            }
        }

    /** One listen: partial words go to the app as they come; the call settles exactly once. */
    private inner class Listener(
        private val call: PluginCall,
        private val lang: String,
        private val onDevice: Boolean,
    ) : RecognitionListener {
        private var heard = ""
        private var settled = false

        override fun onPartialResults(partialResults: Bundle?) {
            words(partialResults)?.let {
                heard = it
                partial(it)
            }
        }

        override fun onResults(results: Bundle?) {
            if (settle()) call.resolve(result(words(results) ?: heard))
        }

        override fun onError(error: Int) {
            if (!settle()) return
            when (error) {
                // Silence, nothing matched, or stopped by the app: what was heard so far, maybe nothing.
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT, SpeechRecognizer.ERROR_CLIENT ->
                    call.resolve(result(heard))
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> call.reject("microphone not allowed", Speech.DENIED)
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> call.reject("the recognizer is busy", Speech.BUSY)
                // The model is missing: downloadable on Android 13+, which has the download call; refused before that.
                SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
                    if (onDevice && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        call.reject("the language model is not on this phone yet", Speech.DOWNLOADABLE)
                    } else {
                        refuse()
                    }
                SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> refuse()
                else -> call.reject("the recognizer failed ($error)")
            }
        }

        private fun settle(): Boolean {
            if (settled) return false
            settled = true
            finish()
            return true
        }

        private fun refuse() {
            (if (onDevice) refusedOnDevice else refusedInCloud).add(lang)
            call.reject("the recognizer refused this language", Speech.UNAVAILABLE)
        }

        private fun words(results: Bundle?) =
            results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.takeIf { it.isNotBlank() }

        private fun result(text: String) =
            JSObject()
                .put(Speech.TEXT, text)
                .put(Speech.ENGINE, if (onDevice) DEVICE_ENGINE else CLOUD_ENGINE)
                .put(Speech.ON_DEVICE, onDevice)

        override fun onReadyForSpeech(params: Bundle?) {}

        override fun onBeginningOfSpeech() {}

        override fun onRmsChanged(rmsdB: Float) {}

        override fun onBufferReceived(buffer: ByteArray?) {}

        override fun onEndOfSpeech() {}

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    private companion object {
        const val DEVICE_ENGINE = "android-ondevice"
        const val CLOUD_ENGINE = "android-cloud"
        const val GOOGLE = "google"

        /** How long the on-device service gets to say what it supports. */
        const val SUPPORT_MS = 3000L

        /** The Google app, then Speech Services by Google: the packages that run Google's recognizer. */
        val GOOGLE_RECOGNIZERS = listOf("com.google.android.googlequicksearchbox", "com.google.android.tts")
    }
}
