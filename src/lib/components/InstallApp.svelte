<script lang="ts">
  import Icon from './Icon.svelte'

  let {
    prompt = $bindable(null),
    installed,
  }: {
    prompt:
      | (Event & {
          prompt: () => Promise<void>
          userChoice: Promise<{ outcome: string }>
        })
      | null
    installed: boolean
  } = $props()
  let busy = $state(false)
  let helpOpen = $state(false)
  let dialog: HTMLDialogElement
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/.test(navigator.userAgent)

  $effect(() => {
    if (!dialog) return
    if (helpOpen && !installed && !dialog.open) dialog.showModal()
    else if ((!helpOpen || installed) && dialog.open) dialog.close()
  })

  async function install() {
    if (busy) return
    const available = prompt
    if (!available) {
      helpOpen = true
      return
    }
    busy = true
    // Browser prompts are single-use, including when dismissed.
    prompt = null
    try {
      await available.prompt()
      await available.userChoice
    } catch {
      helpOpen = true
    } finally {
      busy = false
    }
  }
</script>

{#if !installed}
  <section class="install-card" aria-label="Install ShotQuiver">
    <span class="install-icon"><Icon name="download" size={24} /></span>
    <div class="install-copy">
      <h2>Take ShotQuiver to the range.</h2>
      <p>Add it to your home screen for quick access and offline practice.</p>
    </div>
    <button class="primary" onclick={install} disabled={busy}>
      <Icon name="plus" size={18} />{busy ? 'Opening…' : 'Install app'}
    </button>
  </section>
{/if}

<dialog
  bind:this={dialog}
  class="rules-modal install-modal"
  aria-labelledby="install-title"
  onclose={() => (helpOpen = false)}
>
  <div class="panel-heading">
    <span class="eyebrow">READY FOR THE RANGE</span>
    <button
      class="icon-button"
      aria-label="Close install instructions"
      onclick={() => (helpOpen = false)}><Icon name="close" /></button
    >
  </div>
  <h2 id="install-title">Install ShotQuiver</h2>
  {#if ios}
    <ol>
      <li>Open ShotQuiver in <strong>Chrome or Safari</strong>.</li>
      <li>
        Tap <strong>Share</strong> (the square with an upward arrow). In Chrome,
        look beside the address bar. In Safari, it may be under the
        <strong>More</strong> menu.
      </li>
      <li>Choose <strong>Add to Home Screen</strong>.</li>
      <li>
        If shown, turn on <strong>Open as Web App</strong>, then tap
        <strong>Add</strong>.
      </li>
    </ol>
    <p>
      If Add to Home Screen is missing, update iOS and your browser, then check
      the Share menu again. In Safari, you can also check Edit Actions.
    </p>
  {:else if android}
    <ol>
      <li>Open ShotQuiver in <strong>Chrome</strong>.</li>
      <li>Open the browser’s <strong>three-dot menu</strong>.</li>
      <li>
        Choose <strong>Install app</strong> or
        <strong>Add to Home screen</strong>, then confirm.
      </li>
    </ol>
  {:else}
    <p>
      In <strong>Chrome or Edge</strong>, use the install icon in the address
      bar or the browser’s app menu.
    </p>
    <p>
      In <strong>Safari on Mac</strong>, choose
      <strong>File → Add to Dock</strong>.
    </p>
    <p>
      If your browser has no install option, open ShotQuiver in a browser that
      supports installing web apps. You can also keep using it in this tab.
    </p>
  {/if}
  <p class="muted">
    Open the app online once and look for “Ready for offline practice” before
    heading offline.
  </p>
  <button class="primary" onclick={() => (helpOpen = false)}>Got it</button>
</dialog>

<style>
  .install-card {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
    padding: 18px 20px;
    border: 1px solid #bfd8cd;
    border-radius: 10px;
    background: #e8f3ed;
  }
  .install-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #d0e8dc;
    color: #26494a;
  }
  .install-copy {
    flex: 1;
    min-width: 0;
  }
  .install-copy h2 {
    font-size: 15px;
    letter-spacing: -0.2px;
    margin: 0 0 5px;
  }
  .install-copy p {
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    color: #49685d;
  }
  .install-card button {
    min-height: 44px;
  }
  .install-modal ol {
    padding-left: 24px;
    line-height: 1.7;
  }
  .install-modal li {
    padding: 5px 0 5px 4px;
  }
  .install-modal li::marker {
    color: var(--green);
    font-weight: 650;
  }
  @media (max-width: 740px) {
    .install-card {
      display: grid;
      grid-template-columns: 36px 1fr;
      padding: 16px;
      gap: 12px;
    }
    .install-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }
    .install-card button {
      grid-column: 1 / -1;
      width: 100%;
    }
  }
  @media (prefers-color-scheme: dark) {
    .install-card {
      background: #213d39;
      border-color: #456b60;
    }
    .install-icon {
      background: #31564e;
      color: #b9e6d0;
    }
    .install-copy p {
      color: #b5cfc4;
    }
  }
</style>
