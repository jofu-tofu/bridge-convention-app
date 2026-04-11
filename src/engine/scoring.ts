import { Seat, Vulnerability } from "./types";

/** Check if a declarer is vulnerable given the vulnerability setting. */
export function isVulnerable(
  declarer: Seat,
  vulnerability: Vulnerability,
): boolean {
  switch (vulnerability) {
    case Vulnerability.None:
      return false;
    case Vulnerability.Both:
      return true;
    case Vulnerability.NorthSouth:
      return declarer === Seat.North || declarer === Seat.South;
    case Vulnerability.EastWest:
      return declarer === Seat.East || declarer === Seat.West;
  }
}
