<script lang="ts">
  import { customRound, withTargetFace } from '../domain/rounds'
  import type {
    CustomConfig,
    RoundDefinition,
    TargetFaceId,
  } from '../domain/types'
  let {
    oncreate,
    onclose,
  }: { oncreate: (round: RoundDefinition) => void; onclose: () => void } =
    $props()
  let dialog: HTMLDialogElement
  let name = $state('My practice round')
  let ends = $state(10)
  let arrows = $state(3)
  let distance = $state(20)
  let unit = $state<CustomConfig['unit']>('yards')
  let diameter = $state(40)
  let face = $state<CustomConfig['face']>('indoor')
  let maximum = $state(10)
  let useX = $state(true)
  let error = $state('')
  let layout = $state<TargetFaceId>('single')
  $effect(() => {
    if (
      (layout === 'five-spot' && face !== 'indoor') ||
      (layout === 'four-face' && face !== 'field')
    )
      layout = 'single'
  })
  $effect(() => {
    dialog?.showModal()
  })
  function submit(event: SubmitEvent) {
    event.preventDefault()
    try {
      oncreate(
        withTargetFace(
          customRound({
            id: crypto.randomUUID(),
            name,
            ends,
            arrowsPerEnd: arrows,
            distance,
            unit,
            targetDiameterCm: diameter,
            face,
            maxScore: face === 'rings' ? maximum : 5,
            useX: face === 'rings' ? useX : true,
          }),
          layout
        )
      )
      onclose()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Check your settings.'
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="rules-modal builder-modal"
  {onclose}
  aria-labelledby="custom-title"
>
  <form onsubmit={submit}>
    <div class="panel-heading">
      <span class="eyebrow">MAKE IT YOURS</span><button
        type="button"
        class="icon-button"
        aria-label="Close custom round builder"
        onclick={onclose}>✕</button
      >
    </div>
    <h2 id="custom-title">Build a custom round</h2>
    <p>
      Your settings are saved with the session and can be reused from the round
      dropdown.
    </p>
    <div class="builder-fields">
      <label class="wide"
        >Target face layout<select bind:value={layout}
          ><option value="single">Single spot</option
          >{#if face === 'indoor'}<option value="five-spot"
              >Five spot (scaled Indoor pattern)</option
            >{:else if face === 'field'}<option value="four-face"
              >Four full Field faces</option
            >{/if}</select
        ></label
      >
      <label class="wide"
        >Round name<input required maxlength="60" bind:value={name} /></label
      >
      <label
        >Ends<input
          type="number"
          required
          min="1"
          max="100"
          step="1"
          bind:value={ends}
        /></label
      >
      <label
        >Arrows per end<input
          type="number"
          required
          min="1"
          max="12"
          step="1"
          bind:value={arrows}
        /></label
      >
      <label
        >Distance<input
          type="number"
          required
          min="0.1"
          max="1000"
          step="any"
          bind:value={distance}
        /></label
      >
      <label
        >Distance unit<select bind:value={unit}
          ><option>yards</option><option>meters</option><option>feet</option
          ></select
        ></label
      >
      <label class="wide"
        >Scoring pattern<select bind:value={face}
          ><option value="indoor">Indoor pattern · X, 5, 4, 3, 2, 1</option
          ><option value="field">Field pattern · X, 5, 4, 3</option><option
            value="rings">Custom equal-width rings</option
          ></select
        ></label
      >
      <label
        >Face diameter (cm)<input
          type="number"
          required
          min="10"
          max="200"
          step="any"
          bind:value={diameter}
        /></label
      >
      {#if face === 'rings'}<label
          >Highest score<input
            type="number"
            required
            min="1"
            max="10"
            step="1"
            bind:value={maximum}
          /></label
        ><label class="checkbox-label wide"
          ><input type="checkbox" bind:checked={useX} /> Track X (same points as highest
          score)</label
        >{/if}
    </div>
    <p>
      {ends * arrows} arrows · maximum {ends *
        arrows *
        (face === 'rings' ? maximum : 5)} points. Custom rings use equal radial widths,
      with an optional half-size inner X ring. These are personal practice settings.
    </p>
    {#if error}<p role="alert">{error}</p>{/if}
    <button type="submit" class="primary">Start custom round</button>
  </form>
</dialog>
