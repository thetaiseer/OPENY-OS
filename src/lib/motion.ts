export const motionTiming = {
  micro: 0.16,
  ui: 0.24,
  page: 0.32,
} as const;

export const motionEase = [0.4, 0, 0.2, 1] as const;

export const motionTransition = {
  micro: { duration: motionTiming.micro, ease: motionEase },
  ui: { duration: motionTiming.ui, ease: motionEase },
  page: { duration: motionTiming.page, ease: motionEase },
} as const;
