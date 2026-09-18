package com.elcamoso.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

public final class JourneyCaptureService extends Service implements LocationListener {
    public static volatile boolean running = false;
    public static final String ACTION_START = "com.elcamoso.app.START_JOURNEY_CAPTURE";
    public static final String ACTION_STOP = "com.elcamoso.app.STOP_JOURNEY_CAPTURE";
    public static final String ACTION_SAMPLE = "com.elcamoso.app.JOURNEY_MOTION_SAMPLE";
    private static final String CHANNEL_ID = "journey_capture";
    private static final int NOTIFICATION_ID = 2407;
    private LocationManager locationManager;
    private NativeJourneyStore store;
    private Location previousLocation;
    private boolean stopping;

    @Override public void onCreate() {
        super.onCreate();
        store = new NativeJourneyStore(this);
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        NotificationManager notifications = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            notifications.createNotificationChannel(new NotificationChannel(
                CHANNEL_ID, "Drive capture", NotificationManager.IMPORTANCE_LOW));
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopAndFinalize(false);
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(action)) return START_NOT_STICKY;

        ServiceCompat.startForeground(
            this, NOTIFICATION_ID, buildNotification(),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        );
        getSharedPreferences("journey_capture", MODE_PRIVATE).edit().putBoolean("running", true).apply();
        running = true;
        try {
            JSONObject options = new JSONObject(intent.getStringExtra("options"));
            store.start(options);
            requestUpdates(options.optString("quality", "balanced"));
        } catch (Exception error) {
            stopAndFinalize(true);
        }
        return START_NOT_STICKY;
    }

    private void requestUpdates(String quality) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopAndFinalize(true);
            return;
        }
        long minTime = "high-detail".equals(quality) ? 500 : 1000;
        float minDistance = "high-detail".equals(quality) ? 2f : 8f;
        try { locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, minTime, minDistance, this); }
        catch (Exception ignored) {}
        try { locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, minTime, minDistance, this); }
        catch (Exception ignored) {}
    }

    private Notification buildNotification() {
        Intent stop = new Intent(this, JourneyCaptureService.class).setAction(ACTION_STOP);
        PendingIntent stopIntent = PendingIntent.getService(
            this, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openIntent = PendingIntent.getActivity(
            this, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("ELCAMOSO is capturing this drive")
            .setContentText("Motion only. Your route is not saved.")
            .setContentIntent(openIntent).setOngoing(true).setOnlyAlertOnce(true)
            .addAction(0, "Stop", stopIntent).build();
    }

    @Override public void onLocationChanged(Location location) {
        try {
            JSONObject sample = store.addLocation(location, previousLocation);
            previousLocation = new Location(location); // Coordinates remain memory-only.
            if (sample != null) {
                Intent event = new Intent(ACTION_SAMPLE).setPackage(getPackageName());
                event.putExtra("sample", sample.toString());
                sendBroadcast(event);
            }
        } catch (Exception ignored) {}
    }

    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}
    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onDestroy() {
        if (!stopping) {
            try { store.finalizeJourney(true); } catch (Exception ignored) {}
        }
        locationManager.removeUpdates(this);
        getSharedPreferences("journey_capture", MODE_PRIVATE).edit().putBoolean("running", false).apply();
        running = false;
        super.onDestroy();
    }

    private void stopAndFinalize(boolean incomplete) {
        stopping = true;
        locationManager.removeUpdates(this);
        try { store.finalizeJourney(incomplete); } catch (Exception ignored) {}
        getSharedPreferences("journey_capture", MODE_PRIVATE).edit().putBoolean("running", false).apply();
        running = false;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }
}
