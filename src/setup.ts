// Side-effect imports and runtime guards that run before the app renders.

declare global {
  interface Window {
    __extensionErrorGuardInstalled?: boolean;
  }
}

function isBrowserExtensionError(source?: string, stack?: string, message?: string): boolean {
  const combined = `${source ?? ""} ${stack ?? ""}`;
  return (
    combined.includes("chrome-extension://") ||
    combined.includes("moz-extension://") ||
    combined.includes("safari-extension://") ||
    (typeof message === "string" && message.includes("Failed to connect to MetaMask"))
  );
}

if (typeof window !== "undefined" && !window.__extensionErrorGuardInstalled) {
  window.__extensionErrorGuardInstalled = true;

  window.addEventListener(
    "error",
    (ev) => {
      const err = ev.error as { stack?: string; message?: string } | undefined;
      if (isBrowserExtensionError(ev.filename, err?.stack, ev.message || err?.message)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (ev) => {
      const reason = ev.reason as { stack?: string; message?: string } | string | undefined;
      const stack = typeof reason === "object" && reason !== null ? reason.stack : "";
      const message =
        typeof reason === "object" && reason !== null ? reason.message : String(reason ?? "");
      if (isBrowserExtensionError("", stack, message)) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      }
    },
    true,
  );
}
