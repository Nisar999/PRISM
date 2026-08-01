/**
 * Imperative navigation for workflows/commands outside React components.
 * Wired once from App via BrowserRouter's navigate.
 */

type NavigateFn = (to: string) => void;

let navigateImpl: NavigateFn | null = null;

export function setAppNavigate(fn: NavigateFn): void {
  navigateImpl = fn;
}

export function appNavigate(to: string): void {
  if (navigateImpl) {
    navigateImpl(to);
    return;
  }
  if (typeof window !== 'undefined') {
    window.location.assign(to);
  }
}
