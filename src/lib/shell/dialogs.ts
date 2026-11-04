/**
 * The shell's dialogs, opened from anywhere without importing them
 * (docs/ui-kit.md → Chrome):
 *
 * - In server markup, any element with `data-dialog-open="inquiry"` (or
 *   `"site-menu"`) opens that dialog on click. Make it an anchor to a page
 *   that works without script (`<a href="/elaqe" data-dialog-open="inquiry">`)
 *   or a button.
 * - In client code, `openShellDialog("inquiry")`.
 *
 * `ShellDialogs` (mounted once by the locale layout) listens for both.
 */
export type ShellDialogId = "site-menu" | "inquiry";

export const openDialogEvent = "kc:open-dialog";
export const dialogOpenedEvent = "kc:dialog-opened";

export function openShellDialog(id: ShellDialogId): void {
  window.dispatchEvent(new CustomEvent(openDialogEvent, { detail: id }));
}

/** Calls `listener` whenever the dialog `id` has opened. */
export function onShellDialogOpened(id: ShellDialogId, listener: () => void): () => void {
  const handle = (event: Event) => {
    if ((event as CustomEvent<string>).detail === id) listener();
  };
  window.addEventListener(dialogOpenedEvent, handle);
  return () => window.removeEventListener(dialogOpenedEvent, handle);
}
