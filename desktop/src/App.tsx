import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { NotificationToasts } from './components/NotificationToasts';
import { SplashScreen, shouldShowSplash } from './components/brand/SplashScreen';
import { Dashboard } from './pages/Dashboard';
import { ConversationPage } from './pages/ConversationPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { EditorPage } from './pages/EditorPage';
import { SettingsPage } from './pages/Settings';
import { PrismViewPage } from './pages/views/PrismViewPage';
import { GlobeViewPage } from './pages/views/GlobeViewPage';
import { ArchivedRoute } from './pages/Placeholder';
import { ContextualPanelRoute } from './pages/ContextualPanelRoute';
import { PRODUCT } from './lib/brand';
import { setAppNavigate } from './lib/appNavigation';

/** Bridges react-router navigate into workflows/commands. */
function AppNavigateBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setAppNavigate((to) => navigate(to));
  }, [navigate]);
  return null;
}

function App() {
  const [splash, setSplash] = useState(() => shouldShowSplash());
  const dismissSplash = useCallback(() => setSplash(false), []);

  useEffect(() => {
    document.title = PRODUCT.nameLong;
  }, []);

  // Gate: never mount IDE/conversation shell under splash (prevents Agent flicker).
  if (splash) {
    return (
      <>
        <SplashScreen onDone={dismissSplash} />
        <NotificationToasts />
      </>
    );
  }

  return (
    <BrowserRouter>
      <AppNavigateBridge />
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<ConversationPage />} />
          <Route path="welcome" element={<Dashboard />} />
          <Route path="conversation" element={<ConversationPage />} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="editor" element={<EditorPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="views/prism" element={<PrismViewPage />} />
          <Route path="views/globe" element={<GlobeViewPage />} />

          <Route
            path="memory"
            element={<ContextualPanelRoute rightTab="memory" fallbackTo="/conversation" />}
          />
          <Route
            path="thoughts"
            element={<ContextualPanelRoute rightTab="thoughts" fallbackTo="/conversation" />}
          />
          <Route
            path="chat"
            element={<ContextualPanelRoute rightTab="chat" fallbackTo="/conversation" />}
          />
          <Route
            path="context"
            element={<ContextualPanelRoute rightTab="context" fallbackTo="/conversation" />}
          />
          <Route
            path="planning"
            element={<ContextualPanelRoute bottomTab="output" fallbackTo="/conversation" />}
          />
          <Route
            path="execution"
            element={<ContextualPanelRoute bottomTab="graph" fallbackTo="/conversation" />}
          />
          <Route
            path="review"
            element={<ContextualPanelRoute bottomTab="review" fallbackTo="/conversation" />}
          />

          <Route path="about" element={<ArchivedRoute title="About" redirectTo="/" />} />
          <Route path="runtime" element={<ArchivedRoute title="Runtime" redirectTo="/" />} />
          <Route path="registries" element={<ArchivedRoute title="Registries" redirectTo="/" />} />
          <Route path="models" element={<ArchivedRoute title="Models" redirectTo="/settings?tab=models" />} />
        </Route>
      </Routes>
      <NotificationToasts />
    </BrowserRouter>
  );
}

export default App;
