package com.elcamoso.app;

import android.content.Context;
import android.location.Location;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/** Durable, privacy-safe native trace store. Coordinates never enter JSON. */
public final class NativeJourneyStore {
    private static final Object LOCK = new Object();
    private final File root;
    private final File completed;
    private final File activeFile;
    private final File chunks;

    public NativeJourneyStore(Context context) {
        root = new File(context.getFilesDir(), "native-journeys");
        completed = new File(root, "completed");
        activeFile = new File(root, "active.json");
        chunks = new File(root, "chunks");
        completed.mkdirs();
        chunks.mkdirs();
    }

    public void start(JSONObject options) throws Exception {
        synchronized (LOCK) {
            JSONObject active = new JSONObject();
            active.put("version", 1);
            active.put("journeyId", options.getString("journeyId"));
            active.put("startedAt", options.getLong("startedAt"));
            active.put("outputMode", options.getString("outputMode"));
            active.put("captureProfileId", options.opt("captureProfileId"));
            active.put("quality", options.optString("quality", "balanced"));
            active.put("samples", new JSONArray());
            active.put("semanticEvents", new JSONArray());
            active.put("gaps", new JSONArray());
            active.put("distanceM", 0d);
            active.put("speedSum", 0d);
            active.put("maxSpeedKmh", 0d);
            active.put("movingCount", 0);
            active.put("previousSpeedKmh", 0d);
            active.put("previousAccel", 0d);
            active.put("previousT", 0);
            active.put("chunkIndex", 0);
            active.put("persistedSampleCount", 0);
            writeAtomic(activeFile, active.toString());
        }
    }

    public JSONObject addLocation(Location location, Location previousLocation) throws Exception {
        synchronized (LOCK) {
            JSONObject active = read(activeFile);
            if (active == null) return null;
            long now = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();
            int t = (int) Math.max(0, now - active.getLong("startedAt"));
            int previousT = active.optInt("previousT", 0);
            double dt = Math.max(0.05, (t - previousT) / 1000d);
            double previousSpeed = active.optDouble("previousSpeedKmh", 0);
            double speedKmh;
            if (location.hasSpeed()) speedKmh = Math.max(0, location.getSpeed() * 3.6);
            else if (previousLocation != null && now > previousLocation.getTime()) {
                speedKmh = previousLocation.distanceTo(location) / ((now - previousLocation.getTime()) / 1000d) * 3.6;
            } else speedKmh = previousSpeed;
            double accel = ((speedKmh - previousSpeed) / 3.6) / dt;
            double previousAccel = active.optDouble("previousAccel", 0);
            double jerk = clamp((accel - previousAccel) / dt / 8, -1, 1);
            double accuracy = location.hasAccuracy() ? location.getAccuracy() : 80;
            double sourceQuality = clamp(1 - accuracy / 80, 0, 1);

            if (previousT > 0 && t - previousT > 15_000) {
                active.getJSONArray("gaps").put(new JSONObject()
                    .put("startT", previousT).put("endT", t).put("reason", "sensor_loss"));
                active.getJSONArray("semanticEvents").put(new JSONObject()
                    .put("t", previousT).put("type", "data_gap"));
            }
            JSONObject sample = new JSONObject()
                .put("t", t).put("speedKmh", speedKmh)
                .put("acceleration", accel).put("longitudinalAccel", accel)
                .put("jerk", jerk)
                .put("driverDemandEstimate", clamp(accel / 3.5, 0, 1))
                .put("regenEstimate", clamp(-accel / 4.5, 0, 1))
                .put("movementConfidence", sourceQuality).put("sourceQuality", sourceQuality)
                .put("primarySource", "phone");
            active.getJSONArray("samples").put(sample);
            if (previousLocation != null) {
                active.put("distanceM", active.optDouble("distanceM", 0) + previousLocation.distanceTo(location));
            }
            active.put("speedSum", active.optDouble("speedSum", 0) + speedKmh);
            active.put("maxSpeedKmh", Math.max(active.optDouble("maxSpeedKmh", 0), speedKmh));
            if (speedKmh > 3) active.put("movingCount", active.optInt("movingCount", 0) + 1);
            active.put("previousSpeedKmh", speedKmh);
            active.put("previousAccel", accel);
            active.put("previousT", t);
            checkpoint(active);
            writeAtomic(activeFile, active.toString());

            return new JSONObject().put("timestamp", now).put("speedKmh", speedKmh)
                .put("accelerationLongitudinal", accel).put("accuracy", accuracy);
        }
    }

    public JSONObject finalizeJourney(boolean incomplete) throws Exception {
        synchronized (LOCK) {
            JSONObject active = read(activeFile);
            if (active == null) return null;
            long now = System.currentTimeMillis();
            int duration = (int) Math.max(0, now - active.getLong("startedAt"));
            JSONArray samples = allSamples(active);
            JSONArray gaps = active.getJSONArray("gaps");
            int count = samples.length();
            int gapMs = 0;
            for (int i = 0; i < gaps.length(); i++) {
                JSONObject gap = gaps.getJSONObject(i);
                gapMs += Math.max(0, gap.optInt("endT") - gap.optInt("startT"));
            }
            JSONObject summary = new JSONObject()
                .put("sampleCount", count).put("durationMs", duration)
                .put("distanceM", active.optDouble("distanceM", 0))
                .put("meanSpeedKmh", count > 0 ? active.optDouble("speedSum", 0) / count : 0)
                .put("maxSpeedKmh", active.optDouble("maxSpeedKmh", 0))
                .put("movingShare", count > 0 ? active.optInt("movingCount", 0) / (double) count : 0)
                .put("gapCount", gaps.length()).put("gapMs", gapMs)
                .put("primarySource", count > 0 ? "phone" : "none")
                .put("endedUnexpectedly", incomplete).put("browserPaused", false);
            JSONObject trace = new JSONObject()
                .put("version", 1).put("journeyId", active.getString("journeyId"))
                .put("startedAt", active.getLong("startedAt")).put("endedAt", now)
                .put("durationMs", duration).put("outputMode", active.getString("outputMode"))
                .put("captureProfileId", active.opt("captureProfileId"))
                .put("status", incomplete ? "incomplete" : "complete")
                .put("samples", samples).put("semanticEvents", active.getJSONArray("semanticEvents"))
                .put("gaps", gaps).put("summary", summary);
            writeAtomic(new File(completed, safeId(active.getString("journeyId")) + ".json"), trace.toString());
            activeFile.delete();
            deleteTree(new File(chunks, safeId(active.getString("journeyId"))));
            return trace;
        }
    }

    public void recoverInterrupted() {
        synchronized (LOCK) {
            if (!activeFile.exists()) return;
            try { finalizeJourney(true); } catch (Exception ignored) {}
        }
    }

    public JSONObject status(boolean serviceRunning) {
        synchronized (LOCK) {
            JSONObject active = read(activeFile);
            JSONObject status = new JSONObject();
            try {
                status.put("active", serviceRunning && active != null);
                status.put("backgroundCapable", true);
                status.put("startedAt", active == null ? JSONObject.NULL : active.optLong("startedAt"));
                status.put("durationMs", active == null ? 0 : Math.max(0, System.currentTimeMillis() - active.optLong("startedAt")));
                status.put("sampleCount", active == null ? 0 : active.optInt("persistedSampleCount", 0) + active.optJSONArray("samples").length());
                status.put("distanceM", active == null ? 0 : active.optDouble("distanceM", 0));
                status.put("quality", active == null ? "balanced" : active.optString("quality", "balanced"));
                status.put("detail", "reduced");
                status.put("permission", "granted");
            } catch (Exception ignored) {}
            return status;
        }
    }

    public JSONArray pending() {
        synchronized (LOCK) {
            JSONArray result = new JSONArray();
            File[] files = completed.listFiles((dir, name) -> name.endsWith(".json"));
            if (files == null) return result;
            for (File file : files) {
                JSONObject trace = read(file);
                if (trace != null) result.put(trace);
            }
            return result;
        }
    }

    public void acknowledge(JSONArray ids) {
        synchronized (LOCK) {
            for (int i = 0; i < ids.length(); i++) {
                String id = ids.optString(i, "");
                if (id.matches("[A-Za-z0-9_-]+")) new File(completed, id + ".json").delete();
            }
        }
    }

    public String quality() {
        JSONObject active = read(activeFile);
        return active == null ? "balanced" : active.optString("quality", "balanced");
    }

    private static double clamp(double n, double min, double max) { return Math.max(min, Math.min(max, n)); }
    private static String safeId(String id) { return id.replaceAll("[^A-Za-z0-9_-]", "_"); }

    private static JSONObject read(File file) {
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] bytes = new byte[(int) file.length()];
            int read = input.read(bytes);
            return read > 0 ? new JSONObject(new String(bytes, 0, read, StandardCharsets.UTF_8)) : null;
        } catch (Exception ignored) { return null; }
    }

    private static void writeAtomic(File target, String value) throws Exception {
        target.getParentFile().mkdirs();
        File temp = new File(target.getParentFile(), target.getName() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temp)) {
            output.write(value.getBytes(StandardCharsets.UTF_8));
            output.getFD().sync();
        }
        if (target.exists() && !target.delete()) throw new Exception("Could not replace native journey");
        if (!temp.renameTo(target)) throw new Exception("Could not commit native journey");
    }

    private void checkpoint(JSONObject active) throws Exception {
        JSONArray samples = active.getJSONArray("samples");
        if (samples.length() < 20) return;
        File journeyChunks = new File(chunks, safeId(active.getString("journeyId")));
        journeyChunks.mkdirs();
        int index = active.optInt("chunkIndex", 0);
        writeAtomic(new File(journeyChunks, index + ".json"), samples.toString());
        active.put("persistedSampleCount", active.optInt("persistedSampleCount", 0) + samples.length());
        active.put("chunkIndex", index + 1);
        active.put("samples", new JSONArray());
    }

    private JSONArray allSamples(JSONObject active) throws Exception {
        JSONArray result = new JSONArray();
        File directory = new File(chunks, safeId(active.getString("journeyId")));
        int count = active.optInt("chunkIndex", 0);
        for (int index = 0; index < count; index++) {
            File file = new File(directory, index + ".json");
            try (FileInputStream input = new FileInputStream(file)) {
                byte[] bytes = new byte[(int) file.length()];
                int read = input.read(bytes);
                JSONArray chunk = new JSONArray(new String(bytes, 0, read, StandardCharsets.UTF_8));
                for (int i = 0; i < chunk.length(); i++) result.put(chunk.getJSONObject(i));
            }
        }
        JSONArray buffered = active.getJSONArray("samples");
        for (int i = 0; i < buffered.length(); i++) result.put(buffered.getJSONObject(i));
        return result;
    }

    private static void deleteTree(File file) {
        if (!file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteTree(child);
        file.delete();
    }
}
