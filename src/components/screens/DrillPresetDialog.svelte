<script lang="ts">
  import { PracticeMode, PracticeRole, AVAILABLE_BASE_SYSTEMS, displayConventionName, listConventions } from "../../service";
  import type { ConventionInfo, SystemSelectionId } from "../../service";
  import {
    getAppStore,
    getCustomSystemsStore,
    getDrillsStore,
  } from "../../stores/context";
  import { DRILL_NAME_MAX } from "../../stores/drills.svelte";
  import type { Drill } from "../../stores/drills.svelte";

  const appStore = getAppStore();
  const customSystems = getCustomSystemsStore();
  const drillsStore = getDrillsStore();
  const allConventions = listConventions();

  interface Props {
    onLaunch: (drill: Drill) => void;
  }
  const { onLaunch }: Props = $props();

  type OpenArgs =
    | { mode: "create"; convention: ConventionInfo }
    | { mode: "edit"; presetId: string };

  let dialogRef = $state<HTMLDialogElement>();
  let mode = $state<"create" | "edit">("create");
  let convention = $state<ConventionInfo | null>(null);
  let presetId = $state<string | null>(null);

  let name = $state("");
  let practiceMode = $state<PracticeMode>(PracticeMode.DecisionDrill);
  let practiceRole = $state<PracticeRole>(PracticeRole.Responder);
  let systemSelectionId = $state<SystemSelectionId>("sayc");
  let errorMsg = $state<string | null>(null);

  const systemOptions = $derived([
    ...AVAILABLE_BASE_SYSTEMS.map((s) => ({ id: s.id as SystemSelectionId, label: s.label })),
    ...customSystems.systems.map((s) => ({ id: s.id as SystemSelectionId, label: s.name })),
  ]);

  const modeOptions: ReadonlyArray<{ id: PracticeMode; label: string }> = [
    { id: PracticeMode.DecisionDrill, label: "Decision drill" },
    { id: PracticeMode.FullAuction, label: "Full auction" },
    { id: PracticeMode.Learn, label: "Learn walkthrough" },
  ];

  const roleOptions: ReadonlyArray<{ id: PracticeRole; label: string }> = [
    { id: PracticeRole.Responder, label: "Responder" },
    { id: PracticeRole.Opener, label: "Opener" },
    { id: PracticeRole.Both, label: "Random per deal" },
  ];

  export function open(args: OpenArgs): void {
    errorMsg = null;
    if (args.mode === "create") {
      mode = "create";
      convention = args.convention;
      presetId = null;
      name = "";
      practiceMode = appStore.userPracticeMode ?? PracticeMode.DecisionDrill;
      practiceRole = appStore.userPracticeRole ?? PracticeRole.Responder;
      systemSelectionId = appStore.baseSystemId;
    } else {
      const drill = drillsStore.getById(args.presetId);
      if (!drill) return;
      mode = "edit";
      presetId = drill.id;
      convention = null;
      name = drill.name;
      practiceMode = drill.practiceMode;
      practiceRole =
        drill.practiceRole === "auto"
          ? appStore.userPracticeRole ?? PracticeRole.Responder
          : drill.practiceRole;
      systemSelectionId = drill.systemSelectionId;
    }
    dialogRef?.showModal();
  }

  export function close(): void {
    dialogRef?.close();
  }

  function conventionName(): string {
    if (convention) return displayConventionName(convention.name);
    if (presetId) {
      const drill = drillsStore.getById(presetId);
      const conventionId = drill?.moduleIds[0];
      if (!conventionId) return "";
      const matched = allConventions.find((item) => item.id === conventionId);
      if (matched) return displayConventionName(matched.name);
      return conventionId;
    }
    return "";
  }

  function doSave(): Drill | null {
    const err = drillsStore.validateName(name);
    if (err) { errorMsg = err; return null; }
    if (mode === "create") {
      if (!convention) return null;
      return drillsStore.create({
        name,
        moduleIds: [convention.id],
        practiceMode,
        practiceRole,
        systemSelectionId,
      });
    }
    if (!presetId) return null;
    drillsStore.update(presetId, { name, practiceMode, practiceRole, systemSelectionId });
    return drillsStore.getById(presetId) ?? null;
  }

  function onSave(): void {
    const saved = doSave();
    if (saved) close();
  }

  function onSaveAndLaunch(): void {
    const saved = doSave();
    if (saved) {
      close();
      onLaunch(saved);
    }
  }
</script>

<dialog
  bind:this={dialogRef}
  class="m-auto bg-bg-card border border-border-subtle rounded-[--radius-lg] shadow-xl p-0 w-[calc(100%-2rem)] max-w-md"
  onclick={(e) => { if (e.target === e.currentTarget) close(); }}
  aria-labelledby="drill-preset-dialog-title"
  data-testid="drill-preset-dialog"
>
  <div class="flex flex-col">
    <header class="flex items-center justify-between p-4 pb-2 shrink-0">
      <h2 id="drill-preset-dialog-title" class="text-sm font-semibold text-text-primary">
        {mode === "create" ? "Configure drill" : "Edit drill"}
      </h2>
      <button
        class="min-w-[--size-touch-target] min-h-[--size-touch-target] flex items-center justify-center text-text-secondary hover:text-text-primary cursor-pointer transition-colors rounded-[--radius-md]"
        onclick={close}
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </header>

    <div class="px-4 pb-4 space-y-4">
      <div>
        <p class="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Convention</p>
        <p class="text-sm text-text-primary">{conventionName()}</p>
      </div>

      <fieldset>
        <legend class="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Mode</legend>
        <div class="flex flex-col gap-1">
          {#each modeOptions as opt (opt.id)}
            <label class="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input type="radio" name="drill-preset-mode" value={opt.id} bind:group={practiceMode} />
              {opt.label}
            </label>
          {/each}
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Role</legend>
        <div class="flex flex-col gap-1">
          {#each roleOptions as opt (opt.id)}
            <label class="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input type="radio" name="drill-preset-role" value={opt.id} bind:group={practiceRole} />
              {opt.label}
            </label>
          {/each}
        </div>
      </fieldset>

      <div>
        <label for="drill-preset-system" class="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">System</label>
        <select
          id="drill-preset-system"
          bind:value={systemSelectionId}
          class="w-full px-3 py-2 rounded-[--radius-md] bg-bg-base border border-border-subtle text-sm text-text-primary"
        >
          {#each systemOptions as opt (opt.id)}
            <option value={opt.id}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <div>
        <label for="drill-preset-name" class="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Name</label>
        <input
          id="drill-preset-name"
          type="text"
          maxlength={DRILL_NAME_MAX}
          bind:value={name}
          placeholder="e.g. Stayman responder 2/1"
          class="w-full px-3 py-2 rounded-[--radius-md] bg-bg-base border border-border-subtle text-sm text-text-primary outline-none focus:border-accent-primary/40"
        />
        <p class="text-xs text-text-muted mt-1">Required, max {DRILL_NAME_MAX} characters.</p>
      </div>

      {#if errorMsg}
        <p class="text-xs text-red-400" role="alert">{errorMsg}</p>
      {/if}

      <div class="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium text-text-secondary hover:text-text-primary cursor-pointer"
          onclick={close}
        >Cancel</button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium border border-border-subtle text-text-primary hover:border-border-prominent cursor-pointer"
          onclick={onSave}
        >Save</button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover cursor-pointer"
          onclick={onSaveAndLaunch}
        >Save &amp; Launch</button>
      </div>
    </div>
  </div>
</dialog>

<style>
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
  }
</style>
