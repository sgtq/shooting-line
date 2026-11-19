import { createPinia } from 'pinia'
import { createApp } from 'vue'
import './style.css'
import './theme.css'
import ManagerGate from './ManagerGate.vue'

createApp(ManagerGate).use(createPinia()).mount('#app')
