import * as lucide from 'lucide';
import './design-system.js'

// Initialize lucide globally for web components
declare global {
  interface Window {
    lucide?: typeof lucide;
  }
}
window.lucide = lucide;
