import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './alignment.css'
import './navigation-transitions.css'
import './scrollbars.css'
import { installNativeScrollbars } from './nativeScrollbars'

createApp(App).mount('#app')
const scrollbars = installNativeScrollbars(document.body)
if (import.meta.hot) import.meta.hot.dispose(() => scrollbars.dispose())
