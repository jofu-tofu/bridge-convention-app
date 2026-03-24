<script lang="ts">
  import type { TeachingDetail } from "../../../service";
  import { formatCall } from "../../../service/display/format";

  interface Props {
    practicalRec: NonNullable<TeachingDetail["practicalRecommendation"]>;
  }

  let { practicalRec }: Props = $props();
</script>

<p class="text-fb-near-miss-text/70 text-[--text-label] mt-2 italic" data-testid="practical-note">
  Experienced players might prefer <span class="font-mono font-semibold">{formatCall(practicalRec.topCandidateCall)}</span> here — {practicalRec.rationale}
</p>
