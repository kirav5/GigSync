package app.gigsync.llm

import android.app.ActivityManager
import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Runs a small language model on the phone. M0: reports "no model" so the agent stays in lite mode.
 * M1: load a Gemma-class model delivered as a Play AI pack through LiteRT-LM, and stream tokens back.
 */
@CapacitorPlugin(name = "GigSyncLLM")
class GigSyncLLMPlugin : Plugin() {

    @PluginMethod
    fun status(call: PluginCall) {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val info = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        val result = JSObject()
        result.put("available", false)
        result.put("engine", "none")
        result.put("freeMemoryMb", info.availMem / (1024 * 1024))
        call.resolve(result)
    }

    /** Nothing to download yet (M0); reports the same as status. M1 fetches the Play AI pack here. */
    @PluginMethod
    fun prepare(call: PluginCall) = status(call)

    @PluginMethod
    fun generate(call: PluginCall) {
        if (call.getString("prompt").isNullOrBlank()) {
            call.reject("prompt is required")
            return
        }
        // TODO(M1): LlmInference.createFromOptions(context, …).generateResponse(prompt) on a background thread.
        val result = JSObject()
        result.put("available", false)
        result.put("text", "")
        result.put("engine", "none")
        call.resolve(result)
    }
}
