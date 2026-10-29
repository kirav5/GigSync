package app.gigsync.speech

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import java.util.Locale
import java.util.UUID

/**
 * Reads text aloud with the phone's TextToSpeech engine (spec §3.1), with installed voices that need no network only:
 * an agent's reply can be private, so a voice that would send the text to a server is never picked. Missing voice
 * data reports "downloadable", and `prepare` opens the engine's own install screen, from the owner's tap. The engine
 * starts on first use; calls wait for it on the main thread.
 */
internal class Speaker(private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private var tts: TextToSpeech? = null

    /** null while the engine starts; then whether it started. */
    private var ready: Boolean? = null
    private val waiting = mutableListOf<(TextToSpeech?) -> Unit>()

    /** Speak calls waiting for their utterance to end, by utterance id. */
    private val speaking = mutableMapOf<String, PluginCall>()

    fun state(lang: String, done: (JSObject) -> Unit) {
        withEngine { engine -> done(Speech.status(stateOf(engine, lang), if (engine == null) Speech.NONE else ENGINE)) }
    }

    fun prepare(lang: String, done: (JSObject) -> Unit) {
        main.post {
            try {
                val install = Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(install)
            } catch (e: ActivityNotFoundException) {
                // No engine offers an install screen: the state below stays as it was.
            }
            state(lang, done)
        }
    }

    /** Resolves when the words have been spoken, or when the app stops or replaces them. */
    fun speak(call: PluginCall) {
        withEngine { engine ->
            val lang = call.getString(Speech.LANG)
            val text = call.getString(Speech.TEXT)
            val voice = if (engine != null && lang != null) localVoice(engine, lang) else null
            if (engine == null || voice == null || text.isNullOrBlank()) {
                return@withEngine call.reject("no local voice for this language", Speech.UNAVAILABLE)
            }
            settleAll()
            engine.voice = voice
            val id = UUID.randomUUID().toString()
            speaking[id] = call
            val words = text.take(TextToSpeech.getMaxSpeechInputLength())
            if (engine.speak(words, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) {
                speaking.remove(id)
                call.reject("the voice would not speak")
            }
        }
    }

    fun stop() {
        withEngine { engine ->
            engine?.stop()
            settleAll()
        }
    }

    fun shutdown() {
        main.post {
            tts?.shutdown()
            tts = null
            ready = null
            settleAll()
        }
    }

    private fun withEngine(work: (TextToSpeech?) -> Unit) {
        main.post {
            when (ready) {
                true -> work(tts)
                false -> work(null)
                null -> {
                    waiting += work
                    start()
                }
            }
        }
    }

    private fun start() {
        if (tts != null) return
        tts = TextToSpeech(context) { status ->
            main.post {
                ready = status == TextToSpeech.SUCCESS
                if (ready == true) {
                    tts?.setOnUtteranceProgressListener(progress)
                } else {
                    tts?.shutdown()
                    tts = null
                }
                val engine = tts
                waiting.forEach { it(engine) }
                waiting.clear()
            }
        }
    }

    private fun stateOf(engine: TextToSpeech?, lang: String): String =
        when {
            engine == null -> Speech.UNAVAILABLE
            localVoice(engine, lang) != null -> Speech.AVAILABLE
            needsData(engine, lang) -> Speech.DOWNLOADABLE
            else -> Speech.UNAVAILABLE
        }

    /** The engine's voices for the locale: same language, and same country when the locale names one. */
    private fun voicesFor(engine: TextToSpeech, lang: String): List<Voice> {
        val want = Locale.forLanguageTag(lang)
        val all =
            try {
                engine.voices.orEmpty()
            } catch (e: RuntimeException) {
                // Some engines throw while their voice list loads; no voice is the honest answer.
                emptySet()
            }
        return all.filter { it.locale.language == want.language && (want.country.isEmpty() || it.locale.country == want.country) }
    }

    private fun installed(v: Voice) = TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in v.features.orEmpty()

    private fun localVoice(engine: TextToSpeech, lang: String): Voice? =
        voicesFor(engine, lang).filter { !it.isNetworkConnectionRequired && installed(it) }.maxByOrNull { it.quality }

    private fun needsData(engine: TextToSpeech, lang: String): Boolean =
        engine.isLanguageAvailable(Locale.forLanguageTag(lang)) == TextToSpeech.LANG_MISSING_DATA ||
            voicesFor(engine, lang).any { !it.isNetworkConnectionRequired && !installed(it) }

    private fun settle(id: String?) {
        main.post { id?.let { speaking.remove(it)?.resolve() } }
    }

    private fun fail(id: String?) {
        main.post { id?.let { speaking.remove(it)?.reject("the voice failed") } }
    }

    private fun settleAll() {
        speaking.values.forEach { it.resolve() }
        speaking.clear()
    }

    private val progress =
        object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}

            override fun onDone(utteranceId: String?) = settle(utteranceId)

            override fun onStop(utteranceId: String?, interrupted: Boolean) = settle(utteranceId)

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = fail(utteranceId)

            override fun onError(utteranceId: String?, errorCode: Int) = fail(utteranceId)
        }

    private companion object {
        const val ENGINE = "android-ondevice"
    }
}
