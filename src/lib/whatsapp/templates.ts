import type { TemplateComponent } from "./send";

/**
 * The approved templates, and the only place their names and parameters are
 * written down.
 *
 * WHY ONE FILE. A template is a contract with Meta that lives in their console,
 * not in this repo — rename a parameter there and every send fails with a
 * 132012 that says nothing useful. Keeping the names and the builders together
 * means a change to the contract is one file to edit, and a caller that forgets
 * a parameter is a type error rather than a rejected message.
 *
 * BOTH ARE UTILITY. Category matters: utility is cheap, allowed for
 * operational notices, and the only category honest for "your job is booked".
 * If Meta ever recategorises one as marketing, the status webhook's pricing
 * object says so — that is why `whatsapp_messages.billing_category` exists.
 */

export const TEMPLATE_NAMES = {
  scheduled: "job_scheduled",
  schedule_changed: "schedule_changed",
} as const;

export type DispatchKind = keyof typeof TEMPLATE_NAMES;

/**
 * What both templates say, in variables.
 *
 * `street` is the street and city only. Unit number, lockbox code and access
 * notes are deliberately absent — they are behind the token, where a forwarded
 * screenshot cannot carry them.
 */
export type DispatchParams = {
  jobNumber: string;
  arrivalWindow: string;
  street: string;
  /** The crew token. It is the button's URL SUFFIX, never part of the body. */
  token: string;
};

/**
 * Meta rejects a parameter value (132012) that contains a newline, a tab, or
 * more than four consecutive spaces — and rejects a URL inside a body
 * parameter outright. Everything is squeezed through here rather than trusted,
 * because the values come from customer-entered addresses and hand-typed job
 * titles.
 */
export function sanitiseParam(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function body(params: DispatchParams): TemplateComponent {
  return {
    type: "body",
    parameters: [
      { type: "text", parameter_name: "job_number", text: sanitiseParam(params.jobNumber) },
      { type: "text", parameter_name: "arrival_window", text: sanitiseParam(params.arrivalWindow) },
      { type: "text", parameter_name: "street", text: sanitiseParam(params.street) },
    ],
  };
}

/**
 * The URL button. Three things here are easy to get wrong and all three have
 * been checked against Meta's docs: `index` is the STRING "0"; the parameter is
 * the SUFFIX only, because the base URL is baked into the approved template and
 * cannot be changed at send time; and button parameters are positional even
 * when the body uses named ones.
 */
function button(token: string): TemplateComponent {
  return {
    type: "button",
    sub_type: "url",
    index: "0",
    parameters: [{ type: "text", text: token }],
  };
}

export function componentsFor(params: DispatchParams): TemplateComponent[] {
  return [body(params), button(params.token)];
}

export function templateName(kind: DispatchKind): string {
  return TEMPLATE_NAMES[kind];
}

/**
 * The same message as free-form text, for when a 24-hour window happens to be
 * open and the template can be skipped.
 *
 * Not a saving worth engineering for — it is fractions of a cent — but it reads
 * better on the crew's phone: an ordinary message from a person they already
 * talk to, rather than a formatted notification. The link goes in the body here
 * because free-form has no button and no URL restriction.
 */
export function freeFormBody(
  kind: DispatchKind,
  params: DispatchParams,
  crewUrl: string,
  language: "fr" | "en",
): string {
  const lines =
    language === "fr"
      ? [
          kind === "scheduled"
            ? `Chantier ${params.jobNumber} confirmé.`
            : `Chantier ${params.jobNumber} : l'horaire a changé.`,
          `Arrivée : ${params.arrivalWindow}`,
          `Adresse : ${params.street}`,
          `Fiche de chantier : ${crewUrl}`,
        ]
      : [
          kind === "scheduled"
            ? `Job ${params.jobNumber} confirmed.`
            : `Job ${params.jobNumber}: the schedule has changed.`,
          `Arrival: ${params.arrivalWindow}`,
          `Address: ${params.street}`,
          `Job sheet: ${crewUrl}`,
        ];
  return lines.join("\n");
}
