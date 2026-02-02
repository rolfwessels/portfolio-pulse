import { createRouter, RouterProvider, createRootRoute, createRoute } from '@tanstack/react-router'
import App from './App'
import Dashboard from '@pages/Dashboard'

const rootRoute = createRootRoute({
  component: App,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({ routeTree })
export { RouterProvider } 