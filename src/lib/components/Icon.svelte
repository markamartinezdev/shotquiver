<script lang="ts">
  let { name, size = 20 }: { name: string; size?: number } = $props()
  const paths: Record<string, string> = {
    bullseye:
      'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    target:
      'M22 12a10 10 0 1 1-10-10 M18 12a6 6 0 1 1-6-6 M14 12a2 2 0 1 1-2-2 M12 12 22 2 M17 2h5v5',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    history: 'M3 11a9 9 0 1 1 2.6 7 M3 4v7h7 M12 7v5l3 2',
    chart: 'M4 3v17h17 M8 15l4-5 4 2 5-7',
    plus: 'M12 5v14 M5 12h14',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    undo: 'M9 4 3 10l6 6 M3 10h11a6 6 0 0 1 0 12',
    download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
    upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5',
    check: 'M5 12l4 4L19 6',
    note: 'M14 2H4v20h16V8z M14 2v6h6 M8 13h8 M8 17h5',
    info: 'M12 8h.01 M12 11v6 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    close: 'M6 6l12 12 M18 6 6 18',
    chevron: 'M9 5l7 7-7 7',
    trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
    leaf: 'M20 3C8 2 2 8 5 15s15 6 15-12 M5 20 15 8',
    keyboard:
      'M2 5h20v14H2z M6 9h.01 M10 9h.01 M14 9h.01 M18 9h.01 M6 13h.01 M10 13h.01 M14 13h4 M7 16h10',
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name] ?? paths.target} /></svg
>
