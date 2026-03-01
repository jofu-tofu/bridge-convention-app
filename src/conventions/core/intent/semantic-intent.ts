// Semantic intent types — what the hand WANTS to communicate,
// independent of the concrete call used to express it.

export enum SemanticIntentType {
  AskForMajor = "ask-for-major",
  ShowHeldSuit = "show-held-suit",
  DenyHeldSuit = "deny-held-suit",
  InviteGame = "invite-game",
  ForceGame = "force-game",
  Signoff = "signoff",
  TransferTo = "transfer-to",
  AcceptTransfer = "accept-transfer",
  NaturalBid = "natural-bid",
  PenaltyRedouble = "penalty-redouble",
  EscapeRescue = "escape-rescue",
  CompetitivePass = "competitive-pass",
  PreemptiveOpen = "preemptive-open",
  ShowHandQuality = "show-hand-quality",
  RaiseToGame = "raise-to-game",
  AskHandQuality = "ask-hand-quality",
  ShowSupport = "show-support",
  ShowShortage = "show-shortage",
  AcceptInvitation = "accept-invitation",
  DeclineInvitation = "decline-invitation",
  HelpSuitGameTry = "help-suit-game-try",
  AskShortage = "ask-shortage",
  AcceptPartnerDecision = "accept-partner-decision",
  // Extended as needed per convention. NOT a fixed universe.
}

export interface SemanticIntent {
  readonly type: SemanticIntentType;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}
