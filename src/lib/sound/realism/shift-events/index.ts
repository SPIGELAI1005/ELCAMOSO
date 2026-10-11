export type {
  ShiftChoreographyPhase,
  ShiftChoreographyPlan,
  ShiftChoreographyStep,
  ShiftConsumeResult,
  ShiftEngagementPreset,
  ShiftEngagementStyle,
} from "@/lib/sound/realism/shift-events/types";

export {
  ShiftEventConsumer,
  DEFAULT_SHIFT_EVENT_MAX_STALE_MS,
  DEFAULT_TIMELINE_GAP_FLUSH_MS,
} from "@/lib/sound/realism/shift-events/consumer";

export {
  shiftEngagementForProfile,
  shiftEngagementStyleForProfile,
  listShiftEngagementMatrixRows,
} from "@/lib/sound/realism/shift-events/engagement-presets";

export {
  buildShiftChoreography,
  maxMechanicalTransientLevel,
  type BuildShiftChoreographyInput,
} from "@/lib/sound/realism/shift-events/choreography";
