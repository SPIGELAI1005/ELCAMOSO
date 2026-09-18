import Foundation
import CoreLocation
import Capacitor

private struct NativeSample: Codable {
    let t: Int
    let speedKmh: Double
    let acceleration: Double
    let longitudinalAccel: Double
    let jerk: Double
    let driverDemandEstimate: Double
    let regenEstimate: Double
    let movementConfidence: Double
    let sourceQuality: Double
    let primarySource: String
}

private struct NativeGap: Codable {
    let startT: Int
    let endT: Int
    let reason: String
}

private struct NativeEvent: Codable {
    let t: Int
    let type: String
    let intensity: Double?
}

private struct ActiveJourney: Codable {
    let version: Int
    let journeyId: String
    let startedAt: Int64
    let outputMode: String
    let captureProfileId: String?
    let quality: String
    var samples: [NativeSample]
    var semanticEvents: [NativeEvent]
    var gaps: [NativeGap]
    var distanceM: Double
    var speedSum: Double
    var maxSpeedKmh: Double
    var movingCount: Int
    var previousSpeedKmh: Double
    var previousAccel: Double
    var previousT: Int
    var chunkIndex: Int
    var persistedSampleCount: Int
}

private final class NativeJourneyStore {
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let root: URL
    private let activeURL: URL
    private let completedURL: URL
    private let chunksURL: URL

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        root = support.appendingPathComponent("NativeJourneys", isDirectory: true)
        activeURL = root.appendingPathComponent("active.json")
        completedURL = root.appendingPathComponent("completed", isDirectory: true)
        chunksURL = root.appendingPathComponent("chunks", isDirectory: true)
        try? FileManager.default.createDirectory(at: completedURL, withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: chunksURL, withIntermediateDirectories: true)
    }

    func saveActive(_ value: ActiveJourney) throws -> ActiveJourney {
        var active = value
        if active.samples.count >= 20 {
            let journeyChunks = chunksURL.appendingPathComponent(active.journeyId, isDirectory: true)
            try FileManager.default.createDirectory(at: journeyChunks, withIntermediateDirectories: true)
            let chunk = try encoder.encode(active.samples)
            try chunk.write(to: journeyChunks.appendingPathComponent("\(active.chunkIndex).json"), options: .atomic)
            active.persistedSampleCount += active.samples.count
            active.chunkIndex += 1
            active.samples.removeAll(keepingCapacity: true)
        }
        let data = try encoder.encode(active)
        try data.write(to: activeURL, options: .atomic)
        return active
    }

    func loadActive() -> ActiveJourney? {
        guard let data = try? Data(contentsOf: activeURL) else { return nil }
        return try? decoder.decode(ActiveJourney.self, from: data)
    }

    func finalize(_ active: ActiveJourney, incomplete: Bool) throws -> [String: Any] {
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        let duration = max(0, Int(now - active.startedAt))
        let allSamples = loadSamples(active)
        let count = allSamples.count
        let gapMs = active.gaps.reduce(0) { $0 + max(0, $1.endT - $1.startT) }
        let summary: [String: Any] = [
            "sampleCount": count,
            "durationMs": duration,
            "distanceM": active.distanceM,
            "meanSpeedKmh": count > 0 ? active.speedSum / Double(count) : 0,
            "maxSpeedKmh": active.maxSpeedKmh,
            "movingShare": count > 0 ? Double(active.movingCount) / Double(count) : 0,
            "gapCount": active.gaps.count,
            "gapMs": gapMs,
            "primarySource": count > 0 ? "phone" : "none",
            "endedUnexpectedly": incomplete,
            "browserPaused": false
        ]
        let trace: [String: Any] = [
            "version": 1,
            "journeyId": active.journeyId,
            "startedAt": active.startedAt,
            "endedAt": now,
            "durationMs": duration,
            "outputMode": active.outputMode,
            "captureProfileId": (active.captureProfileId as Any?) ?? NSNull(),
            "status": incomplete ? "incomplete" : "complete",
            "samples": try jsonObjects(allSamples),
            "semanticEvents": try jsonObjects(active.semanticEvents),
            "gaps": try jsonObjects(active.gaps),
            "summary": summary
        ]
        let data = try JSONSerialization.data(withJSONObject: trace)
        try data.write(to: completedURL.appendingPathComponent("\(active.journeyId).json"), options: .atomic)
        try? FileManager.default.removeItem(at: activeURL)
        try? FileManager.default.removeItem(at: chunksURL.appendingPathComponent(active.journeyId, isDirectory: true))
        return trace
    }

    func recoverInterrupted() {
        guard var active = loadActive() else { return }
        let endT = max(active.previousT, Int(Date().timeIntervalSince1970 * 1000) - Int(active.startedAt))
        if endT > active.previousT {
            active.gaps.append(NativeGap(startT: active.previousT, endT: endT, reason: "sensor_loss"))
            active.semanticEvents.append(NativeEvent(t: active.previousT, type: "data_gap", intensity: nil))
        }
        _ = try? finalize(active, incomplete: true)
    }

    func pending() -> [[String: Any]] {
        let urls = (try? FileManager.default.contentsOfDirectory(at: completedURL, includingPropertiesForKeys: nil)) ?? []
        return urls.compactMap { url in
            guard let data = try? Data(contentsOf: url),
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
            return object
        }
    }

    func acknowledge(_ ids: [String]) {
        for id in ids where id.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil {
            try? FileManager.default.removeItem(at: completedURL.appendingPathComponent("\(id).json"))
        }
    }

    private func jsonObjects<T: Encodable>(_ values: [T]) throws -> [Any] {
        let data = try encoder.encode(values)
        return (try JSONSerialization.jsonObject(with: data) as? [Any]) ?? []
    }

    private func loadSamples(_ active: ActiveJourney) -> [NativeSample] {
        let directory = chunksURL.appendingPathComponent(active.journeyId, isDirectory: true)
        let urls = ((try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? [])
            .sorted {
                (Int($0.deletingPathExtension().lastPathComponent) ?? 0) <
                    (Int($1.deletingPathExtension().lastPathComponent) ?? 0)
            }
        let persisted = urls.flatMap { url -> [NativeSample] in
            guard let data = try? Data(contentsOf: url) else { return [] }
            return (try? decoder.decode([NativeSample].self, from: data)) ?? []
        }
        return persisted + active.samples
    }
}

@objc(NativeJourneyCapturePlugin)
final class NativeJourneyCapturePlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    let identifier = "NativeJourneyCapturePlugin"
    let jsName = "NativeJourneyCapture"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startCapture", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopCapture", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listPendingJourneys", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeJourneys", returnType: CAPPluginReturnPromise)
    ]

    private let manager = CLLocationManager()
    private let store = NativeJourneyStore()
    private var active: ActiveJourney?
    private var lastLocation: CLLocation?
    private var permissionCall: CAPPluginCall?

    override func load() {
        manager.delegate = self
        manager.activityType = .automotiveNavigation
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.pausesLocationUpdatesAutomatically = false
        store.recoverInterrupted()
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        switch manager.authorizationStatus {
        case .authorizedAlways:
            call.resolve(["location": "granted"])
        case .denied, .restricted:
            call.resolve(["location": "denied"])
        default:
            permissionCall = call
            manager.requestAlwaysAuthorization()
        }
    }

    @objc func startCapture(_ call: CAPPluginCall) {
        guard manager.authorizationStatus == .authorizedAlways else {
            call.reject("Always location permission is required for locked-screen capture")
            return
        }
        guard let journeyId = call.getString("journeyId"),
              journeyId.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil,
              let startedAt = call.getInt("startedAt"),
              let outputMode = call.getString("outputMode") else {
            call.reject("Invalid capture options")
            return
        }
        let quality = call.getString("quality") == "high-detail" ? "high-detail" : "balanced"
        manager.desiredAccuracy = quality == "high-detail" ? kCLLocationAccuracyBestForNavigation : kCLLocationAccuracyBest
        manager.distanceFilter = quality == "high-detail" ? 2 : 8
        active = ActiveJourney(
            version: 1, journeyId: journeyId, startedAt: Int64(startedAt), outputMode: outputMode,
            captureProfileId: call.getString("captureProfileId"), quality: quality, samples: [],
            semanticEvents: [], gaps: [], distanceM: 0, speedSum: 0, maxSpeedKmh: 0,
            movingCount: 0, previousSpeedKmh: 0, previousAccel: 0, previousT: 0,
            chunkIndex: 0, persistedSampleCount: 0
        )
        lastLocation = nil
        if let active { self.active = try? store.saveActive(active) }
        manager.startUpdatingLocation()
        call.resolve()
    }

    @objc func stopCapture(_ call: CAPPluginCall) {
        manager.stopUpdatingLocation()
        lastLocation = nil
        guard let active else { call.resolve(); return }
        do {
            let trace = try store.finalize(active, incomplete: false)
            self.active = nil
            call.resolve(["journey": trace])
        } catch {
            call.reject("Could not finalize journey", nil, error)
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        guard let active else {
            call.resolve(status(active: false, journey: nil))
            return
        }
        call.resolve(status(active: true, journey: active))
    }

    @objc func listPendingJourneys(_ call: CAPPluginCall) {
        call.resolve(["journeys": store.pending()])
    }

    @objc func acknowledgeJourneys(_ call: CAPPluginCall) {
        store.acknowledge(call.getArray("journeyIds", String.self) ?? [])
        call.resolve()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard let call = permissionCall else { return }
        switch manager.authorizationStatus {
        case .authorizedAlways:
            permissionCall = nil
            call.resolve(["location": "granted"])
        case .authorizedWhenInUse:
            // iOS can stage the Always prompt. Ask once more from this foreground action.
            manager.requestAlwaysAuthorization()
        case .denied, .restricted:
            permissionCall = nil
            call.resolve(["location": "denied"])
        default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard var active else { return }
        for location in locations where location.horizontalAccuracy >= 0 {
            let now = Int64(location.timestamp.timeIntervalSince1970 * 1000)
            let t = max(0, Int(now - active.startedAt))
            let dt = max(0.05, Double(t - active.previousT) / 1000)
            let speedKmh: Double
            if location.speed >= 0 {
                speedKmh = location.speed * 3.6
            } else if let previous = lastLocation, location.timestamp > previous.timestamp {
                speedKmh = previous.distance(from: location) / location.timestamp.timeIntervalSince(previous.timestamp) * 3.6
            } else {
                speedKmh = active.previousSpeedKmh
            }
            let accel = ((speedKmh - active.previousSpeedKmh) / 3.6) / dt
            let jerk = max(-1, min(1, (accel - active.previousAccel) / dt / 8))
            let demand = max(0, min(1, accel / 3.5))
            let regen = max(0, min(1, -accel / 4.5))
            let quality = max(0, min(1, 1 - location.horizontalAccuracy / 80))
            if active.previousT > 0 && t - active.previousT > 15_000 {
                active.gaps.append(NativeGap(startT: active.previousT, endT: t, reason: "sensor_loss"))
                active.semanticEvents.append(NativeEvent(t: active.previousT, type: "data_gap", intensity: nil))
            }
            if let previous = lastLocation { active.distanceM += previous.distance(from: location) }
            active.samples.append(NativeSample(
                t: t, speedKmh: speedKmh, acceleration: accel, longitudinalAccel: accel,
                jerk: jerk, driverDemandEstimate: demand, regenEstimate: regen,
                movementConfidence: quality, sourceQuality: quality, primarySource: "phone"
            ))
            active.speedSum += speedKmh
            active.maxSpeedKmh = max(active.maxSpeedKmh, speedKmh)
            if speedKmh > 3 { active.movingCount += 1 }
            active.previousSpeedKmh = speedKmh
            active.previousAccel = accel
            active.previousT = t
            lastLocation = location // Coordinates remain memory-only and are never serialized.
            notifyListeners("motionSample", data: [
                "timestamp": now, "speedKmh": speedKmh,
                "accelerationLongitudinal": accel, "accuracy": location.horizontalAccuracy
            ])
        }
        self.active = (try? store.saveActive(active)) ?? active
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard var active else { return }
        let t = max(active.previousT, Int(Date().timeIntervalSince1970 * 1000) - Int(active.startedAt))
        active.semanticEvents.append(NativeEvent(t: t, type: "data_gap", intensity: nil))
        self.active = (try? store.saveActive(active)) ?? active
    }

    private func status(active isActive: Bool, journey: ActiveJourney?) -> [String: Any] {
        return [
            "active": isActive,
            "backgroundCapable": true,
            "startedAt": (journey?.startedAt as Any?) ?? NSNull(),
            "durationMs": journey.map { max(0, Int64(Date().timeIntervalSince1970 * 1000) - $0.startedAt) } ?? 0,
            "sampleCount": journey.map { $0.persistedSampleCount + $0.samples.count } ?? 0,
            "distanceM": journey?.distanceM ?? 0,
            "quality": journey?.quality ?? "balanced",
            "detail": "reduced",
            "permission": manager.authorizationStatus == .authorizedAlways ? "granted" : "prompt"
        ]
    }
}

final class NativeBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeJourneyCapturePlugin())
    }
}
