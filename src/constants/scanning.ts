export enum StabilityLevel {
  unstable = "unstable",
  okay = "okay",
  stable = "stable",
}

export type ViewConfig = {
  label: string;
  instruction: string;
};

export type StabilityConfig = {
  borderColor: string;
  labelColor: string;
  label: string;
  canCapture: boolean;
};

export const STABILITY_CONFIG: Record<StabilityLevel, StabilityConfig> = {
  [StabilityLevel.unstable]: {
    borderColor: "border-red-500",
    labelColor: "text-red-400",
    label: "Hold Still...",
    canCapture: false,
  },
  [StabilityLevel.okay]: {
    borderColor: "border-yellow-400",
    labelColor: "text-yellow-300",
    label: "Almost There...",
    canCapture: false,
  },
  [StabilityLevel.stable]: {
    borderColor: "border-green-400",
    labelColor: "text-green-400",
    label: "✓ Perfect — Ready to Capture",
    canCapture: true,
  },
};

export const VIEWS: ViewConfig[] = [
  { label: "Front View", instruction: "Smile and look straight at the camera." },
  { label: "Left View", instruction: "Turn your head to the left." },
  { label: "Right View", instruction: "Turn your head to the right." },
  { label: "Upper Teeth", instruction: "Tilt your head back and open wide." },
  { label: "Lower Teeth", instruction: "Tilt your head down and open wide." },
];

export const TOTAL_STEPS = VIEWS.length;

export const MOTION_THRESHOLD_UNSTABLE = 11.5;
export const MOTION_THRESHOLD_OKAY = 10.2;
