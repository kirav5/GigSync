package app.gigsync;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens a UPI payment link in Android's chooser, which lists every UPI app on the phone every time. A plain link goes
 * to whichever app the phone was once told to always use, so the household could not pick another.
 */
@CapacitorPlugin(name = "GigSyncUpi")
public class UpiPlugin extends Plugin {
    /** The only links this opens: NPCI's payment scheme, never an arbitrary intent. */
    private static final String UPI_PAY = "upi://pay?";

    @PluginMethod
    public void pay(PluginCall call) {
        String link = call.getString("link");
        if (link == null || !link.startsWith(UPI_PAY)) {
            call.reject("not a UPI payment link");
            return;
        }
        Intent pay = new Intent(Intent.ACTION_VIEW, Uri.parse(link));
        Intent chooser = Intent.createChooser(pay, call.getString("title"));
        try {
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("no UPI app");
        }
    }
}
