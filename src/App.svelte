<script lang="ts">
  import { onMount } from 'svelte'
  import { registerSW } from 'virtual:pwa-register'
  import Icon from './lib/components/Icon.svelte'
  import Target from './lib/components/Target.svelte'
  import CustomBuilder from './lib/components/CustomBuilder.svelte'
  import {
    indoor300,
    rounds,
    futureRounds,
    sessionRound,
    endRound,
    targetFaceOptions,
    withTargetFace,
  } from './lib/domain/rounds'
  import {
    createSession,
    endStats,
    firstOpenEnd,
    sessionStats,
    withArrow,
  } from './lib/domain/scoring'
  import { deleteSession, loadSessions, saveSessions } from './lib/data/storage'
  import { makeBackup, parseBackup } from './lib/data/backup'
  import type {
    Arrow,
    Position,
    Score,
    TargetFaceId,
    Session,
    RoundDefinition,
  } from './lib/domain/types'

  type Page = 'practice' | 'scorecard' | 'history'
  type InstallPrompt = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string }>
  }
  let page = $state<Page>('practice')
  let sessions = $state.raw<Session[]>([])
  let session = $state.raw<Session | null>(null)
  let endIndex = $state(0)
  let selected = $state<number | null>(null)
  let mode = $state<'buttons' | 'target'>('buttons')
  let undoStack = $state.raw<Session[]>([])
  let loading = $state(true)
  let loadError = $state(false)
  let storageError = $state(false)
  let pending = $state(0)
  let message = $state('')
  let online = $state(navigator.onLine)
  let offlineReady = $state(false)
  let updateReady = $state(false)
  let customOpen = $state(false)
  let rulesOpen = $state(false)
  let rulesDialog: HTMLDialogElement
  let installPrompt = $state.raw<InstallPrompt | null>(null)
  let importBusy = $state(false)
  let fileInput: HTMLInputElement
  let queue = Promise.resolve()
  let messageTimer: ReturnType<typeof setTimeout>
  let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined

  const round = $derived(session ? sessionRound(session) : indoor300)
  const faceRound = $derived(session ? endRound(session, endIndex) : indoor300)
  const faceOptions = $derived(targetFaceOptions(round))
  const plotDiameter = $derived(
    faceRound.targetFace?.boardDiameterCm ?? faceRound.targetDiameterCm
  )
  const stationIndex = $derived(session?.fieldOrder?.[endIndex] ?? endIndex)
  const station = $derived(round.stations?.[stationIndex])
  const unitLabel = $derived(round.family === 'field' ? 'Target' : 'End')
  const savedCustomRounds = $derived([
    ...new Map(
      sessions
        .filter((s) => s.customConfig)
        .map((s) => {
          const r = sessionRound(s)
          return [r.id, r] as const
        })
    ).values(),
  ])
  const stats = $derived(session ? sessionStats(session) : null)
  const currentEnd = $derived(session?.ends[endIndex])
  const currentStats = $derived(currentEnd ? endStats(currentEnd, round) : null)
  const nextSlot = $derived(
    selected ?? currentEnd?.arrows.findIndex((a) => a === null) ?? -1
  )
  const selectedArrow = $derived(
    selected !== null ? currentEnd?.arrows[selected] : null
  )
  const totalArrows = $derived(round.ends * round.arrowsPerEnd)

  $effect(() => {
    if (!rulesDialog) return
    if (rulesOpen && !rulesDialog.open) rulesDialog.showModal()
    else if (!rulesOpen && rulesDialog.open) rulesDialog.close()
  })

  function notify(text: string) {
    message = text
    clearTimeout(messageTimer)
    messageTimer = setTimeout(() => {
      message = ''
    }, 4500)
  }
  function persist() {
    const snapshot = sessions
    pending++
    queue = queue
      .then(() => saveSessions(snapshot))
      .then(() => {
        storageError = false
      })
      .catch(() => {
        storageError = true
      })
      .finally(() => {
        pending--
      })
  }
  function change(next: Session, remember = true) {
    if (session && remember) undoStack = [...undoStack.slice(-99), session]
    session = { ...next, updatedAt: new Date().toISOString() }
    sessions = [session, ...sessions.filter((s) => s.id !== session!.id)]
    persist()
  }
  function openSession(s: Session) {
    session = s
    endIndex = firstOpenEnd(s)
    selected = null
    undoStack = []
    page = 'practice'
  }
  async function initialize() {
    loading = true
    loadError = false
    try {
      sessions = await loadSessions()
      if (sessions.length) openSession(sessions[0])
      else {
        const s = createSession()
        openSession(s)
        sessions = [s]
        persist()
      }
    } catch {
      loadError = true
    } finally {
      loading = false
    }
  }
  function startRound(definition: RoundDefinition) {
    const s = createSession(definition)
    openSession(s)
    sessions = [s, ...sessions]
    persist()
    notify('New practice started. Your previous session is in History.')
  }
  function newSession() {
    startRound(round)
  }
  function selectFace(id: TargetFaceId) {
    if (!session || id === (session.targetFace ?? 'single')) return
    const nextRound = withTargetFace(round, id)
    if (stats?.count) startRound(nextRound)
    else change({ ...session, targetFace: id })
    selected = null
  }
  function selectRound(select: HTMLSelectElement) {
    const value = select.value
    if (value === 'new-custom') {
      customOpen = true
      select.value = round.id
      return
    }
    const chosen =
      rounds[value] ?? savedCustomRounds.find((r) => r.id === value)
    if (chosen) startRound(chosen)
  }
  function setStation(index: number) {
    if (!session?.fieldOrder || currentStats?.count) return
    const other = session.fieldOrder.indexOf(index)
    if (other < 0 || session.ends[other].arrows.some((a) => a !== null)) return
    const next = structuredClone(session)
    ;[next.fieldOrder![endIndex], next.fieldOrder![other]] = [
      next.fieldOrder![other],
      next.fieldOrder![endIndex],
    ]
    change(next)
  }
  function score(value: Score) {
    if (!session || nextSlot < 0) return
    change(withArrow(session, endIndex, nextSlot, { score: value }))
    selected = null
  }
  function place(position: Position) {
    if (!session || nextSlot < 0) return
    const slot = nextSlot
    const editing = selected !== null
    const arrow: Arrow = {
      score: faceRound.scorePosition(position, session.shaftDiameterMm),
      position,
    }
    change(withArrow(session, endIndex, slot, arrow))
    selected = editing ? slot : null
  }
  function removeArrow() {
    if (!session || selected === null) return
    change(withArrow(session, endIndex, selected, null))
    selected = null
  }
  function undo() {
    if (!session || !undoStack.length) return
    const previous = undoStack[undoStack.length - 1]
    const changedEnd = session.ends.findIndex(
      (end, i) => JSON.stringify(end) !== JSON.stringify(previous.ends[i])
    )
    undoStack = undoStack.slice(0, -1)
    change({ ...previous, notes: session.notes }, false)
    if (changedEnd >= 0) endIndex = changedEnd
    selected = null
  }
  function saveEnd() {
    if (!session || currentStats?.count !== round.arrowsPerEnd) return
    const next = structuredClone(session)
    next.ends[endIndex].committed = true
    change(next)
    selected = null
    const open = next.ends.findIndex((e) => !e.committed)
    if (open < 0) {
      page = 'scorecard'
      notify('Round complete. Great work on the line.')
    } else {
      endIndex = open
      if (round.family === 'indoor' && open === 6)
        notify(
          'Halfway! In an official round, switch top and bottom target positions.'
        )
      else
        notify(`${unitLabel} saved. Ready for your next ${round.arrowsPerEnd}.`)
    }
  }
  function editEnd(index: number) {
    endIndex = index
    selected = null
    page = 'practice'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function notes(value: string) {
    if (session) change({ ...session, notes: value }, false)
  }
  function setShaft(input: HTMLInputElement) {
    if (!session) return
    const value = input.valueAsNumber
    if (!Number.isFinite(value) || value < 0 || value > 15) {
      input.value = String(session.shaftDiameterMm)
      notify(
        'Use a shaft diameter from 0 to 15 mm. Zero scores the center point.'
      )
      return
    }
    const next = structuredClone(session)
    next.shaftDiameterMm = value
    next.ends.forEach((e, index) =>
      e.arrows.forEach((a) => {
        if (a?.position)
          a.score = endRound(next, index).scorePosition(a.position, value)
      })
    )
    change(next)
  }
  function nudge(dx: number, dy: number) {
    if (!selectedArrow?.position) return
    place({
      x: Math.max(
        -1.2,
        Math.min(1.2, selectedArrow.position.x + dx / (plotDiameter * 5))
      ),
      y: Math.max(
        -1.2,
        Math.min(1.2, selectedArrow.position.y + dy / (plotDiameter * 5))
      ),
    })
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(makeBackup(sessions), null, 2)], {
        type: 'application/json',
      })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `ShotQuiver-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('Backup exported with all sessions and arrow positions.')
  }
  async function importData(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    importBusy = true
    try {
      if (file.size > 5_000_000)
        throw new Error('Backup is too large. Maximum size is 5 MB.')
      const imported = parseBackup(await file.text())
      await queue
      if (storageError)
        throw new Error(
          'Save your current sessions successfully before importing. Use Retry save.'
        )
      const fresh = imported.filter(
        (s) => !sessions.some((local) => local.id === s.id)
      )
      await saveSessions(fresh, true)
      sessions = await loadSessions()
      if (!session && sessions.length) openSession(sessions[0])
      notify(
        `Imported ${fresh.length} session${fresh.length === 1 ? '' : 's'}. Existing sessions were kept.`
      )
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Could not import this file.'
      )
    } finally {
      input.value = ''
      importBusy = false
    }
  }
  async function removeSession(s: Session) {
    if (
      !window.confirm(
        'Delete this practice session? Export a backup first if you want to keep it.'
      )
    )
      return
    try {
      await queue
      if (storageError)
        throw new Error('Retry saving before deleting a session.')
      await deleteSession(s.id)
      sessions = sessions.filter((item) => item.id !== s.id)
      if (session?.id === s.id) {
        if (sessions.length) {
          session = sessions[0]
          endIndex = firstOpenEnd(session)
          selected = null
          undoStack = []
        } else {
          const next = createSession()
          session = next
          sessions = [next]
          endIndex = 0
          selected = null
          undoStack = []
          persist()
        }
      }
      notify('Session deleted.')
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Could not delete this session.'
      )
    }
  }
  function date(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  function time(value: string) {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  onMount(() => {
    void initialize()
    const goOnline = () => {
      online = true
    }
    const goOffline = () => {
      online = false
    }
    const install = (event: Event) => {
      event.preventDefault()
      installPrompt = event as InstallPrompt
    }
    const installed = () => {
      installPrompt = null
    }
    const protectPendingSave = (event: BeforeUnloadEvent) => {
      if (pending || storageError) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', protectPendingSave)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener('beforeinstallprompt', install)
    window.addEventListener('appinstalled', installed)
    updateSW = registerSW({
      onOfflineReady() {
        offlineReady = true
      },
      onNeedRefresh() {
        updateReady = true
      },
      onRegisteredSW(_url, registration) {
        if (registration?.active) offlineReady = true
      },
      onRegisterError() {
        notify('Offline setup could not finish. Reconnect and reload to retry.')
      },
    })
    return () => {
      clearTimeout(messageTimer)
      window.removeEventListener('beforeunload', protectPendingSave)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('beforeinstallprompt', install)
      window.removeEventListener('appinstalled', installed)
    }
  })
</script>

<svelte:head
  ><title>ShotQuiver — Archery Scoring & Practice Tracking</title></svelte:head
>

<div class="app-shell">
  <aside class="sidebar">
    <a
      href="#practice"
      class="brand"
      onclick={() => (page = 'practice')}
      aria-label="ShotQuiver home"
      ><span class="brand-mark"><Icon name="bullseye" size={25} /></span><span
        class="brand-copy"
        ><strong>ShotQuiver</strong><span>Every arrow counts.</span></span
      ></a
    >
    <span class="nav-caption">YOUR SHOOTING JOURNAL</span>
    <nav aria-label="Main navigation">
      {#each [{ id: 'practice', icon: 'target', name: 'Practice' }, { id: 'scorecard', icon: 'grid', name: 'Scorecard' }, { id: 'history', icon: 'history', name: 'Session history' }] as item}
        <button
          class:active={page === item.id}
          aria-current={page === item.id ? 'page' : undefined}
          aria-label={item.name}
          onclick={() => (page = item.id as Page)}
          ><Icon name={item.icon} /><span>{item.name}</span
          >{#if page === item.id}<span class="nav-active-dot"
            ></span>{/if}</button
        >
      {/each}
    </nav>
    <div class="sidebar-bottom">
      <div class="local-card">
        <Icon name="leaf" size={24} /><strong
          >A little better, every end.</strong
        >
        <p>Your practice. Your progress.<br />Always with you, even offline.</p>
      </div>
      <button class="sidebar-link" onclick={() => (rulesOpen = true)}
        ><Icon name="info" size={18} /> Round & scoring guide</button
      >
      <div class="sidebar-footer">
        <span class="status-dot" class:offline={!online}></span>{online
          ? 'On the line. In your pocket.'
          : 'Offline · keep shooting'}
      </div>
    </div>
  </aside>

  <main>
    <header class="topbar">
      <div class="breadcrumbs">
        Your journal <span>/</span>
        <strong
          >{page === 'practice'
            ? 'Practice'
            : page === 'scorecard'
              ? 'Scorecard'
              : 'Session history'}</strong
        >
      </div>
      <div class="save-status" aria-live="polite">
        <span class="status-dot" class:error={storageError || loadError}
        ></span>{loadError
          ? 'Storage unavailable'
          : storageError
            ? 'Not saved'
            : pending
              ? 'Saving…'
              : 'Saved on this device'}
      </div>
    </header>

    {#if loading}
      <div class="empty-state">
        <span class="brand-mark"><Icon name="bullseye" size={30} /></span>
        <h1>Getting your arrows ready…</h1>
        <p>Opening your local practice journal.</p>
      </div>
    {:else if loadError}
      <div class="empty-state">
        <h1>Your journal couldn’t open.</h1>
        <p>
          Local storage may be blocked. Close other ShotQuiver tabs or enable
          browser storage, then retry.
        </p>
        <button class="primary" onclick={initialize}
          >Retry opening journal</button
        >
      </div>
    {:else if session && stats && currentEnd && currentStats}
      <div class="page-content">
        {#if storageError}<div class="notice error-notice" role="alert">
            <span
              >Changes are in memory but could not be saved. Export a backup
              before closing.</span
            ><button onclick={persist}>Retry save</button><button
              onclick={exportData}>Export backup</button
            >
          </div>{/if}
        {#if updateReady}<div class="notice">
            <span>A fresh version is ready.</span><button
              onclick={async () => {
                await queue
                if (!storageError) await updateSW?.(true)
                else notify('Retry saving or export a backup before updating.')
              }}>Update app</button
            >
          </div>{/if}

        <div class="page-heading">
          <div>
            <div class="eyebrow">
              <span class="tiny-line"></span>Every arrow counts.
            </div>
            <h1>
              {page === 'practice'
                ? 'A good day to shoot.'
                : page === 'scorecard'
                  ? 'Your round, arrow by arrow.'
                  : 'The work behind the progress.'}
            </h1>
            <p>
              {page === 'history'
                ? 'Pick up where you left off, or look back at your practice.'
                : `${date(session.createdAt)} · ${time(session.createdAt)}${stats.complete ? ' · Completed round' : ' · Practice session'}`}
            </p>
          </div>
          <button class="primary new-session" onclick={newSession}
            ><Icon name="plus" size={18} /> New session</button
          >
        </div>

        {#if page !== 'history'}
          <div class="round-bar">
            <div class="round-selector">
              <label for="round">ROUND</label><select
                id="round"
                value={round.id}
                onchange={(e) => selectRound(e.currentTarget)}
                >{#each [...Object.values(rounds), ...savedCustomRounds] as option}<option
                    value={option.id}>{option.name}</option
                  >{/each}<option value="new-custom"
                  >＋ Build custom round…</option
                >{#each futureRounds as name}<option disabled
                    >{name} · coming later</option
                  >{/each}</select
              >
            </div>
            <div class="round-details">
              <span>{round.distance}</span><i></i><span
                >{round.ends} × {round.arrowsPerEnd} arrows</span
              >
            </div>
            <button
              class="icon-button round-info"
              aria-label="Read official scoring rules"
              onclick={() => (rulesOpen = true)}
              ><Icon name="info" size={19} /></button
            >
          </div>

          <div class="face-selector">
            <label for="target-face">TARGET FACE</label>
            <select
              id="target-face"
              value={session.targetFace ?? 'single'}
              onchange={(e) =>
                selectFace(e.currentTarget.value as TargetFaceId)}
            >
              {#each faceOptions as option}<option value={option.id}
                  >{option.label}</option
                >{/each}
            </select>
            <p>
              {round.family === 'field'
                ? 'Face size follows the course layout. '
                : ''}{stats.count
                ? 'Changing face starts a new session; this scorecard stays in History.'
                : 'Choose your face before scoring.'}
            </p>
          </div>
          <section class="stats-grid" aria-label="Round statistics">
            <div class="stat-card total-stat">
              <span class="stat-label"
                >TOTAL SCORE <Icon name="chart" size={17} /></span
              >
              <div>
                <strong>{stats.total}</strong><span class="stat-denominator"
                  >/ {stats.max}</span
                >
              </div>
              <span class="stat-foot"
                >{stats.count} of {totalArrows} arrows scored</span
              >
            </div>
            <div class="stat-card">
              <span class="stat-label"
                >X COUNT <Icon name="target" size={17} /></span
              >
              <div>
                <strong>{stats.xs}</strong><span class="stat-unit">X</span>
              </div>
              <span class="stat-foot"
                >{stats.count
                  ? ((stats.xs / stats.count) * 100).toFixed(0)
                  : '0'}% of scored arrows</span
              >
            </div>
            <div class="stat-card">
              <span class="stat-label"
                >ARROW AVERAGE <Icon name="chart" size={17} /></span
              >
              <div>
                <strong>{stats.average.toFixed(2)}</strong><span
                  class="stat-denominator">/ {round.maxArrowScore}</span
                >
              </div>
              <span class="stat-foot">Misses included</span>
            </div>
            <div class="stat-card progress-stat">
              <span class="stat-label"
                >ROUND PROGRESS <span
                  >{Math.round((stats.completedEnds / round.ends) * 100)}%</span
                ></span
              >
              <div>
                <strong>{stats.completedEnds}</strong><span
                  class="stat-denominator"
                  >/ {round.ends}
                  <small>{unitLabel.toLowerCase()}s</small></span
                >
              </div>
              <div class="progress-track">
                <span
                  style={`width:${(stats.completedEnds / round.ends) * 100}%`}
                ></span>
              </div>
              <span class="stat-foot"
                >{stats.complete
                  ? 'Round complete. Nicely done.'
                  : `${round.ends - stats.completedEnds} ${unitLabel.toLowerCase()}s to go. Stay in your rhythm.`}</span
              >
            </div>
          </section>

          {#if page === 'practice'}
            <div class="practice-grid" class:placing={mode === 'target'}>
              <section class="panel entry-panel" aria-labelledby="end-heading">
                <div class="panel-heading">
                  <div>
                    <span class="eyebrow">ON THE LINE</span>
                    <h2 id="end-heading">
                      {unitLabel}
                      {endIndex + 1} <span>of {round.ends}</span>
                    </h2>
                  </div>
                  <span class="pill" class:complete-pill={currentEnd.committed}
                    ><span class="status-dot"></span>{currentEnd.committed
                      ? 'Saved end'
                      : currentStats.count === round.arrowsPerEnd
                        ? 'Ready to save'
                        : 'In progress'}</span
                  >
                </div>
                <div class="station-details">
                  {#if station && session.fieldOrder}
                    <label
                      >Course layout for target {endIndex + 1}
                      <select
                        aria-label="Field target layout"
                        value={stationIndex}
                        disabled={currentStats.count > 0}
                        onchange={(e) =>
                          setStation(Number(e.currentTarget.value))}
                      >
                        {#each round.stations ?? [] as st, index}
                          {#if Math.floor(index / 14) === Math.floor(endIndex / 14)}<option
                              value={index}
                              disabled={index !== stationIndex &&
                                session.ends[
                                  session.fieldOrder.indexOf(index)
                                ].arrows.some((a) => a !== null)}
                              >{st.distance} · {st.targetDiameterCm} cm{st.instruction.startsWith(
                                'Fan'
                              )
                                ? ' · Fan'
                                : ''}</option
                            >{/if}
                        {/each}
                      </select>
                    </label>
                    <p>
                      {station.instruction} Adult distances. Choose layouts to match
                      your course before scoring; used layouts are locked.
                    </p>
                  {:else}<p>
                      {round.distance} · {round.targetDiameterCm} cm face
                    </p>{/if}
                </div>
                <div class="mode-toggle" aria-label="Scoring mode">
                  <button
                    class:chosen={mode === 'buttons'}
                    aria-pressed={mode === 'buttons'}
                    onclick={() => (mode = 'buttons')}
                    ><Icon name="keyboard" size={18} />Score buttons</button
                  ><button
                    class:chosen={mode === 'target'}
                    aria-pressed={mode === 'target'}
                    onclick={() => (mode = 'target')}
                    ><Icon name="target" size={18} />Target placement</button
                  >
                </div>
                <div
                  class="arrow-row"
                  style={`grid-template-columns:repeat(${Math.min(round.arrowsPerEnd, 6)},1fr)`}
                >
                  {#each currentEnd.arrows as arrow, i}<button
                      class="arrow-slot"
                      class:filled={arrow !== null}
                      class:x-score={arrow?.score === 'X'}
                      class:selected={selected === i}
                      class:next={nextSlot === i && selected === null}
                      aria-label={`Arrow ${i + 1}: ${arrow ? (arrow.score === 'M' ? 'Miss' : arrow.score) : 'not scored'}. Select to edit.`}
                      aria-pressed={selected === i}
                      onclick={() => (selected = selected === i ? null : i)}
                      ><span>ARROW {i + 1}</span><strong
                        >{arrow?.score ?? '–'}</strong
                      ></button
                    >{/each}
                </div>
                <div class="entry-instruction">
                  <span
                    >{selected !== null
                      ? `Editing arrow ${selected + 1}`
                      : nextSlot < 0
                        ? 'All arrows in. Ready to save.'
                        : `Score arrow ${nextSlot + 1}`}</span
                  >{#if selected !== null}<button
                      onclick={() => (selected = null)}>Cancel edit</button
                    >{:else}<span class="muted"
                      >{currentStats.count} / {round.arrowsPerEnd}</span
                    >{/if}
                </div>
                {#if mode === 'buttons'}
                  <div class="score-pad">
                    {#each round.scores as value}<button
                        class="score-button"
                        class:score-x={value === 'X'}
                        class:score-five={value === '5'}
                        class:score-miss={value === 'M'}
                        disabled={nextSlot < 0}
                        onclick={() => score(value)}
                        aria-label={`Score ${value === 'M' ? 'Miss' : value}`}
                        ><strong>{value === 'M' ? 'Miss' : value}</strong><span
                          >{value === 'X'
                            ? `${round.points('X')} POINTS`
                            : value === 'M'
                              ? '0 POINTS'
                              : `${value} POINT${value === '1' ? '' : 'S'}`}</span
                        ></button
                      >{/each}
                  </div>
                {:else}
                  <div class="placement-guide">
                    <span class="placement-icon"
                      ><Icon name="target" size={28} /></span
                    >
                    <h3>
                      {selected !== null
                        ? 'Put it right where it landed.'
                        : 'Find your mark.'}
                    </h3>
                    <p>Tap to place · drag a marker to adjust</p>
                    <div class="mobile-target">
                      <Target
                        round={faceRound}
                        arrows={currentEnd.arrows}
                        {selected}
                        interactive
                        shaftDiameterMm={session.shaftDiameterMm}
                        onplace={place}
                        onselect={(i) => (selected = i)}
                      /><label class="mobile-shaft"
                        >Shaft diameter <input
                          type="number"
                          min="0"
                          max="15"
                          step="0.1"
                          value={session.shaftDiameterMm}
                          onchange={(e) => setShaft(e.currentTarget)}
                          aria-label="Arrow shaft diameter in millimeters"
                        /> mm</label
                      >
                    </div>
                    <div
                      class="compact-scores"
                      aria-label="Direct score override"
                    >
                      {#each round.scores as value}<button
                          disabled={nextSlot < 0}
                          aria-label={`Score ${value === 'M' ? 'Miss' : value}`}
                          onclick={() => score(value)}
                          >{value === 'M' ? 'Miss' : value}</button
                        >{/each}
                    </div>
                  </div>
                {/if}
                {#if selected !== null}<div class="edit-tools">
                    <span
                      >{selectedArrow?.position
                        ? 'Fine-tune · 1 mm steps'
                        : 'Choose a score or place on target'}</span
                    >{#if selectedArrow?.position}<div class="nudge-buttons">
                        <button
                          aria-label="Move arrow left 1 mm"
                          onclick={() => nudge(-1, 0)}>←</button
                        ><button
                          aria-label="Move arrow up 1 mm"
                          onclick={() => nudge(0, -1)}>↑</button
                        ><button
                          aria-label="Move arrow down 1 mm"
                          onclick={() => nudge(0, 1)}>↓</button
                        ><button
                          aria-label="Move arrow right 1 mm"
                          onclick={() => nudge(1, 0)}>→</button
                        >
                      </div>{/if}<button
                      class="text-danger"
                      onclick={removeArrow}>Clear arrow</button
                    >
                  </div>{/if}
                <div class="end-summary">
                  <span>This {unitLabel.toLowerCase()}</span><strong
                    >{currentStats.total}<small>
                      / {round.arrowsPerEnd * round.maxArrowScore}</small
                    ></strong
                  ><span class="end-xs">{currentStats.xs} X</span>
                </div>
                <div class="entry-actions">
                  <button
                    class="secondary"
                    disabled={!undoStack.length}
                    onclick={undo}><Icon name="undo" size={17} />Undo</button
                  ><button
                    class="primary save-end"
                    disabled={currentStats.count !== round.arrowsPerEnd}
                    onclick={saveEnd}
                    >{currentEnd.committed
                      ? 'Save changes'
                      : endIndex === round.ends - 1
                        ? 'Finish round'
                        : `Save ${unitLabel.toLowerCase()}`}<Icon
                      name={endIndex === round.ends - 1 ? 'check' : 'arrow'}
                      size={18}
                    /></button
                  >
                </div>
                <p class="entry-hint">
                  Tap any arrow above to edit. Every arrow is saved
                  automatically.
                </p>
              </section>

              <section
                class="panel target-panel"
                aria-labelledby="target-heading"
              >
                <div class="panel-heading">
                  <div>
                    <span class="eyebrow">THE FACE</span>
                    <h2 id="target-heading">A clearer picture.</h2>
                  </div>
                  <span class="target-badge"
                    >{faceRound.targetDiameterCm} cm{session.targetFace ===
                    'four-face'
                      ? ' each'
                      : ''}</span
                  >
                </div>
                <Target
                  round={faceRound}
                  arrows={currentEnd.arrows}
                  {selected}
                  interactive={mode === 'target'}
                  shaftDiameterMm={session.shaftDiameterMm}
                  onplace={place}
                  onselect={(i) => (selected = i)}
                />
                <div class="target-caption">
                  <span class="status-dot blue"></span>
                  {round.targetFace?.label ?? 'Single spot'}
                  <span class="muted">·</span>
                  {faceRound.distance}
                </div>
                <p class="target-help">
                  {mode === 'target'
                    ? 'Tap any spot · drag to refine · outside scoring circles = miss'
                    : 'Switch to target placement to map your arrows.'}
                </p>
                <div class="target-legend">
                  <span
                    >{round.scores.filter((s) => s !== 'M').join(' · ')}</span
                  ><label
                    >Shaft <input
                      type="number"
                      min="0"
                      max="15"
                      step="0.1"
                      value={session.shaftDiameterMm}
                      onchange={(e) => setShaft(e.currentTarget)}
                      aria-label="Arrow shaft diameter in millimeters"
                    /> mm</label
                  >
                </div>
                <p class="line-rule">
                  A shaft touching a ring earns the higher value.
                </p>
              </section>
            </div>
          {/if}

          <section
            class="panel scorecard-panel"
            aria-labelledby="scorecard-heading"
          >
            <div class="panel-heading">
              <div>
                <span class="eyebrow">THE WHOLE PICTURE</span>
                <h2 id="scorecard-heading">Scorecard</h2>
              </div>
              <span class="muted scorecard-tip"
                >Select a {unitLabel.toLowerCase()} to edit <Icon
                  name="chevron"
                  size={15}
                /></span
              >
            </div>
            <div class="table-scroll">
              <table
                style={`min-width:${Math.max(480, round.arrowsPerEnd * 42 + 160)}px`}
              >
                <caption class="sr-only"
                  >{round.name} scorecard with {round.ends}
                  {unitLabel.toLowerCase()}s, arrow scores, totals, X counts and
                  running totals</caption
                ><thead
                  ><tr
                    ><th scope="col">{unitLabel.toUpperCase()}</th
                    >{#each Array.from({ length: round.arrowsPerEnd }, (_, i) => i + 1) as a}<th
                        scope="col">{a}</th
                      >{/each}<th scope="col">TOTAL</th><th scope="col">X</th
                    ><th scope="col">RUNNING</th></tr
                  ></thead
                ><tbody
                  >{#each session.ends as end, i}{@const es = endStats(
                      end,
                      round
                    )}<tr
                      class:current-row={page === 'practice' && endIndex === i}
                      class:game-start={i > 0 &&
                        i % (round.family === 'field' ? 14 : 4) === 0}
                      ><th scope="row"
                        ><button
                          aria-label={`Edit ${unitLabel.toLowerCase()} ${i + 1}`}
                          onclick={() => editEnd(i)}
                          >{String(i + 1).padStart(
                            2,
                            '0'
                          )}{#if end.committed}<span class="table-check"
                              ><Icon name="check" size={12} /></span
                            >{/if}</button
                        >{#if round.stations}<small class="station-row"
                            >{endRound(session, i).distance}<br />{endRound(
                              session,
                              i
                            ).targetDiameterCm} cm</small
                          >{/if}</th
                      >{#each end.arrows as a}<td
                          ><span
                            class:x-chip={a?.score === 'X'}
                            class:empty-cell={!a}>{a?.score ?? '–'}</span
                          ></td
                        >{/each}<td class="cell-total"
                        >{es.count ? es.total : '–'}</td
                      ><td>{es.count ? es.xs : '–'}</td><td
                        class="running-total"
                        >{es.count
                          ? session.ends
                              .slice(0, i + 1)
                              .reduce(
                                (sum, e) => sum + endStats(e, round).total,
                                0
                              )
                          : '–'}</td
                      ></tr
                    >{/each}</tbody
                ><tfoot
                  ><tr
                    ><th scope="row" colspan={round.arrowsPerEnd + 1}
                      >{stats.complete ? 'FINAL SCORE' : 'ROUND TOTAL'}</th
                    ><td>{stats.total}</td><td>{stats.xs}</td><td
                      >{stats.total}<small> / {stats.max}</small></td
                    ></tr
                  ></tfoot
                >
              </table>
            </div>
            <div class="scorecard-footer">
              <span
                ><Icon name="info" size={15} />
                {round.ends}
                {unitLabel.toLowerCase()}s · {round.arrowsPerEnd} arrows each{round.scores.includes(
                  'X'
                )
                  ? ` · X = ${round.points('X')} points`
                  : ''}</span
              ><button onclick={exportData}
                ><Icon name="download" size={16} /> Export JSON</button
              >
            </div>
          </section>

          <section class="panel notes-panel">
            <div class="notes-heading">
              <Icon name="note" size={22} />
              <div>
                <h2>Notes from the line</h2>
                <p>What felt good? What will you work on next?</p>
              </div>
              <span class="muted">{session.notes.length} / 10,000</span>
            </div>
            <label for="notes" class="sr-only">Session notes</label><textarea
              id="notes"
              maxlength="10000"
              rows="3"
              placeholder="Equipment, conditions, that one perfect release…"
              value={session.notes}
              oninput={(e) => notes(e.currentTarget.value)}></textarea>
          </section>
        {:else}
          <div class="history-toolbar">
            <span
              >{sessions.length} practice session{sessions.length === 1
                ? ''
                : 's'} · stored on this device</span
            >
            <div>
              <button class="secondary" onclick={exportData}
                ><Icon name="download" size={17} />Export all</button
              ><button
                class="secondary"
                disabled={importBusy}
                onclick={() => fileInput.click()}
                ><Icon name="upload" size={17} />{importBusy
                  ? 'Importing…'
                  : 'Import JSON'}</button
              >
            </div>
          </div>
          <div class="history-list">
            {#each sessions as past}{@const ps = sessionStats(past)}
              <article class="panel history-card">
                <div class="history-icon"><Icon name="target" size={27} /></div>
                <div class="history-description">
                  <span class="eyebrow"
                    >{date(past.createdAt)} · {time(past.createdAt)}</span
                  >
                  <h2>{sessionRound(past).name}</h2>
                  <p>{sessionRound(past).targetFace?.label}</p>
                  <p>
                    {ps.complete
                      ? 'Complete'
                      : `${ps.completedEnds} of ${past.ends.length} ${sessionRound(past).family === 'field' ? 'targets' : 'ends'} saved`}
                    ·
                    {ps.count} arrows · {ps.average.toFixed(2)} average
                  </p>
                  {#if past.notes}<p class="history-note">{past.notes}</p>{/if}
                </div>
                <div class="history-score">
                  <strong>{ps.total}<small> / {ps.max}</small></strong><span
                    >{ps.xs} X</span
                  >
                </div>
                <div class="history-actions">
                  <button class="secondary" onclick={() => openSession(past)}
                    >{ps.complete ? 'Review' : 'Resume'}<Icon
                      name="chevron"
                      size={16}
                    /></button
                  ><button
                    class="icon-button"
                    aria-label={`Delete session from ${date(past.createdAt)} at ${time(past.createdAt)}`}
                    onclick={() => removeSession(past)}
                    ><Icon name="trash" size={17} /></button
                  >
                </div>
              </article>{/each}
          </div>
          <div class="backup-note">
            <Icon name="info" size={20} />
            <p>
              Your journal lives in this browser. Export a JSON backup to move
              it to another device or keep a safe copy. Imports add new sessions
              and keep existing ones.
            </p>
          </div>
        {/if}

        <footer class="page-footer">
          <span
            ><span class="status-dot"></span>{offlineReady
              ? 'Ready for offline practice'
              : online
                ? 'Local first. Made for the range.'
                : 'Offline · scores save locally'}</span
          >
          <div>
            {#if installPrompt}<button
                onclick={async () => {
                  await installPrompt?.prompt()
                  installPrompt = null
                }}>Install app</button
              >{:else}<span class="install-tip"
                >Install from your browser’s menu</span
              >{/if}<button onclick={() => (rulesOpen = true)}
              >Scoring guide <Icon name="info" size={14} /></button
            >
          </div>
        </footer>
      </div>
    {/if}
  </main>
</div>
<input
  class="sr-only"
  type="file"
  accept="application/json,.json"
  bind:this={fileInput}
  onchange={importData}
  aria-label="Import JSON backup"
  tabindex="-1"
/>
<div class="toast-region" aria-live="polite" aria-atomic="true">
  {#if message}<div class="toast">
      <Icon name="info" size={18} /><span>{message}</span><button
        aria-label="Dismiss notification"
        onclick={() => (message = '')}><Icon name="close" size={17} /></button
      >
    </div>{/if}
</div>

<dialog
  bind:this={rulesDialog}
  class="rules-modal"
  aria-labelledby="rules-title"
  onclose={() => (rulesOpen = false)}
>
  <div class="panel-heading">
    <span class="eyebrow">KNOW YOUR ROUND</span><button
      class="icon-button"
      aria-label="Close scoring guide"
      onclick={() => (rulesOpen = false)}><Icon name="close" /></button
    >
  </div>
  <h2 id="rules-title">{round.name}</h2>
  {#if round.family === 'field'}
    <p>
      A full NFAA Field round has 28 targets, four arrows each. A 14-target unit
      is offered here for practice. This app uses adult marked distances,
      including the fan and three walk-ups.
    </p>
    <p>
      The black center scores 5, the white middle scores 4, and the outer black
      scores 3. X counts as {round.points('X')} points in this mode and is tracked
      separately. Professional mode adds one point for each X. Touching a line earns
      the higher value.
    </p>
    <p>
      Faces are 20, 35, 50, and 65 cm. Ring diameters are 10%, 20%, 40%, 60%,
      80%, and 100% of the face diameter. Change each unscored target’s layout
      to match the course; the app swaps unused layouts within its 14-target
      unit.
    </p>
    <a
      class="rules-source"
      href="https://nfaausa.com/about/constitution/official-nfaa-rounds"
      target="_blank"
      rel="noreferrer">Official NFAA rules · Article VI.A</a
    >
    <p>
      Youth/Cub distances and alternate Expert scoring are not included.
      Verified November 12, 2026.
    </p>
  {:else if round.family === 'custom'}
    <p>
      {round.ends} ends of {round.arrowsPerEnd} arrows at {round.distance}, on a {round.targetDiameterCm}
      cm face. Maximum {round.ends * round.arrowsPerEnd * round.maxArrowScore} points.
    </p>
    <p>
      Scoring pattern: {round.customConfig?.face}. Numeric scores count their
      face value. Misses are zero.{round.scores.includes('X')
        ? ' X counts as ' +
          round.points('X') +
          ' points and is tracked separately.'
        : ' X tracking is off.'} Shaft contact earns the higher value.
    </p>
    <p>
      Equal-width custom rings divide the radius evenly; an optional X ring
      occupies half the innermost ring’s radius. Custom settings are stored with
      each session and included in backups. Use the dropdown to repeat a saved
      setup or build another.
    </p>
  {:else}
    <p>
      60 arrows at 20 yards. Three games of four ends, with five arrows in every
      end. Maximum score: <strong>300 with 60 X.</strong>
    </p>
    {#if session?.targetFace === 'five-spot'}
      <p>
        Five 16 cm spots on a 40 cm face. Each has a 4 cm X ring, an 8 cm white
        5-ring, and 12/16 cm blue rings both worth 4. Scores are X, 5, 4, or
        Miss. An arrow outside every scoring circle is a miss, even on the blue
        paper between spots.
      </p>
      <p>
        Shoot the spots in any order; multiple arrows on the same spot are
        allowed. X is 5 points and counted separately. Shaft contact earns the
        higher value.
      </p>
    {:else}<div class="rules-rings">
        <span>X <small>4 cm</small></span><span>5 <small>8 cm</small></span
        ><span>4 <small>16 cm</small></span><span>3 <small>24 cm</small></span
        ><span>2 <small>32 cm</small></span><span
          >1 <small>{faceRound.targetDiameterCm} cm</small></span
        >
      </div>
      <p>
        These are ring diameters. The center is white; all four outer zones are
        dull blue, divided by white lines. X counts as 5 points and is tracked
        separately. Misses count as zero.
      </p>{/if}
    <p>
      A shaft touching a scoring line earns the higher value. Target placement
      uses your shaft diameter to calculate line calls. Button scores record
      your own call. Numbered markers are enlarged touch handles; your shaft
      setting determines scoring.
    </p>
    <p>
      Official ends have a four-minute limit. Switch top and bottom target
      positions halfway through. This practice journal doesn’t enforce timing or
      tournament procedures.
    </p>
    <a
      class="rules-source"
      href="https://nfaausa.com/about/constitution/official-nfaa-rounds"
      target="_blank"
      rel="noreferrer"
      >Official NFAA rules · Article VI.E <Icon name="arrow" size={16} /></a
    >
    <p class="muted">
      Single-spot and five-spot rules verified against NFAA Article VI.E. Vegas
      substitute faces change the arrow count and scoring format and are not
      part of this Indoor 300 implementation.
    </p>
    <p class="muted">
      The 2026 Indoor Sectionals also count inside-out Xs for tie-breaking: the
      entire shaft must be inside the X ring without touching it. This practice
      round records the standard X count, without a separate inside-out X count.
      <a
        href="https://nfaausa.com/events/national-tournaments/nfaa-indoor-sectional-championships-and-indoor-national-series-2026"
        target="_blank"
        rel="noreferrer">2026 Sectional rules</a
      >
    </p>
  {/if}<button class="primary" onclick={() => (rulesOpen = false)}
    >Back to the line <Icon name="arrow" size={17} /></button
  >
</dialog>

{#if customOpen}<CustomBuilder
    oncreate={startRound}
    onclose={() => (customOpen = false)}
  />{/if}
