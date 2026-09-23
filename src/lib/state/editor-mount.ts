export type EditorMountState = "loading" | "ready" | "error";

type EditorMountOptions = {
  mount: () => Promise<void>;
  isReady: () => boolean;
  setState: (state: EditorMountState) => void;
  onFailure: () => void;
};

export function createEditorMountController({
  mount,
  isReady,
  setState,
  onFailure,
}: EditorMountOptions) {
  let disposed = false;
  let inFlight = false;
  let ready = false;

  async function attempt() {
    if (disposed || inFlight || ready) return;
    inFlight = true;
    setState("loading");
    try {
      await mount();
      if (disposed) return;
      if (!isReady()) throw new Error("Editor did not mount.");
      ready = true;
      setState("ready");
    } catch {
      if (!disposed) {
        onFailure();
        setState("error");
      }
    } finally {
      inFlight = false;
    }
  }

  return {
    attempt,
    dispose() {
      disposed = true;
    },
    get isDisposed() {
      return disposed;
    },
  };
}
