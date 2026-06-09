import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Router, Route, Switch } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
import './index.css'
import App from './App.tsx'
import SimControl from './pages/SimControl.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/sim" component={SimControl} />
        <Route component={App} />
      </Switch>
    </Router>
  </StrictMode>,
)
