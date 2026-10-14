"use client";

/**
 * Sample Pack Diagnostics Overlay
 * Shows which sample entries are active for debugging.
 */

import { useState, useEffect, useMemo } from "react";
import {
  getSampleEngineDiagnostics,
  buildUnifiedSampleBank,
  getAvailableTransientKinds,
} from "@/lib/sound-assets/sample-packs/engine";
import {
  getProfileApprovalStatus,
  isUnapprovedPacksAllowed,
  setUnapprovedPacksAllowed,
} from "@/lib/sound-assets/sample-packs/approval";
import {
  getCacheStats,
  clearBufferCache,
} from "@/lib/sound-assets/sample-packs/delivery";
import {
  getAllProfileIds,
  getCatalogStats,
  isCombustionProfile,
  isSystemProfile,
} from "@/lib/sound-assets/sample-packs/catalog";

interface SamplePackDiagnosticsOverlayProps {
  activeProfileId?: string;
  activeEntryIds?: string[];
  onClose?: () => void;
}

export function SamplePackDiagnosticsOverlay({
  activeProfileId,
  activeEntryIds = [],
  onClose,
}: SamplePackDiagnosticsOverlayProps) {
  const [selectedProfileId, setSelectedProfileId] = useState(activeProfileId ?? "");
  const [unapprovedAllowed, setUnapprovedAllowed] = useState(isUnapprovedPacksAllowed());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (activeProfileId) {
      setSelectedProfileId(activeProfileId);
    }
  }, [activeProfileId]);

  const catalogStats = useMemo(() => getCatalogStats(), [refreshKey]);
  const cacheStats = useMemo(() => getCacheStats(), [refreshKey]);
  
  const diagnostics = useMemo(() => {
    if (!selectedProfileId) return null;
    return getSampleEngineDiagnostics(selectedProfileId);
  }, [selectedProfileId, refreshKey]);

  const approvalStatus = useMemo(() => {
    if (!selectedProfileId) return null;
    return getProfileApprovalStatus(selectedProfileId);
  }, [selectedProfileId, refreshKey]);

  const bank = useMemo(() => {
    if (!selectedProfileId) return null;
    return buildUnifiedSampleBank(selectedProfileId);
  }, [selectedProfileId, refreshKey]);

  const profileIds = useMemo(() => getAllProfileIds(), []);

  const handleToggleUnapproved = () => {
    const newValue = !unapprovedAllowed;
    setUnapprovedPacksAllowed(newValue);
    setUnapprovedAllowed(newValue);
    setRefreshKey((k) => k + 1);
  };

  const handleClearCache = () => {
    clearBufferCache();
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 overflow-auto p-4">
      <div className="max-w-4xl mx-auto space-y-6 text-white font-mono text-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/20 pb-4">
          <h1 className="text-xl font-bold">Sample Pack Diagnostics</h1>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded"
          >
            Close
          </button>
        </div>

        {/* Catalog Stats */}
        <section className="bg-white/5 rounded p-4 space-y-2">
          <h2 className="font-bold text-lg">Catalog Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-white/60 text-xs">Total Profiles</div>
              <div className="text-2xl">{catalogStats.totalProfiles}</div>
            </div>
            <div>
              <div className="text-white/60 text-xs">App Profiles</div>
              <div className="text-2xl">{catalogStats.appProfiles}</div>
            </div>
            <div>
              <div className="text-white/60 text-xs">Total Entries</div>
              <div className="text-2xl">{catalogStats.totalEntries}</div>
            </div>
            <div>
              <div className="text-white/60 text-xs">Approved</div>
              <div className="text-2xl">{catalogStats.approvedEntries}</div>
            </div>
          </div>
        </section>

        {/* Cache Stats */}
        <section className="bg-white/5 rounded p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Buffer Cache</h2>
            <button
              onClick={handleClearCache}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 rounded text-xs"
            >
              Clear Cache
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-white/60 text-xs">Cached Buffers</div>
              <div className="text-2xl">{cacheStats.entryCount}</div>
            </div>
            <div>
              <div className="text-white/60 text-xs">Total Duration</div>
              <div className="text-2xl">{cacheStats.totalDurationSeconds.toFixed(1)}s</div>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="bg-white/5 rounded p-4 space-y-4">
          <h2 className="font-bold text-lg">Controls</h2>
          
          {/* Unapproved toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={unapprovedAllowed}
              onChange={handleToggleUnapproved}
              className="w-5 h-5 accent-green-500"
            />
            <span>Allow unapproved packs (testing mode)</span>
          </label>

          {/* Profile selector */}
          <div>
            <label className="text-white/60 text-xs block mb-1">Select Profile</label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full bg-black border border-white/20 rounded p-2 text-white"
            >
              <option value="">-- Select --</option>
              {profileIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                  {isCombustionProfile(id) ? " (combustion)" : ""}
                  {isSystemProfile(id) ? " (system)" : ""}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Active Entries */}
        {activeEntryIds.length > 0 && (
          <section className="bg-green-500/20 rounded p-4 space-y-2">
            <h2 className="font-bold text-lg text-green-400">Active Entries</h2>
            <div className="grid grid-cols-1 gap-1">
              {activeEntryIds.map((id) => (
                <div key={id} className="text-xs bg-green-500/20 px-2 py-1 rounded">
                  {id}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Profile Diagnostics */}
        {diagnostics && (
          <section className="bg-white/5 rounded p-4 space-y-4">
            <h2 className="font-bold text-lg">
              Profile: {diagnostics.profileId}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-white/60 text-xs">Bank Type</div>
                <div className={`text-lg ${
                  diagnostics.bankType === "empty" ? "text-red-400" : "text-green-400"
                }`}>
                  {diagnostics.bankType}
                </div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Loops</div>
                <div className="text-lg">{diagnostics.loopCount}</div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Transient Kinds</div>
                <div className="text-lg">{diagnostics.transientKinds.length}</div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Manifest Status</div>
                <div className={`text-lg ${
                  diagnostics.manifestStatus === "ready" ? "text-green-400" : "text-yellow-400"
                }`}>
                  {diagnostics.manifestStatus}
                </div>
              </div>
            </div>

            {/* Transient Variants */}
            {diagnostics.transientKinds.length > 0 && (
              <div>
                <div className="text-white/60 text-xs mb-2">Transient Variant Pools</div>
                <div className="flex flex-wrap gap-2">
                  {diagnostics.transientKinds.map((kind) => (
                    <div
                      key={kind}
                      className="bg-white/10 px-2 py-1 rounded text-xs"
                    >
                      {kind}: {diagnostics.transientVariantCounts[kind] ?? 0}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Approval Status */}
        {approvalStatus && (
          <section className="bg-white/5 rounded p-4 space-y-4">
            <h2 className="font-bold text-lg">Approval Status</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-white/60 text-xs">Total</div>
                <div className="text-lg">{approvalStatus.totalEntries}</div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Approved</div>
                <div className="text-lg text-green-400">
                  {approvalStatus.approvedEntries}
                </div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Unknown</div>
                <div className="text-lg text-yellow-400">
                  {approvalStatus.unknownEntries}
                </div>
              </div>
              <div>
                <div className="text-white/60 text-xs">Loadable</div>
                <div className="text-lg text-blue-400">
                  {approvalStatus.loadableEntries}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className={`px-3 py-1 rounded text-xs ${
                approvalStatus.isFullyApproved
                  ? "bg-green-500/30 text-green-400"
                  : "bg-white/10 text-white/40"
              }`}>
                {approvalStatus.isFullyApproved ? "✓" : "○"} Fully Approved
              </div>
              <div className={`px-3 py-1 rounded text-xs ${
                approvalStatus.isBlocked
                  ? "bg-red-500/30 text-red-400"
                  : "bg-white/10 text-white/40"
              }`}>
                {approvalStatus.isBlocked ? "✗" : "○"} Blocked
              </div>
              <div className={`px-3 py-1 rounded text-xs ${
                approvalStatus.isProfileManuallyApproved
                  ? "bg-blue-500/30 text-blue-400"
                  : "bg-white/10 text-white/40"
              }`}>
                {approvalStatus.isProfileManuallyApproved ? "✓" : "○"} Manually Approved
              </div>
            </div>
          </section>
        )}

        {/* Bank Details */}
        {bank && bank.type !== "empty" && (
          <section className="bg-white/5 rounded p-4 space-y-4">
            <h2 className="font-bold text-lg">Bank Details</h2>

            {bank.combustion && bank.combustion.entries.length > 0 && (
              <div>
                <div className="text-white/60 text-xs mb-2">
                  Combustion Entries ({bank.combustion.entries.length})
                </div>
                <div className="max-h-48 overflow-auto bg-black/50 rounded p-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/60">
                        <th className="text-left px-2">Asset ID</th>
                        <th className="text-left px-2">RPM</th>
                        <th className="text-left px-2">Load</th>
                        <th className="text-left px-2">Char</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bank.combustion.entries.map((entry) => (
                        <tr
                          key={entry.assetId}
                          className={
                            activeEntryIds.includes(entry.assetId)
                              ? "bg-green-500/30"
                              : ""
                          }
                        >
                          <td className="px-2 py-1 truncate max-w-[200px]">
                            {entry.assetId}
                          </td>
                          <td className="px-2 py-1">{entry.rpmRef}</td>
                          <td className="px-2 py-1">{entry.load}</td>
                          <td className="px-2 py-1">{entry.character}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bank.speedKeyed && bank.speedKeyed.entries.length > 0 && (
              <div>
                <div className="text-white/60 text-xs mb-2">
                  Speed-Keyed Entries ({bank.speedKeyed.entries.length})
                </div>
                <div className="max-h-48 overflow-auto bg-black/50 rounded p-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/60">
                        <th className="text-left px-2">Asset ID</th>
                        <th className="text-left px-2">Speed</th>
                        <th className="text-left px-2">Demand</th>
                        <th className="text-left px-2">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bank.speedKeyed.entries.map((entry) => (
                        <tr
                          key={entry.assetId}
                          className={
                            activeEntryIds.includes(entry.assetId)
                              ? "bg-green-500/30"
                              : ""
                          }
                        >
                          <td className="px-2 py-1 truncate max-w-[200px]">
                            {entry.assetId}
                          </td>
                          <td className="px-2 py-1">{entry.speedKmh} km/h</td>
                          <td className="px-2 py-1">{entry.demand.toFixed(2)}</td>
                          <td className="px-2 py-1">{entry.state}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Footer */}
        <div className="text-white/40 text-xs text-center pt-4 border-t border-white/10">
          Sample Pack System — Development Diagnostics
        </div>
      </div>
    </div>
  );
}
