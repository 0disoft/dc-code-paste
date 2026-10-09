<script lang="ts">
    import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
    import { tick, type Snippet } from "svelte";

    type Props = {
        label: string;
        menuLabel?: string;
        variant?: "chrome" | "light";
        children: Snippet;
    };

    let {
        label,
        menuLabel = label,
        variant = "chrome",
        children,
    }: Props = $props();

    let open = $state(false);
    let wrap = $state<HTMLDivElement | null>(null);
    let trigger = $state<HTMLButtonElement | null>(null);
    const menuItemSelector = ':is([role="menuitem"], [role="menuitemcheckbox"]):not([disabled]):not([aria-disabled="true"])';

    function close() {
        if (!open) return;
        open = false;
    }

    async function toggle() {
        open = !open;
        if (open) {
            await tick();
            wrap?.querySelector<HTMLElement>(menuItemSelector)?.focus();
        }
    }

    function handleWindowPointerDown(event: PointerEvent) {
        if (!open) return;
        const target = event.target;
        if (target instanceof Node && wrap?.contains(target)) return;
        close();
    }

    function handleWindowKeydown(event: KeyboardEvent) {
        if (!open) return;
        if (event.key !== "Escape") return;
        event.stopPropagation();
        close();
        trigger?.focus();
    }

    function handleMenuKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            event.stopPropagation();
            close();
            trigger?.focus();
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const items = Array.from(wrap?.querySelectorAll<HTMLElement>(menuItemSelector) ?? []);
            if (!items.length) return;
            const active = items.findIndex((item) => item === document.activeElement);
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (active + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
            items[next]?.focus();
        } else if (event.key === "Tab") close();
    }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeydown} />

<div class="ui-menu-wrap" bind:this={wrap}>
    <button
        class="ui-btn ui-btn--icon"
        class:ui-btn--chrome={variant === "chrome"}
        class:is-quiet={variant === "chrome"}
        class:ui-btn--outline={variant === "light"}
        type="button"
        bind:this={trigger}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onclick={toggle}
    >
        <MoreHorizontal size={18} />
    </button>
    {#if open}
        <!-- Any item click runs its own handler first, then bubbles here. -->
        <div
            class="ui-menu"
            role="menu"
            tabindex="-1"
            aria-label={menuLabel}
            onclick={close}
            onkeydown={handleMenuKeydown}
        >
            {@render children()}
        </div>
    {/if}
</div>
