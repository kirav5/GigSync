package app.gigsync;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** The web view's text at its designed size: the app sets its own sizes, larger for Hindi and Kannada. */
    private static final int TEXT_ZOOM_PERCENT = 100;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins register before the bridge starts.
        registerPlugin(UpiPlugin.class);
        super.onCreate(savedInstanceState);
        // Android's web view scales text by the phone's font-size setting on top of the app's own sizes, so labels
        // grew past their buttons and cards; the app draws the sizes it was designed and tested at, as on iOS.
        getBridge().getWebView().getSettings().setTextZoom(TEXT_ZOOM_PERCENT);
    }
}
