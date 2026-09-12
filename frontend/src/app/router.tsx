import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import { DesktopShell } from '@/components/shell/DesktopShell'
import { PhoneShell } from '@/components/shell/PhoneShell'
import { RequireRole } from '@/components/shell/RequireRole'
import { Skeleton } from '@/components/ui/Skeleton'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import NotFound from '@/pages/NotFound'
import Overview from '@/pages/admin/Overview'
import Drill from '@/pages/admin/Drill'
import Air from '@/pages/admin/Air'
import Alerts from '@/pages/admin/Alerts'
import Nodes from '@/pages/admin/Nodes'
import DrillReport from '@/pages/admin/DrillReport'
import Queue from '@/pages/responder/Queue'
import IncidentDetail from '@/pages/responder/IncidentDetail'
import Audit from '@/pages/responder/Audit'
import RolePicker from '@/pages/m/RolePicker'
import Report from '@/pages/m/Report'
import Status from '@/pages/m/Status'
import Staff from '@/pages/m/Staff'
import Responder from '@/pages/m/Responder'

// /hardware is lazy so three.js stays out of the main chunk.
const Hardware = lazy(() => import('@/pages/Hardware'))
const Demo = lazy(() => import('@/pages/Demo'))
const Xenon = lazy(() => import('@/pages/Xenon'))

function HardwareRoute() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas p-6"><Skeleton className="w-64" /></div>}>
      <Hardware />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/hardware', element: <HardwareRoute /> },
  { path: '/xenon', element: (
    <RequireRole roles={['admin', 'responder']}>
      <Suspense fallback={<div className="min-h-dvh bg-canvas p-6"><Skeleton className="w-64" /></div>}><Xenon /></Suspense>
    </RequireRole>
  ) },
  { path: '/demo', element: (
    <RequireRole roles={['admin', 'responder']}>
      <Suspense fallback={<div className="min-h-dvh bg-canvas p-6"><Skeleton className="w-64" /></div>}><Demo /></Suspense>
    </RequireRole>
  ) },
  { path: '/drills/:id/report', element: <RequireRole roles={['admin', 'responder']}><DrillReport /></RequireRole> },
  {
    element: <RequireRole roles={['admin']} />,
    children: [
      {
        element: <DesktopShell />,
        children: [
          { path: '/admin', element: <Overview /> },
          { path: '/admin/drill', element: <Drill /> },
          { path: '/admin/air', element: <Air /> },
          { path: '/admin/alerts', element: <Alerts /> },
          { path: '/admin/nodes', element: <Nodes /> },
        ],
      },
    ],
  },
  {
    element: <RequireRole roles={['responder', 'admin']} />,
    children: [
      {
        element: <DesktopShell />,
        children: [
          { path: '/responder', element: <Queue /> },
          { path: '/responder/incident/:code', element: <IncidentDetail /> },
          { path: '/responder/audit', element: <Audit /> },
        ],
      },
    ],
  },
  {
    element: <PhoneShell />,
    children: [
      { path: '/m', element: <RolePicker /> },
      { path: '/m/report', element: <Report /> },
      { path: '/m/status', element: <Status /> },
      { path: '/m/staff', element: <Staff /> },
      { path: '/m/responder', element: <Responder /> },
    ],
  },
  { path: '*', element: <NotFound /> },
])
