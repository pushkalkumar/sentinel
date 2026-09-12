// Entry for /preview.html: mounts pages/MapPreview.tsx outside the router. Scratch only.
import '@/styles/app.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import MapPreview from '@/pages/MapPreview'

createRoot(document.getElementById('root')!).render(
  <StrictMode><MotionConfig reducedMotion="user"><MapPreview /></MotionConfig></StrictMode>,
)
