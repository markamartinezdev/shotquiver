<script lang="ts">
  import type { Arrow, Position, RoundDefinition } from '../domain/types'
  let {
    round,
    arrows,
    selected,
    interactive,
    shaftDiameterMm,
    onplace,
    onselect,
  }: {
    round: RoundDefinition
    arrows: (Arrow | null)[]
    selected: number | null
    interactive: boolean
    shaftDiameterMm: number
    onplace: (position: Position) => void
    onselect: (index: number) => void
  } = $props()
  const shadowId = $props.id()
  let svg: SVGSVGElement
  let dragging = $state<number | null>(null)
  let draft = $state<Position | null>(null)
  let start: Position | null = null
  let moved = false
  const layout = $derived(
    round.targetFace ?? {
      id: 'single',
      centers: [{ x: 0, y: 0 }],
      radius: 1,
      boardDiameterCm: round.targetDiameterCm,
    }
  )

  function position(event: PointerEvent): Position {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.getScreenCTM()!.inverse()
    )
    return {
      x: Math.max(-1.2, Math.min(1.2, point.x / 100)),
      y: Math.max(-1.2, Math.min(1.2, point.y / 100)),
    }
  }
  function down(event: PointerEvent) {
    if (!interactive || event.button !== 0) return
    const marker = (event.target as Element).closest('[data-arrow]')
    if (marker) {
      dragging = Number(marker.getAttribute('data-arrow'))
    } else dragging = -1
    start = position(event)
    moved = false
    draft = start
    svg.setPointerCapture(event.pointerId)
  }
  function up(event: PointerEvent) {
    if (dragging === null) return
    if (
      dragging >= 0 &&
      (moved || selected === dragging || !arrows.some((a) => a === null))
    )
      onselect(dragging)
    onplace(position(event))
    dragging = null
    draft = null
  }
</script>

<div class:interactive class="target-surface">
  <!-- Score buttons provide the keyboard-accessible equivalent of spatial placement. -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    bind:this={svg}
    class="target"
    viewBox="-125 -125 250 250"
    role="img"
    aria-label={`${round.name}, ${layout.id} target, ${round.targetDiameterCm} cm. Use score buttons for keyboard scoring.`}
    onpointerdown={down}
    onpointermove={(e) => {
      if (dragging !== null) {
        draft = position(e)
        if (start && Math.hypot(draft.x - start.x, draft.y - start.y) > 0.025)
          moved = true
      }
    }}
    onpointerup={up}
    onpointercancel={() => {
      dragging = null
      draft = null
    }}
  >
    <defs
      ><filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%"
        ><feDropShadow
          dx="0"
          dy="3"
          stdDeviation="4"
          flood-opacity=".12"
        /></filter
      ></defs
    >
    {#if layout.id === 'five-spot'}<rect
        x="-100"
        y="-100"
        width="200"
        height="200"
        fill="#426a93"
      />{/if}
    {#each layout.centers as center}
      <g
        class="scoring-face"
        transform={`translate(${center.x * 100},${center.y * 100}) scale(${layout.radius})`}
      >
        <circle r="101" fill="#fafbf5" filter={`url(#${shadowId})`} />
        {#each [...round.rings].reverse() as ring}
          <circle
            r={ring.radius * 100}
            fill={ring.fill}
            stroke={ring.stroke}
            stroke-width=".65"
          />
        {/each}
        {#if round.scores.includes('X')}<path
            d="M-2-2 2 2 M2-2-2 2"
            stroke={round.rings[0].stroke}
            stroke-width=".65"
          />{/if}
        {#each round.rings as ring, i}{#if ring.score !== 'X'}<text
              x={((round.rings[i - 1]?.radius ?? 0) + ring.radius) * 50}
              y="2"
              text-anchor="middle"
              fill={ring.fill === '#fafbf5' ? '#333' : '#fafbf5'}
              font-size="5">{ring.score}</text
            >{/if}{/each}
      </g>{/each}
    {#each arrows as arrow, i}
      {#if arrow?.position && dragging !== i}
        <g
          data-arrow={i}
          class:selected={selected === i}
          class="arrow-marker"
          transform={`translate(${arrow.position.x * 100},${arrow.position.y * 100})`}
        >
          <circle r="18" fill="transparent" />
          <circle
            r={Math.max((shaftDiameterMm * 10) / layout.boardDiameterCm, 1)}
            fill="#182d27"
            stroke="#f4ff96"
            stroke-width=".7"
          />
          <circle
            r="5"
            fill={selected === i ? '#e8f795' : '#233f34'}
            stroke="#f9fff0"
            stroke-width=".7"
          />
          <text
            y="1.8"
            text-anchor="middle"
            font-size="5.5"
            font-weight="700"
            fill={selected === i ? '#233f34' : '#fff'}>{i + 1}</text
          >
        </g>
      {/if}
    {/each}
    {#if draft}
      <g
        transform={`translate(${draft.x * 100},${draft.y * 100})`}
        pointer-events="none"
      >
        <circle r="5" fill="#e8f795" stroke="#233f34" />
        <path d="M-9 0h18 M0-9v18" stroke="#233f34" stroke-width=".5" />
      </g>
    {/if}
  </svg>
</div>
