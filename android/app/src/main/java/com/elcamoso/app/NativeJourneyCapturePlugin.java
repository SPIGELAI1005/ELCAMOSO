package com.elcamoso.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "NativeJourneyCapture",
    permissions = {
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public final class NativeJourneyCapturePlugin extends Plugin {
    private NativeJourneyStore store;
    private final BroadcastReceiver sampleReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            try {
                JSONObject sample = new JSONObject(intent.getStringExtra("sample"));
                notifyListeners("motionSample", JSObject.fromJSONObject(sample));
            } catch (Exception ignored) {}
        }
    };

    @Override public void load() {
        store = new NativeJourneyStore(getContext());
        boolean running = isRunning();
        if (!running) store.recoverInterrupted();
        ContextCompat.registerReceiver(
            getContext(), sampleReceiver, new IntentFilter(JourneyCaptureService.ACTION_SAMPLE),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @Override protected void handleOnDestroy() {
        try { getContext().unregisterReceiver(sampleReceiver); } catch (Exception ignored) {}
    }

    @PluginMethod public void requestPermissions(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            resolvePermission(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissionForAliases(new String[] { "location", "notifications" }, call, "permissionsCallback");
        } else {
            requestPermissionForAlias("location", call, "permissionsCallback");
        }
    }

    @PermissionCallback private void permissionsCallback(PluginCall call) { resolvePermission(call); }

    private void resolvePermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("location", getPermissionState("location") == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(result);
    }

    @PluginMethod public void startCapture(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Foreground location permission is required");
            return;
        }
        try {
            JSONObject options = call.getData();
            Intent intent = new Intent(getContext(), JourneyCaptureService.class)
                .setAction(JourneyCaptureService.ACTION_START)
                .putExtra("options", options.toString());
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not start drive capture", error);
        }
    }

    @PluginMethod public void stopCapture(PluginCall call) {
        Intent intent = new Intent(getContext(), JourneyCaptureService.class).setAction(JourneyCaptureService.ACTION_STOP);
        getContext().startService(intent);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            JSONArray pending = store.pending();
            JSObject result = new JSObject();
            try {
                if (pending.length() > 0) result.put("journey", pending.getJSONObject(pending.length() - 1));
            } catch (Exception ignored) {}
            call.resolve(result);
        }, 350);
    }

    @PluginMethod public void getStatus(PluginCall call) {
        try { call.resolve(JSObject.fromJSONObject(store.status(isRunning()))); }
        catch (Exception error) { call.reject("Could not read capture status", error); }
    }

    @PluginMethod public void listPendingJourneys(PluginCall call) {
        JSObject result = new JSObject();
        result.put("journeys", store.pending());
        call.resolve(result);
    }

    @PluginMethod public void acknowledgeJourneys(PluginCall call) {
        try {
            store.acknowledge(call.getArray("journeyIds", new JSArray()));
            call.resolve();
        } catch (Exception error) { call.reject("Could not acknowledge journeys", error); }
    }

    private boolean isRunning() {
        return JourneyCaptureService.running;
    }
}
