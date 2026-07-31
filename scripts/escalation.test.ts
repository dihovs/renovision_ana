import { shouldEscalate, similarity } from "../src/lib/voice/escalation";

let failures = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`  ok  ${label}`);
  else { failures++; console.log(`FAIL  ${label}\n      expected ${e}\n      got      ${a}`); }
}
function gte(actual: number, min: number, label: string) {
  if (actual >= min) console.log(`  ok  ${label} (${actual.toFixed(2)})`);
  else { failures++; console.log(`FAIL  ${label}: ${actual.toFixed(2)} < ${min}`); }
}
function lt(actual: number, max: number, label: string) {
  if (actual < max) console.log(`  ok  ${label} (${actual.toFixed(2)})`);
  else { failures++; console.log(`FAIL  ${label}: ${actual.toFixed(2)} >= ${max}`); }
}

console.log("— similarity —");
gte(similarity("combien ça coûte pour refaire le plancher",
               "ça coûte combien le plancher"), 0.55, "same question reworded (fr)");
gte(similarity("how much to redo the bathroom floor",
               "the bathroom floor, how much"), 0.55, "same question reworded (en)");
lt(similarity("combien ça coûte pour le plancher de cuisine",
              "est-ce que vous travaillez la fin de semaine"), 0.55, "different topics");
gte(similarity("cout plancher cuisine", "coût plancher cuisine"), 0.9, "accents folded");

console.log("— escalation —");
let v = shouldEscalate("combien ça coûte", []);
eq(v.escalate, false, "first ask never escalates");

v = shouldEscalate("combien ça coûte pour le plancher", ["le plancher ça coûte combien"]);
eq(v.escalate, false, "one repeat is not enough");

v = shouldEscalate("combien ça coûte pour le plancher",
  ["le plancher ça coûte combien", "combien pour le plancher"]);
eq(v.escalate, true, "two repeats escalate");
gte(v.repeatCount, 2, "repeat count reported");

console.log("— frustration markers —");
v = shouldEscalate("non c'est pas ça que je demande", ["combien pour le plancher"]);
eq(v.escalate, true, "french frustration escalates immediately");
v = shouldEscalate("That's not what I asked", ["how much for the floor"]);
eq(v.escalate, true, "english frustration escalates immediately");

console.log("— fragments —");
v = shouldEscalate("quoi?", ["quoi?", "quoi?"]);
eq(v.escalate, false, "short fragments do not escalate");
v = shouldEscalate("hein", ["hein", "hein"]);
eq(v.escalate, false, "one-word turns do not escalate");

console.log("— stickiness —");
v = shouldEscalate("anything at all", [], { alreadyEscalated: true });
eq(v.escalate, true, "stays escalated once escalated");

console.log("— cross-language —");
gte(similarity("how much does the floor cost", "combien coûte le plancher"), 0, "no crash on mixed langs");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
