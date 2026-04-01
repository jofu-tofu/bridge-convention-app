import type { Contract, Vulnerability } from "../../../service";
import { Vulnerability as Vul, formatContractWithDeclarer } from "../../../service";

/** Human-readable vulnerability label */
export function formatVulnerability(v: Vulnerability): string {
  switch (v) {
    case Vul.None: return "None Vul";
    case Vul.NorthSouth: return "N-S Vul";
    case Vul.EastWest: return "E-W Vul";
    case Vul.Both: return "Both Vul";
  }
}

/** Format contract result like "3NT= — +400" or "2H -1 — -100" */
export function formatResult(
  contract: Contract | null,
  score: number | null,
  declarerTricksWon: number,
): string | null {
  if (!contract || score === null || score === undefined || declarerTricksWon === null || declarerTricksWon === undefined) return null;
  const required = contract.level + 6;
  const contractWithDeclarer = formatContractWithDeclarer(contract);

  if (declarerTricksWon >= required) {
    const over = declarerTricksWon - required;
    const trickStr = over === 0 ? "=" : `+${over}`;
    return `${contractWithDeclarer} ${trickStr} — ${score >= 0 ? "+" : ""}${score}`;
  } else {
    const down = required - declarerTricksWon;
    return `${contractWithDeclarer} -${down} — ${score}`;
  }
}
