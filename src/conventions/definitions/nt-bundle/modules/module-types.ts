// Re-export the generic ConventionModule as NtConventionModule for backward compatibility.
// New code should import ConventionModule from conventions/core/composition.
export type { ConventionModule as NtConventionModule } from "../../../core/composition/module-types";
