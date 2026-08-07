import { createApp } from 'vue'
import App from './App.vue'
import { installIdvWindowOpenRewrite } from './api'
import './style.css'

installIdvWindowOpenRewrite()

createApp(App).mount('#app')
