/**
 * ESLint rule: no-full-scope-trigger
 *
 * Warns when semantic() protocol triggers use condition factories that are
 * NOT event-local (triggerScope: "event"). Protocol triggers should only use
 * event-local conditions; full-history conditions belong in seatFilters.
 *
 * Allowlist of event-local condition factories. When adding a new condition
 * with triggerScope: "event", add its factory name here.
 */
const TRIGGER_SAFE_FACTORIES = [
  "bidMade",
  "bidMadeAtLevel",
  "doubleMade",
  "partnerBidMade",
  "opponentBidMade",
  "cursorReached",
  "noPriorBid",
  "partnerOpenedAt",
];

/** Combinators that compose other conditions — safe if all args are safe. */
const COMBINATOR_FACTORIES = ["or", "and", "not"];

/**
 * Recursively check whether a CallExpression node uses only allowlisted
 * condition factories. Returns the name of the first non-allowlisted factory,
 * or null if all are safe.
 */
function findUnsafeCondition(node) {
  if (node.type !== "CallExpression") return null;

  const callee = node.callee;
  let calleeName;
  if (callee.type === "Identifier") {
    calleeName = callee.name;
  } else if (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier"
  ) {
    calleeName = callee.property.name;
  } else {
    return null; // Can't statically determine
  }

  if (TRIGGER_SAFE_FACTORIES.includes(calleeName)) return null;

  if (COMBINATOR_FACTORIES.includes(calleeName)) {
    // Check all arguments recursively
    for (const arg of node.arguments) {
      const unsafe = findUnsafeCondition(arg);
      if (unsafe) return unsafe;
    }
    return null;
  }

  return calleeName;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Protocol triggers should use event-local conditions (triggerScope: 'event'). " +
        "Use seatFilter for full-history conditions.",
    },
    messages: {
      fullScopeTrigger:
        'Protocol trigger uses "{{ name }}" which is not in the event-local allowlist. ' +
        "Use seatFilter for full-history conditions, or add the factory to the allowlist " +
        "in eslint-rules/no-full-scope-trigger.js if it is event-local.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        // Match: semantic(someCondition(...), { ... })
        if (
          node.callee.type !== "Identifier" ||
          node.callee.name !== "semantic"
        ) {
          return;
        }

        const firstArg = node.arguments[0];
        if (!firstArg || firstArg.type !== "CallExpression") {
          // Not a call expression (variable reference, etc.) — can't statically check
          return;
        }

        const unsafeName = findUnsafeCondition(firstArg);
        if (unsafeName) {
          context.report({
            node: firstArg,
            messageId: "fullScopeTrigger",
            data: { name: unsafeName },
          });
        }
      },
    };
  },
};

export { rule };
