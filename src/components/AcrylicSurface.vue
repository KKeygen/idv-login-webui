<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, useId } from 'vue'
import { acrylicRecipe } from '../acrylicRecipe'
import { acrylicNoise } from '../acrylicNoise'
const props = defineProps({ overlay: Boolean, fallback: Boolean, variant: { type: String, default: 'custom' }, visible: { type: Boolean, default: true }, duration: { type: Number, default: 167 }, easing: { type: String, default: 'cubic-bezier(.5,0,0,.9)' } })
const id = `acrylic-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const dpr = ref(1)
let resolution = null, active = false
function updateResolution() {
  resolution?.removeEventListener?.('change', updateResolution)
  dpr.value = Math.max(1, window.devicePixelRatio || 1)
  resolution = window.matchMedia?.(`(resolution: ${dpr.value}dppx)`)
  resolution?.addEventListener?.('change', updateResolution)
}
function start() { if (active) return; active = true; updateResolution(); window.addEventListener('resize', updateResolution) }
function stop() { active = false; resolution?.removeEventListener?.('change', updateResolution); window.removeEventListener('resize', updateResolution) }
onMounted(start); onActivated(start); onDeactivated(stop); onBeforeUnmount(stop)
const recipe = computed(() => acrylicRecipe(props.variant === 'default' ? { rgb: [44, 44, 44], alpha: 255, tintOpacity: .15 } : { tintOpacity: props.overlay ? .4 : .6 }))
const rgb = color => `rgb(${color.slice(0, 3).join(',')})`
const style = computed(() => ({ '--acrylic-filter': `url(#${id})`, '--acrylic-duration': `${props.duration}ms`, '--acrylic-easing': props.easing, '--acrylic-fallback-color': props.variant === 'default' ? '#2c2c2c' : '#2c2c2cf5', '--acrylic-noise': `url("${acrylicNoise}")`, '--acrylic-noise-size': `${256 / dpr.value}px` }))
</script>
<template>
  <span class="win-acrylic-surface" :class="{ 'is-fallback': fallback, 'is-concealed': !visible }" :style="style" aria-hidden="true">
    <svg class="win-acrylic-definition" width="0" height="0" focusable="false"><defs>
      <!-- Match the active native effect graph, not obsolete saturation/exclusion constants.
           Explicit sRGB prevents SVG's default linearRGB from changing blend results. -->
      <filter :id="id" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <!-- The web document is opaque already. A redundant pre-blur feComposite
             causes Chromium backdrop filtering to retain unblurred pixels. -->
        <feGaussianBlur in="SourceGraphic" stdDeviation="30" edgeMode="duplicate" result="blurred" />
        <feFlood :flood-color="rgb(recipe.luminosity)" :flood-opacity="recipe.luminosity[3]" result="luminosity" />
        <feBlend in="luminosity" in2="blurred" mode="luminosity" result="luminosityOutput" />
        <feFlood :flood-color="rgb(recipe.tint)" :flood-opacity="recipe.tint[3]" result="tint" />
        <feBlend in="tint" in2="luminosityOutput" mode="color" />
      </filter>
    </defs></svg>
    <span class="win-acrylic-recipe"><span class="win-acrylic-noise" /></span>
    <span class="win-acrylic-fallback" />
  </span>
</template>
<style scoped>
.win-acrylic-surface, .win-acrylic-surface span { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
.win-acrylic-surface { z-index: -1; overflow: hidden; }
.win-acrylic-definition { position: absolute; overflow: hidden; pointer-events: none; }
.win-acrylic-recipe { backdrop-filter: var(--acrylic-filter); -webkit-backdrop-filter: var(--acrylic-filter); }
.win-acrylic-noise { background-image: var(--acrylic-noise); background-size: var(--acrylic-noise-size); background-repeat: repeat; opacity: .02; }
.win-acrylic-fallback { background: var(--acrylic-fallback-color); opacity: 0; }
.win-acrylic-recipe, .win-acrylic-fallback { transition: opacity var(--acrylic-duration) var(--acrylic-easing); }
.is-fallback .win-acrylic-recipe { opacity: 0; }
.is-fallback .win-acrylic-fallback { opacity: 1; }
@supports not ((backdrop-filter: url(#acrylic)) or (-webkit-backdrop-filter: url(#acrylic))) { .win-acrylic-recipe { opacity: 0; } .win-acrylic-fallback { opacity: 1; } }
@media (prefers-reduced-transparency: reduce) { .win-acrylic-recipe { opacity: 0; } .win-acrylic-fallback { opacity: 1; } }
@media (forced-colors: active) { .win-acrylic-recipe { display: none; } .win-acrylic-fallback { background: Canvas; opacity: 1; } }
.is-concealed .win-acrylic-recipe, .is-concealed .win-acrylic-fallback { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .win-acrylic-recipe, .win-acrylic-fallback { transition: none; } }
</style>
