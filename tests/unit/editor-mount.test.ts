import { describe, expect, it, vi } from "vitest";
import { createEditorMountController, type EditorMountState } from "#lib/state/editor-mount.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

describe("editor mount lifecycle", () => {
  it("keeps an existing editor DOM unavailable until its initialization finishes", async () => {
    const created = deferred();
    let hasDom = false;
    const setState = vi.fn<(state: EditorMountState) => void>();
    const controller = createEditorMountController({
      mount: async () => {
        hasDom = true;
        await created.promise;
      },
      isReady: () => hasDom,
      setState,
      onFailure: vi.fn<() => void>(),
    });
    const attempt = controller.attempt();
    expect(hasDom).toBe(true);
    expect(setState).toHaveBeenLastCalledWith("loading");
    created.resolve();
    await attempt;
    expect(setState).toHaveBeenLastCalledWith("ready");
  });
  it("keeps a failed editor unavailable until a successful retry", async () => {
    let mounted = false;
    const mount = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("module load failed"))
      .mockImplementationOnce(async () => {
        mounted = true;
      });
    const setState = vi.fn<(state: EditorMountState) => void>();
    const onFailure = vi.fn<() => void>();
    const controller = createEditorMountController({
      mount,
      isReady: () => mounted,
      setState,
      onFailure,
    });

    await controller.attempt();
    expect(setState).toHaveBeenLastCalledWith("error");
    expect(onFailure).toHaveBeenCalledOnce();

    await controller.attempt();
    expect(setState).toHaveBeenLastCalledWith("ready");
    expect(mount).toHaveBeenCalledTimes(2);
    await controller.attempt();
    expect(mount).toHaveBeenCalledTimes(2);
  });

  it("does not publish a late mount after disposal or start duplicate attempts", async () => {
    const pending = deferred();
    let mounted = false;
    const mount = vi.fn<() => Promise<void>>(async () => {
      await pending.promise;
      mounted = true;
    });
    const setState = vi.fn<(state: EditorMountState) => void>();
    const onFailure = vi.fn<() => void>();
    const controller = createEditorMountController({
      mount,
      isReady: () => mounted,
      setState,
      onFailure,
    });

    const first = controller.attempt();
    await controller.attempt();
    expect(mount).toHaveBeenCalledOnce();
    controller.dispose();
    pending.resolve();
    await first;
    await controller.attempt();
    expect(setState).toHaveBeenCalledExactlyOnceWith("loading");
    expect(onFailure).not.toHaveBeenCalled();
    expect(mount).toHaveBeenCalledOnce();
  });
});
