<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    AVAILABLE_BASE_SYSTEMS,
    PracticeRole,
    displayConventionName,
    listConventions,
  } from "../../service";
  import type { SystemSelectionId } from "../../service";
  import {
    getAppStore,
    getCustomDrillsStore,
    getCustomSystemsStore,
  } from "../../stores/context";
  import type { CustomDrill } from "../../stores/custom-drills.svelte";
  import AppScreen from "../shared/AppScreen.svelte";

  interface Props {
    mode: "create" | "edit";
    drill?: CustomDrill;
  }
  const { mode, drill }: Props = $props();

  const appStore = getAppStore();
  const drillsStore = getCustomDrillsStore();
  const customSystems = getCustomSystemsStore();

  const allConventions = listConventions();

  let name = $state(drill?.name ?? "");
  let conventionId = $state<string>(
    drill?.conventionId ?? (allConventions[0]?.id ?? ""),
  );
  let practiceRole = $state<PracticeRole>(
    drill?.practiceRole ?? appStore.userPracticeRole ?? PracticeRole.Responder,
  );
  let systemSelectionId = $state<SystemSelectionId>(
    drill?.systemSelectionId ?? appStore.baseSystemId,
  );
  let errorMsg = $state<string | null>(null);

  const systemOptions = $derived([
    ...AVAILABLE_BASE_SYSTEMS.map((s) => ({ id: s.id as SystemSelectionId, label: s.label })),
    ...customSystems.systems.map((s) => ({ id: s.id as SystemSelectionId, label: s.name })),
  ]);

  const roleOptions: ReadonlyArray<{ id: PracticeRole; label: string }> = [
    { id: PracticeRole.Responder, label: "Responder" },
    { id: PracticeRole.Opener, label: "Opener" },
    { id: PracticeRole.Both, label: "Random per deal" },
  ];

  function onSave(): void {
    const err = drillsStore.validateName(name);
    if (err) { errorMsg = err; return; }
    if (!conventionId) { errorMsg = "Select a convention"; return; }
    if (mode === "create") {
      drillsStore.create({ name, conventionId, practiceRole, systemSelectionId });
    } else if (drill) {
      drillsStore.update(drill.id, { name, conventionId, practiceRole, systemSelectionId });
    }
    void goto("/practice/drill");
  }

  function onCancel(): void {
    void goto("/practice/drill");
  }
</script>

<AppScreen
  width="form"
  title={mode === "create" ? "New custom drill" : "Edit custom drill"}
  subtitle="Configure a drill you can come back to. Launching arrives in a later update."
>
  <div class="space-y-5">
    <div>
      <label for="custom-drill-name" class="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Name</label>
      <input
        id="custom-drill-name"
        type="text"
        maxlength={80}
        bind:value={name}
        placeholder="e.g. Stayman responder (2/1)"
        class="w-full px-3 py-2 rounded-[--radius-md] bg-bg-base border border-border-subtle text-sm text-text-primary outline-none focus:border-accent-primary/40"
      />
      <p class="text-xs text-text-muted mt-1">Required, max 80 characters.</p>
    </div>

    <div>
      <label for="custom-drill-convention" class="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Convention</label>
      <select
        id="custom-drill-convention"
        bind:value={conventionId}
        class="w-full px-3 py-2 rounded-[--radius-md] bg-bg-base border border-border-subtle text-sm text-text-primary"
      >
        {#each allConventions as c (c.id)}
          <option value={c.id}>{displayConventionName(c.name)}</option>
        {/each}
      </select>
    </div>

    <div>
      <label for="custom-drill-system" class="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1">System</label>
      <select
        id="custom-drill-system"
        bind:value={systemSelectionId}
        class="w-full px-3 py-2 rounded-[--radius-md] bg-bg-base border border-border-subtle text-sm text-text-primary"
      >
        {#each systemOptions as opt (opt.id)}
          <option value={opt.id}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <fieldset>
      <legend class="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Role</legend>
      <div class="flex flex-col gap-1">
        {#each roleOptions as opt (opt.id)}
          <label class="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input type="radio" name="custom-drill-role" value={opt.id} bind:group={practiceRole} />
            {opt.label}
          </label>
        {/each}
      </div>
    </fieldset>

    {#if errorMsg}
      <p class="text-xs text-red-400" role="alert">{errorMsg}</p>
    {/if}

    <div class="flex items-center justify-end gap-2 pt-2">
      <button
        type="button"
        class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium text-text-secondary hover:text-text-primary cursor-pointer"
        onclick={onCancel}
      >Cancel</button>
      <button
        type="button"
        class="px-3 py-1.5 rounded-[--radius-md] text-sm font-medium bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover cursor-pointer"
        onclick={onSave}
      >Save</button>
    </div>
  </div>
</AppScreen>
