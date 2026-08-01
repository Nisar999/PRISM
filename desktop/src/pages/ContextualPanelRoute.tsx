import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shellUiStore, type ShellUiState } from '@/lib/shellUi';

export interface ContextualPanelRouteProps {
  rightTab?: ShellUiState['rightTab'];
  bottomTab?: ShellUiState['bottomTab'];
  fallbackTo?: string;
}

/**
 * Maps legacy top-level pages into contextual panels.
 * No workflow/store contract changes.
 */
export function ContextualPanelRoute({
  rightTab,
  bottomTab,
  fallbackTo = '/conversation',
}: ContextualPanelRouteProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (rightTab) shellUiStore.setRightTab(rightTab);
    if (bottomTab) shellUiStore.setBottomTab(bottomTab);
    navigate(fallbackTo, { replace: true });
  }, [bottomTab, fallbackTo, navigate, rightTab]);

  return null;
}