package app.gigsync.translate

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import java.util.concurrent.ConcurrentHashMap

/**
 * Translates free text on the phone with ML Kit (multilanguage plan §3.4, Tier 0). Each language has a ~30 MB pack;
 * ML Kit pivots between two Indian languages through English, whose pack is part of the library. Packs download only
 * from `prepare`, which the app calls from the owner's tap. Text never leaves the phone.
 */
@CapacitorPlugin(name = "GigSyncTranslate")
class GigSyncTranslatePlugin : Plugin() {
    private val clients = ConcurrentHashMap<String, Translator>()
    private val downloading = ConcurrentHashMap.newKeySet<String>()

    private fun lang(tag: String?): String? = tag?.let { TranslateLanguage.fromLanguageTag(it) }

    private fun key(from: String, to: String) = "$from>$to"

    private fun client(from: String, to: String): Translator =
        clients.getOrPut(key(from, to)) {
            Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(from).setTargetLanguage(to).build())
        }

    private fun status(state: String) = JSObject().apply {
        put("state", state)
        put("engine", ENGINE)
    }

    @PluginMethod
    fun state(call: PluginCall) {
        val from = lang(call.getString("from"))
        val to = lang(call.getString("to"))
        if (from == null || to == null) return call.resolve(status(UNAVAILABLE))
        if (downloading.contains(key(from, to))) return call.resolve(status(DOWNLOADING))
        val manager = RemoteModelManager.getInstance()
        val packs = listOf(from, to).filter { it != TranslateLanguage.ENGLISH }
            .map { manager.isModelDownloaded(TranslateRemoteModel.Builder(it).build()) }
        Tasks.whenAllSuccess<Boolean>(packs)
            .addOnSuccessListener { have -> call.resolve(status(if (have.all { it }) AVAILABLE else DOWNLOADABLE)) }
            .addOnFailureListener { call.resolve(status(UNAVAILABLE)) }
    }

    @PluginMethod
    fun prepare(call: PluginCall) {
        val from = lang(call.getString("from"))
        val to = lang(call.getString("to"))
        if (from == null || to == null) return call.resolve(status(UNAVAILABLE))
        val k = key(from, to)
        downloading.add(k)
        client(from, to).downloadModelIfNeeded(DownloadConditions.Builder().build())
            .addOnSuccessListener {
                downloading.remove(k)
                call.resolve(status(AVAILABLE))
            }
            .addOnFailureListener {
                downloading.remove(k)
                call.resolve(status(DOWNLOADABLE))
            }
    }

    @PluginMethod
    fun translate(call: PluginCall) {
        val from = lang(call.getString("from"))
        val to = lang(call.getString("to"))
        val text = call.getString("text")
        if (from == null || to == null || text.isNullOrBlank()) return call.resolve(result(false, ""))
        client(from, to).translate(text)
            .addOnSuccessListener { call.resolve(result(true, it)) }
            .addOnFailureListener { call.resolve(result(false, "")) }
    }

    private fun result(available: Boolean, text: String) = JSObject().apply {
        put("available", available)
        put("text", text)
        put("engine", ENGINE)
    }

    override fun handleOnDestroy() {
        clients.values.forEach { it.close() }
        clients.clear()
    }

    private companion object {
        const val ENGINE = "mlkit"
        const val AVAILABLE = "available"
        const val DOWNLOADABLE = "downloadable"
        const val DOWNLOADING = "downloading"
        const val UNAVAILABLE = "unavailable"
    }
}
