export const motionTiming = {
  micro: 0.15,
  ui: 0.2,
  modal: 0.2,
  page: 0.28,
} as const;

export const motionEase = [0.4, 0, 0.2, 1] as const;

export const motionTransition = {
  micro: { duration: motionTiming.micro, ease: motionEase },
  ui: { duration: motionTiming.ui, ease: motionEase },
  modal: { duration: motionTiming.modal, ease: motionEase },
  page: { duration: motionTiming.page, ease: motionEase },
} as const;
