import { useEffect, useRef, type RefObject } from 'react';

interface DialogEntry {
  root: HTMLElement;
  modal: boolean;
}

const dialogs: DialogEntry[] = [];
let inertElements: { element: HTMLElement; previous: boolean }[] = [];

function updateBackground() {
  for (const { element, previous } of inertElements) element.inert = previous;
  inertElements = [];
  const modal = [...dialogs].reverse().find((entry) => entry.modal);
  if (!modal) return;
  let child: HTMLElement = modal.root;
  while (child.parentElement) {
    for (const sibling of child.parentElement.children) {
      if (
        !(sibling instanceof HTMLElement) ||
        sibling === child ||
        sibling.hasAttribute('data-modal-backdrop')
      )
        continue;
      inertElements.push({ element: sibling, previous: sibling.inert });
      sibling.inert = true;
    }
    child = child.parentElement;
    if (child === document.body) break;
  }
}

function focusable(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]'),
  ].filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled') &&
      !element.closest('[inert]') &&
      element.getClientRects().length > 0,
  );
}

function focusInside(root: HTMLElement) {
  const target = root.querySelector<HTMLElement>('[data-autofocus]') ?? focusable(root)[0] ?? root;
  target.focus({ preventScroll: true });
}

/** Coordinates nested dialogs, keyboard focus, inert background and focus restoration. */
export function useDialogFocus(
  ref: RefObject<HTMLElement>,
  open: boolean,
  onClose?: () => void,
  modal = true,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const entry = { root, modal };
    dialogs.push(entry);
    updateBackground();
    focusInside(root);
    const isTop = () => dialogs[dialogs.length - 1] === entry;
    const onKey = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (modal && event.key === 'Tab') {
        const targets = focusable(root);
        const first = targets[0] ?? root;
        const last = targets[targets.length - 1] ?? root;
        const active = document.activeElement;
        if (
          !root.contains(active) ||
          active === root ||
          (event.shiftKey ? active === first : active === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (modal && isTop() && !root.contains(event.target as Node)) focusInside(root);
    };
    const observer = new MutationObserver(() => {
      if (modal && isTop() && !root.contains(document.activeElement)) focusInside(root);
    });
    observer.observe(root, { childList: true, subtree: true });
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus, true);
      dialogs.splice(dialogs.indexOf(entry), 1);
      updateBackground();
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
      else if (dialogs.length) focusInside(dialogs[dialogs.length - 1].root);
    };
  }, [ref, open, modal]);
}
