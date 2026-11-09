// Default Frame motion, matching navigation-transitions.css. Keep these pure
// recipes separate from snapshot ownership and animation cancellation.
export const FRAME_NAVIGATION_MOTION = Object.freeze({
  leave: 150,
  enter: 300,
  distance: 140,
  leaveEasing: 'cubic-bezier(.7,0,1,.5)',
  enterEasing: 'cubic-bezier(.1,.9,.2,1)',
})

export const MAIN_OVERLAY_MOTION = Object.freeze({ duration: 300, easing: 'cubic-bezier(.8,0,.2,1)' })

export function frameLeaveMotion() {
  return {
    frames: [{ opacity: 1 }, { opacity: 0 }],
    options: { duration: FRAME_NAVIGATION_MOTION.leave, easing: FRAME_NAVIGATION_MOTION.leaveEasing, fill: 'both' },
  }
}

export function retainedFrameEnterMotion() {
  const { leave, enter, distance, enterEasing } = FRAME_NAVIGATION_MOTION
  const duration = leave + enter
  const hold = leave / duration
  return {
    frames: [
      { offset: 0, opacity: 0, transform: `translateY(${distance}px)` },
      { offset: hold, opacity: 0, transform: `translateY(${distance}px)` },
      { offset: hold + .00001, opacity: 1, transform: `translateY(${distance}px)`, easing: enterEasing },
      { offset: 1, opacity: 1, transform: 'translateY(0)' },
    ],
    options: { duration, fill: 'both' },
  }
}
