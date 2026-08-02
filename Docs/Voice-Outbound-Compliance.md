# Outbound AI Voice Calls — Legal & Compliance Analysis (Quebec)

**Scope:** Ana (ElevenLabs voice + Claude) placing *outbound* calls to Renovision AnA's existing
customers for operational reasons: confirming a booked visit, following up on a quote already sent,
warning that a crew is running late.

**Status:** Research, 2026-08-02. Not legal advice — neither the author nor the owner is a lawyer.
This is "what the rules say and what to do about it". Section 12 lists the points where a real
lawyer is worth the money.

---

## 1. Verdict

**Yes, this can be built — but only as a strictly non-commercial, transactional caller, and the
safe version of it requires collecting express consent from the customer at booking time.**

Three findings drive everything below.

1. **The AI voice almost certainly counts as an ADAD.** The CRTC's definition of an Automatic
   Dialing-Announcing Device covers automatic equipment that stores or produces phone numbers and
   is used "to convey a pre-recorded **or synthesized** voice message". An ElevenLabs TTS voice
   dialled by our own code is, on the plain words, a synthesized voice message. The ADAD rules
   therefore apply *even though this is not telemarketing* — that is the whole point of the ADAD
   rules, which bite regardless of whether anything is being sold.

2. **Non-solicitation ADAD calls are legal without consent, but only if the call opens with a
   prescribed identification message and stays inside prescribed hours.** These are implementable.
   See the checklist in §10.

3. **The moment Ana sells, promotes, or upsells anything — even indirectly — the call becomes ADAD
   telemarketing, and ADAD telemarketing requires *prior express consent*. An existing business
   relationship does NOT cure this.** The CRTC considered and expressly rejected an "indirect
   solicitation is fine" carve-out. This is the single line that decides whether the feature is
   legal as designed.

**Recommended posture:** build it as a non-solicitation caller *and* capture express ADAD consent at
booking anyway. Consent costs one sentence on the booking form and removes the hardest risk
(the "was that follow-up call solicitation?" argument) entirely. The CRTC itself points businesses
to this route.

**One caveat on timing.** The CRTC opened a full review of these rules on 11 June 2026
(Notice of Consultation CRTC 2026-132), and it asks, in terms, whether the ADAD definition captures
AI-generated voices and whether callers should have to say they are not a live person. Comments
closed 27 July 2026; replies 11 August 2026. No decision yet. **The rules may change within the
next year, probably in the direction of more obligations, not fewer.** Design so the disclosure
line is a config value, not something welded into a prompt.

---

## 2. Which laws are actually in play

| Regime | Applies? | Why |
|---|---|---|
| CRTC Unsolicited Telecommunications Rules — **ADAD rules** | **Yes** | Synthesized voice; applies to non-solicitation calls too |
| CRTC UTRs — Telemarketing rules & National DNCL | **No**, if the call never solicits | Those two parts apply only to telemarketing |
| CASL (anti-spam) | **No** | s. 6(8) excludes voice telephone communications |
| PIPEDA | **Partly** | Applies to the cross-border/interprovincial data flows |
| Quebec Law 25 (P-39.1) | **Yes** | Quebec enterprise, Quebec customers; governs the transcript |
| Charter of the French Language (Bill 96) | **Yes** | Must be able to serve the customer in French |
| Quebec Consumer Protection Act | **Only if Ana sells** | Itinerant-merchant and distance-contract rules |

CASL is the one people expect to apply and it does not: s. 6(8) of CASL excludes messages that are
"an interactive two-way voice communication between individuals" and voice recordings sent to a
telephone account. Voice calls are governed by the CRTC's UTRs instead.

On PIPEDA vs Law 25: Quebec's private-sector Act was declared substantially similar to PIPEDA by
the *Organizations in the Province of Quebec Exemption Order* (SOR/2003-374), so Quebec law governs
the intra-provincial activity. PIPEDA continues to apply to personal information that crosses
provincial or national borders — which is exactly what happens when audio goes to ElevenLabs and
text goes to Anthropic. **Both regimes are live here.** Plan for the stricter of the two, which is
Law 25.

---

## 3. CRTC Unsolicited Telecommunications Rules — telemarketing vs everything else

### 3.1 The definitions that matter

From the CRTC Unsolicited Telecommunications Rules (Part I):

- **"Telemarketing"** — "the use of telecommunications facilities to make unsolicited
  telecommunications for the purpose of solicitation".
- **"Solicitation"** — "the selling or promoting of a product or service, or the soliciting of money
  or money's worth, whether directly or indirectly and whether on behalf of another person".
- **"ADAD"** — "any automatic equipment incorporating the capability of storing or producing
  telecommunications numbers used alone or in conjunction with other equipment to convey a
  pre-recorded or synthesized voice message".

Note "**whether directly or indirectly**" in the solicitation definition. That word does real work —
see §4.3.

### 3.2 The structural point

The UTRs are three separate rule sets, and they do not have the same reach:

- The **National DNCL Rules** and the **Telemarketing Rules** apply *only* to telemarketing.
- The **ADAD Rules** are broader: they impose restrictions "even in circumstances where there is no
  attempt to sell or promote a product or service (i.e., to solicit)".

So for a genuinely transactional appointment-confirmation call:
**DNCL rules — not engaged. Telemarketing rules — not engaged. ADAD rules — engaged.**

### 3.3 Existing business relationship (EBR)

The EBR exemption is real but narrower and less useful than it sounds.

Defined at s. 41.7(2) of the *Telecommunications Act*, an EBR arises from voluntary two-way
communication based on: a purchase of products/services within the preceding **18 months**; an
inquiry or application within the preceding **6 months**; or a written contract currently in
existence or expired within **18 months**.

What it buys you: exemption from the **National DNCL** rules (Part II, rule 3(b) of the UTRs) for
telemarketing calls, provided the person has not made a do-not-call request.

What it does **not** buy you: **anything at all under the ADAD rules.** In Compliance and
Enforcement Regulatory Policy CRTC 2014-155, the Commission denied the Canadian Marketing
Association's application to allow ADAD telemarketing on the basis of an existing business
relationship. Express consent remains required for ADAD telemarketing, EBR or no EBR.

**Practical translation:** for our use case the EBR is close to irrelevant. Either the call is
non-solicitation (and the DNCL was never in play), or it is solicitation by ADAD (and the EBR does
not help). Do not build the feature on an EBR theory.

---

## 4. ADAD — the crux

### 4.1 Does a conversational AI count as an ADAD?

**Assume yes.** The safe answer and the probable answer are the same.

The definition has two limbs, and an outbound Ana meets both:

- *"automatic equipment incorporating the capability of storing or producing telecommunications
  numbers"* — a dialer pulling numbers from the `calls`/`leads` tables does this.
- *"to convey a pre-recorded or synthesized voice message"* — ElevenLabs output is a synthesized
  voice. The rule says "synthesized", not "recorded", and not "one-way".

The argument for "no" is that a two-way conversational agent is not really "conveying a message" in
the announcing-device sense the rule was written for in 2008. That argument is **not frivolous, but
it is untested** — there is no CRTC decision, and no Canadian case I could find, holding that
conversational AI falls outside the ADAD definition. Relying on it would be betting the feature on
an unlitigated reading of a definition the regulator is currently reviewing.

The review itself is telling. **CRTC 2026-132, Question 2** asks:

> "With today's technology and available applications, is the definition sufficient to capture
> software, applications, or technologies that use synthesized voices, recordings, artificial
> intelligence, or other methods of non-human generated voice messages?"

The Commission expresses no preliminary view. But it also asks whether the UTRs should *continue* to
regulate non-solicitation ADAD use "if it is determined that the definition of ADAD captures"
AI-generated voice — which shows the Commission regards capture as a live possibility, not an
absurdity.

**Design decision: treat Ana as an ADAD. Comply with Part IV rule 4. The cost is one longer opening
sentence and a time-of-day check.**

### 4.2 What a non-solicitation ADAD call must include

UTRs Part IV, rule 4 (as revised by CRTC 2014-155) — conditions for ADAD calls that do not attempt
to solicit. Paraphrased, with the load-bearing bits quoted:

- **(a)** No calls to emergency lines or healthcare facilities.
- **(b)** Hours: **09:00–21:30 weekdays, 10:00–18:00 weekends**, recipient's local time.
- **(c)** More restrictive provincial hours prevail where they exist.
- **(d)** The call must **begin with** "a clear message identifying the person on whose behalf the
  telecommunication is made **and a brief description of the purpose** of the telecommunication",
  plus "an electronic mail address or postal mailing address **and** a local or toll-free
  telecommunications number at which a representative of the originator of the message can be
  reached". If the message runs over **60 seconds**, the identification message must be repeated at
  the end.
- **(e)** Display the originating number or an alternate number at which the originator can be
  reached.
- **(f)** No sequential dialling.
- **(g)** Random dialling permitted except to emergency/healthcare numbers.
- **(h)** Equipment must **disconnect within 10 seconds** of the called party hanging up.
- **(i)** Exception for public-service messages from police, fire, schools, hospitals and similar
  bodies — **we do not qualify for this.**
- **(j)** The email/postal address and phone number given must remain valid for at least **60 days**
  after the call.

*Numbering note: the sub-paragraph lettering above is as rendered on the CRTC's published Rules page
and is consistent across two independent readings, but re-verify the exact lettering against
crtc.gc.ca before quoting it in anything external.*

Rule 4(d) is the important one, and it is satisfiable: it is an opening script. §11 has a draft.

**Notably NOT required for non-solicitation ADAD calls:** an opt-out mechanism. In CRTC 2014-155 the
Commission declined to extend internal do-not-call-list obligations to non-solicitation ADAD calls,
finding "an insufficient basis upon which to amend the rules", because doing so would restrict
genuinely useful calls (safety notices, service disruptions). **Build one anyway** — privacy law
gives the customer a right to withdraw consent to the processing regardless of what the CRTC
requires, and it is the cheapest goodwill in the project.

### 4.3 The line that must not be crossed: solicitation

This is the finding that most constrains the design.

If an ADAD call contains solicitation — *directly or indirectly* — then Part IV rule 2 applies:

> "A telemarketer shall not initiate, and a client of a telemarketer shall make all reasonable
> efforts to ensure that the telemarketer does not initiate, a telemarketing telecommunication via
> an ADAD unless express consent has been provided by the consumer to receive a telemarketing
> telecommunication via an ADAD from that telemarketer or the client of that telemarketer."

Businesses have tried to argue that service-related calls with a commercial edge are not really
solicitation. **The CRTC rejected this in 2014-155.** Rogers proposed that a call should not count
as solicitation where it relates to a service already supplied, the company name displays on caller
ID, and the ADAD can connect to a live agent. The Commission refused, at paragraphs 51–53:

> **¶51** "The Commission considers that it would be impractical to treat some ADAD calls containing
> solicitation as non-solicitation calls, as it would be extremely difficult to determine the point
> from which solicitation is the primary or direct purpose of a call and thus requires express
> consent."
>
> **¶52** "The Commission is also concerned that telemarketers could circumvent the rule by crafting
> their messages to give the false impression that solicitation is not the primary or direct purpose
> of the ADAD call."
>
> **¶53** "To the extent that businesses consider that consumers would benefit from receiving these
> ADAD telecommunications, the Commission notes that businesses are free to explain to consumers the
> value of these calls and seek express consent to make them under the existing rule."

Applied to our three use cases:

| Use case | Assessment |
|---|---|
| "Your estimator comes tomorrow at nine" | **Clearly fine.** Pure logistics, no promotion. |
| "The crew is running late" | **Clearly fine.** |
| "Following up after a quote was sent" | **Grey, and the grey is real.** Asking *"did the quote arrive, do you have questions?"* is arguably servicing an inquiry the customer initiated. Asking *"would you like to go ahead?"* or mentioning a discount, a deadline, or another service is promoting a service. Given ¶51–52, a regulator will not spend much time drawing that line charitably. |

**Therefore:** either (a) restrict quote follow-ups to *"I'm calling to check the quote reached you
and to answer questions — Artush will call you back to discuss it"*, with a hard prompt guardrail
against closing language, **or** (b) collect express ADAD consent at booking and stop worrying about
it. Option (b) is better, cheaper, and is what ¶53 invites.

### 4.4 What valid express consent looks like

UTRs Part V. Acceptable forms include written consent (a signed/completed form), oral consent
verified by an independent third party or where an audio recording of the consent is retained,
electronic consent via a toll-free number or the Internet, or "consent through other methods as long
as a documented record of consumer consent is created". Part IV rule 3 requires the consent record
to clearly evidence the consumer's authorization, **tied to the specific telephone number**.

"The onus is on the telemarketer … to demonstrate that valid express consent was given." Consent can
be withdrawn at any time.

**Implementation:** a distinct, unticked checkbox on the booking form and the estimator form, with
the number it applies to captured alongside it, and a row written to the database recording the
exact wording shown, the timestamp, the IP/channel, and the number consented to. Records must be
producible to the Commission within **30 days** of a request.

---

## 5. National Do Not Call List

**Does it apply?** Only to telemarketing. A genuine appointment-confirmation call is not
telemarketing, so the National DNCL Rules are not engaged, and there is nothing to scrub against.

**If Ana ever solicits**, the picture changes and three things happen at once:

1. The National DNCL rules engage — but the **existing business relationship exemption** (Part II
   rule 3(b), *Telecommunications Act* s. 41.7) would cover calls to a customer who purchased within
   18 months and has not made a do-not-call request.
2. **Registration is still required.** The CRTC is explicit: "All telemarketers must register with
   the National DNCL. Even if you only make exempt calls or send exempt faxes, you must still
   register." You would not have to *purchase a subscription* if all your calls are exempt, but you
   must register.
3. The **ADAD express-consent rule applies anyway** (Part IV rule 1: the ADAD rules apply regardless
   of DNCL exemptions), and the EBR does not satisfy it. So the DNCL exemption is cold comfort.

**Obligations that survive any DNCL exemption:** maintain an internal do-not-call list; add a number
within **14 days** of the request; keep the entry for **three years and fourteen days** from the
date of the request; identify yourself on the call; provide contact details on request; keep
records and produce them within 30 days.

---

## 6. Calling hours

**Federal (CRTC), applies to both telemarketing and non-solicitation ADAD calls:**

- Weekdays: **09:00 – 21:30**
- Weekends: **10:00 – 18:00**
- In the **called party's** local time.

**Quebec-specific:** UTR rule 4(c) defers to more restrictive provincial legislation where it
exists. I searched for a Quebec statute imposing tighter telephone-solicitation hours and **did not
find one**; Quebec sources (including the real-estate board's solicitation guidance) simply restate
the CRTC window. I am reporting that as *not found*, not as *confirmed absent* — if the calling
window is ever pushed to the edges, have this checked.

**Recommendation regardless of the law:** call **09:00–20:00 weekdays and 10:00–17:00 Saturdays,
never Sundays, never statutory holidays.** A renovation company phoning a customer at 21:15 is
legal and is still a bad phone call. Water-damage emergencies are a separate path and should be a
human, not Ana.

---

## 7. Disclosing that the caller is an AI

### 7.1 Is it legally required in Canada today?

**No binding Canadian rule requires it, today.** Specifically:

- **CRTC:** no current requirement. CRTC 2026-132 **Question 10** asks whether there should be one:
  *"Should the identification requirements be expanded to require telemarketers to tell consumers
  that the call is using this sort of technology (i.e., it is not a live person making the call and
  speaking with the consumer at the start of the call)?"* Open question, no answer yet.
- **Federal AI legislation:** AIDA (in Bill C-27) did not become law. Treat any claim that a federal
  AI statute imposes disclosure duties today with suspicion until verified.
- **Law 25:** the automated-decision-making provision requires notice when a decision is made
  *exclusively* by automated processing. Confirming an appointment is not a decision about the
  person, so it very likely does not trigger it. (Boundary: if Ana ever decides something that
  affects the customer — declining a job, setting a price — that provision engages and would require
  notice plus a route to a human. Today's design has a human review every call, which is the right
  side of the line.)
- **Misleading-representation law** (Competition Act; Quebec CPA prohibitions on false
  representations) is the real backstop: **actively pretending to be a human employee would be the
  exposure**, not failing to volunteer that you are not.

### 7.2 What best practice says

Canada's federal, provincial and territorial privacy authorities — **the CAI among them** — endorsed
joint *Principles for responsible, trustworthy and privacy-protective generative AI technologies*
(7 December 2023), which include transparency about AI use and, as a good practice, labelling
AI-generated content.

Internationally the direction is unambiguous: the EU AI Act imposes a transparency duty on AI
systems that interact with natural persons, and the US FCC has ruled AI-generated voices are covered
by its robocall regime. Neither binds a Laval contractor. Both indicate where Canada is heading, and
CRTC 2026-132 Q10 is the local version of the same question.

### 7.3 Recommendation

**Disclose, unprompted, in the first sentence, in plain language, and say it as a normal human
would.** Three reasons: it will probably be mandatory within a year or two; it is what the inbound
agent already does; and it costs nothing.

The inbound greeting today (`src/lib/voice/agent.ts`, `greeting()`) is:

> "Renovision AnA, bonjour! Je suis Ana, l'assistante virtuelle. Cet appel est transcrit pour la
> qualité du service. …"

That is a good start but **not sufficient for an outbound ADAD call**: it lacks the purpose of the
call and the contact details that rule 4(d) requires. It is also arguably soft on the AI point —
"assistante virtuelle" is understood by most people but is not the same as "I am not a person."
§11 has an outbound version.

---

## 8. Recording, transcription, and Law 25

### 8.1 Criminal Code one-party consent is not the answer

Canada is a one-party-consent jurisdiction for the *criminal* offence of intercepting a private
communication. *Criminal Code* **s. 184(1)** makes it an offence to knowingly intercept a private
communication; **s. 184(2)(a)** exempts "a person who has the consent to intercept, express or
implied, of the originator of the private communication or of the person intended by the originator
thereof to receive it". Because the business is a party to the call, its own consent satisfies that.
Recording your own call is not a crime.

**That is the entire scope of the exemption, and it decides nothing else.** Three reasons it is not
the answer:

1. **s. 193** makes it an offence to knowingly *use or disclose* an intercepted private communication
   without the express consent of the originator or intended recipient. If your only consent is your
   own, handing the audio to third-party processors sits on much weaker ground than if the customer
   also consented.
2. It says nothing about whether the business may lawfully **collect, use, keep or transfer** the
   resulting personal information. That is privacy law, and privacy law is stricter.
3. **Quebec civil law applies independently.** *Civil Code of Québec* **art. 35**: "The privacy of a
   person may not be invaded without the consent of the person or without the invasion being
   authorized by law." **Art. 36** lists as invasions of privacy, in particular, "(2) intentionally
   intercepting or using his private communications" and "(3) appropriating or using his image or
   voice while he is in private premises". **Art. 37** requires a "serious and legitimate reason" for
   establishing a file on another person. Compliance with s. 184 is no defence to an art. 35 claim.

### 8.2 PIPEDA — the OPC's guidance, and one case that is directly on point

The OPC's guidance *Recording of Customer Telephone Calls* applies "whether the customer or the
organization initiates the call". Requirements:

- Record only for purposes a reasonable person would consider appropriate (PIPEDA s. 5(3)).
- **Tell the customer the call is being recorded, at the time of the call, and clearly state the
  purpose.**
- **Purpose limitation:** an organization "should not state that it is recording…for quality
  assurance purposes if the recording will be used for other purposes, such as marketing or
  profiling."
- **Offer an alternative** to customers who object — retail outlet, letter, online.
- The customer has a **right to request access** to the recording later.
- Limit retention; maintain safeguards; make third-party call centres follow the same rules.
- Narrow exceptions exist for debt collection and fraud investigation. Neither applies here.

**PIPEDA Case Summary #2007-384 is the one to know.** A telecom recorded *outbound* marketing calls
relying on its published privacy policy. The Commissioner found "the statement in the privacy policy
to be insufficient for the individual's consent in the case of outgoing calls," and required
"reasonable efforts to ensure not just the possibility, but the presence, of the individual's
knowledge at the time of collection" — i.e. tell the person **at the beginning of each outgoing
call**, by automated message or by the representative, that the call is recorded and why.

**Translation: a link to renovisionana.ca/confidentialite does not authorise recording an outbound
call. It has to be spoken, up front, every time.** This is independent of the CRTC's rule 4(d)
opening requirement, and it points the same way.

### 8.3 Law 25 — what it adds, with verified section numbers

Law 25 amended the *Act respecting the protection of personal information in the private sector*
(P-39.1). Section numbers below were read from the official consolidated text on LégisQuébec.

- **s. 8 — information at collection.** You must inform the person, *when the information is
  collected*, of (1) the **purposes**; (2) the **means by which the information is collected**;
  (3) the **rights of access and rectification**; and (4) the **right to withdraw consent**. Second
  paragraph, where applicable: the **third persons or categories of third persons** to whom the
  information must be communicated, **and the possibility that the information could be communicated
  outside Québec**. Third paragraph, *on request*: the information collected, who internally has
  access, **the retention period**, and the contact details of the person in charge. All of it "in
  clear and simple language, regardless of the means used".
- **s. 8.2 — confidentiality policy.** Anyone collecting personal information "through technological
  means" must publish a confidentiality policy in clear and simple language on the website.
- **s. 14 — valid consent.** Must be "clear, free and informed and be given for specific purposes"
  (French: *manifeste, libre, éclairé*), "requested for each such purpose, in clear and simple
  language", presented separately from other information if in writing, and is "valid only for the
  time necessary to achieve the purposes". Critically: **"Consent not given in accordance with this
  Act is without effect."** There is no reasonableness cure.
  The CAI's *Lignes directrices 2023-1* break this into eight cumulative criteria and state that if
  one fails, the consent is invalid. The one that bites hardest here is **granularity**: a single
  blanket "this call may be recorded" does not cover recording *plus* third-party AI transcription
  *plus* transcript retention *plus* any secondary use. And *libre* means refusing must be as easy as
  agreeing.
- **s. 3.1 — person in charge.** "The person exercising the highest authority" holds the role **by
  operation of law** — for Renovision AnA that is the owner, automatically, with no appointment
  needed. Delegation must be **in writing**. The **title and contact information must be published**
  on the website. No filing with the CAI is required.
- **s. 3.2 — governance policies.** Framework for keeping and destruction, roles of personnel across
  the information life cycle, and a complaints process; proportionate to the enterprise; approved by
  the person in charge; **detailed information published**. Note this is a *separate* publication
  obligation from s. 8.2 — they are commonly conflated.
- **s. 3.3 — privacy impact assessment (ÉFVP).** Required for any project to "acquire, develop or
  overhaul an information system … involving the collection, use, communication, keeping or
  destruction of personal information", consulting the person in charge "from the outset". Scope
  must be "proportionate to the sensitivity of the information concerned, the purposes …, the
  quantity and distribution of the information and the medium".
- **s. 17 — communication outside Québec.** Quoted because it is the provision most likely to be
  breached here:
  > "**Before** communicating personal information outside Québec, a person carrying on an enterprise
  > **must conduct a privacy impact assessment**. … The information may be communicated **if the
  > assessment establishes that it would receive adequate protection** … The communication of the
  > information **must be the subject of a written agreement** … **The same applies where the person
  > carrying on an enterprise entrusts a person or body outside Québec with the task of collecting,
  > using, communicating or keeping such information on his behalf.**"

  That last sentence is decisive: **it does not matter that ElevenLabs and Anthropic are processors
  rather than recipients.** Entrusting them with collecting, using or keeping the information
  triggers the identical duty. Supabase's Montreal region does not cure it, because the audio and
  text are processed in the US before anything lands in Montreal. The CAI's ÉFVP guide states the
  hard stop plainly: if you conclude the information will not receive adequate protection, you must
  refuse to communicate it or refrain from entrusting it to the third party.
- **s. 18.3 — processors.** Communication to a processor without consent is allowed where necessary
  for the contract, but the mandate must be **in writing** and must specify measures to protect
  confidentiality, to ensure the information is **used only for carrying out the mandate**, and to
  ensure the processor **does not keep it after the contract expires**. The processor must notify
  your person in charge **without delay** of any violation or attempted violation, and must allow
  verification.
- **s. 12.1 — automated decisions.** Applies to "a decision based **exclusively** on an automated
  processing" of personal information. See §8.5.
- **s. 23 — destruction.** When the purposes are achieved, you "must destroy the information, or
  anonymize it". Anonymization must be **irreversible** and follow prescribed criteria. **s. 11**
  requires information used to make a decision to be kept **at least one year** after the decision.
- **ss. 3.5–3.8 — confidentiality incidents.** Notify the CAI and affected persons where an incident
  presents "a risk of serious injury"; maintain a **register of all incidents** (not just notifiable
  ones). Under the *Règlement sur les incidents de confidentialité* (CQLR c A-2.1, r. 3.1) the
  register must be kept for **a minimum of 5 years**, and the CAI notice has 11 prescribed fields.
  A misconfigured RLS policy exposing the `calls` table is a textbook incident.

**What Law 25 adds over PIPEDA, concretely** — these are the deltas that change the script and the
build, not general commentary:

1. You must state the **means of collection** (s. 8(2)) — i.e. that an automated voice system is
   doing this — not just the purpose.
2. You must state the **right to withdraw consent** (s. 8(4)).
3. You must state **the possibility of communication outside Québec** (s. 8 para. 2). PIPEDA has no
   equivalent mandatory upfront statement, and this is the one small businesses miss.
4. Consent must be **granular per purpose**, and non-compliant consent is **void**, not merely weak.
5. A **PIA is mandatory** (ss. 3.3 and 17), twice over. PIPEDA has none.
6. A **named, published person in charge** (s. 3.1) and **published governance policies** (s. 3.2).
7. A **written processor mandate with prescribed clauses** (s. 18.3).
8. **Minimum $1,000 punitive damages** for intentional or grossly negligent infringement (s. 93.1).

### 8.4 The concrete gaps in the current build

### 8.4 The concrete gaps in the current build

These are facts about this repository, not hypotheticals:

1. **ElevenLabs retains conversation transcripts and audio for 2 years by default.** Retention is
   configurable per agent (Advanced → Data Retention, or `platform_settings.privacy.retention_days`)
   with `0` meaning immediate deletion and `-1` unlimited, and audio and transcripts are controlled
   independently. The privacy policy says "we keep no audio recording" — that is true of our
   Supabase, and false of the platform actually running the call. **Set audio retention to 0.**
2. **The privacy policy names the wrong vendor.** `src/components/pages/PrivacyContent.tsx` tells
   customers their speech is converted to text by **Twilio**. On the live path ElevenLabs does STT,
   TTS and orchestration and holds the audio. ElevenLabs appears nowhere in user-facing copy. Under
   Law 25's third-party disclosure duty this needs fixing **before** outbound calling ships, and
   arguably today for inbound.
3. **The 24-month retention purge does not run.** `purge_stale_calls()` exists
   (`supabase/migrations/0009_calls.sql`) and the cron route refuses to run without `CRON_SECRET`,
   which per `Docs/Automation-Blockers.md` is unset. The policy promises a retention limit the system
   is not currently delivering. Outbound calling multiplies the number of transcripts.
4. **No PIA exists.** Required for the outside-Quebec transfer and for the new system.
5. **Compute region is unpinned**, so calls to a Montreal database round-trip through a US region.
   This does not by itself breach anything given the transfer is already assessed and papered, but it
   undercuts the stated rationale for choosing Montreal and belongs in the PIA.
6. **There is no on-demand deletion endpoint.** The policy says a customer can ask for a transcript
   to be deleted "at any time" — currently a manual process. Acceptable for the volume, but the
   process should be written down in the governance policy.

Anthropic's commercial API deletes inputs and outputs within 30 days by default and does not train
on them; zero-data-retention is available by agreement. Worth stating accurately in the PIA.

### 8.5 Biometrics — probably not engaged, worth knowing about

Quebec has a distinct regime requiring disclosure to the CAI before bringing a **database of
biometric characteristics** into service. Synthesizing a voice and transcribing speech does **not**
create a biometric database. **If** the system ever adds voiceprint-based caller identification, that
regime engages and requires advance notice to the CAI. Do not build voice-ID without advice.

---

## 9. French language (Charter of the French Language / Bill 96)

**The honest summary: the Charter's explicit, itemised rules are mostly about written things —
signage, commercial publications, contracts, websites, product documentation. There is no provision
that says "phone calls must open in French" in those words.** Commentary that implies otherwise is
overstating it.

**But the substantive obligation still lands on you**, via the consumer's right to be informed and
served in French, which Bill 96 elevated into the Charter (commonly cited as s. 50.2 — *verify the
section number against the Charter before relying on it externally*). An enterprise offering goods
or services to consumers in Quebec must be able to inform and serve them in French. A phone call the
business initiates is plainly part of serving the customer.

Practical consequences for outbound:

- **Open in French.** Always. It is the default and it is free.
- **Switch to English on request, or when you already know the customer's language.** Serving a
  customer in English at their preference is not a breach — the right belongs to the consumer, and
  the customer exercising it in the other direction is their choice. Ana's existing behaviour
  (`agent.ts` LANGUAGE block: follow the caller, switch and stay switched) is the right instinct.
  The one thing to preserve is that **the French option is always offered first and never has to be
  asked for.**
- **A stored language preference is fine and is better service.** `callerLocale()` already does this.
  Still open in French on the first outbound call to a customer whose preference is unknown.
- **Size thresholds do not save you.** Francization-certificate obligations begin at 25 employees
  (lowered from 50 by Bill 96). Renovision AnA is far below that, so the *certification* machinery
  does not apply — but the duty to serve consumers in French applies regardless of headcount.
- **If a call ever leads to a contract**, the French-version-first rule for contracts of adhesion
  applies. Another reason Ana should not be closing anything.

**Enforcement:** complaints go to the OQLF, which investigates, can order compliance, and can pursue
penal proceedings. Fines for legal persons are commonly reported in the **$3,000–$30,000** range per
offence, doubled for a second offence and tripled for subsequent ones, with each day of continuing
violation capable of counting separately. Realistically, an OQLF complaint against a small
contractor over a phone greeting is unlikely — but a customer who is annoyed for some other reason
has a free and easy lever, and "the robot called me in English" is an easy complaint to make.

---

## 10. Requirements checklist

Each line is meant to be implementable as written.

### A. Call eligibility (before dialling)

1. Only dial numbers that exist on a `leads`/`calls` record created by the customer's own contact
   with the business. **No purchased lists, no number generation, no sequential dialling** (UTR
   4(f)).
2. Maintain a hard blocklist of emergency and healthcare numbers; refuse to dial anything on it
   (UTR 4(a)). At minimum block 911 and any number flagged in the CRM as a hospital/clinic.
3. Check an internal do-not-call flag on the customer record. If set, do not dial — ever, for any
   reason, including transactional. (Not strictly required by the CRTC for non-solicitation calls;
   required in spirit by privacy law and by common sense.)
4. Enforce the time window in **the recipient's** local time (America/Toronto for Quebec):
   permitted 09:00–21:30 Mon–Fri, 10:00–18:00 Sat–Sun; **configured default 09:00–20:00 Mon–Fri,
   10:00–17:00 Sat, no Sunday, no statutory holidays.** Reject out-of-window jobs into a queue
   rather than dialling.
5. Rate-limit: no more than one outbound attempt per customer per day, and no more than three
   attempts per booking event.

### B. Caller identity

6. Dial from an **owned Quebec number (450/514/438)** that a human answers or that forwards to the
   business line. Do not display a number that dead-ends (UTR 4(e), and 4(j) requires the contact
   route to remain valid for 60 days).
7. Never spoof or display a number the business does not control.
8. Register the outbound number with carrier reputation services to reduce "Spam Likely" labelling.
   Canadian carriers (Bell/Rogers/Telus) manage caller-name display themselves; a new Twilio number
   inherits whatever reputation its previous owner left. This is operational, not legal, but a
   number labelled as spam makes the whole feature worthless.

### C. Opening script (UTR 4(d) — all of this before anything else)

9. The **first utterance** must contain, in order:
   a. the name **Renovision AnA**;
   b. a brief description of the **purpose** of the call;
   c. a **contact route**: the business phone number **and** an email or postal address;
   d. the statement that the caller is an **automated assistant, not a person**;
   e. the statement that the call is **transcribed**, and why.
10. If the call runs over **60 seconds**, repeat the identification (name + callback number) at the
    end (UTR 4(d)).
11. Open in **French** by default; offer English in the same breath on a first call; use the stored
    preference on subsequent calls but never make the customer ask.

### D. In-call behaviour

12. **Hard prohibition on solicitation.** The system prompt must forbid: quoting or discussing price;
    proposing additional services; mentioning discounts, promotions, or deadlines; asking for a
    decision or a signature; any variation of "would you like to go ahead". Ana confirms, informs,
    and takes messages. Nothing else.
13. Implement this as a **guardrail, not a hope**: (a) prompt instruction, (b) a deny-list check on
    generated text before TTS for price/promo tokens, (c) a post-call review flag on any transcript
    containing them. The existing inbound rule "never quote a price by voice" is the same rule and
    should share the implementation.
14. **Honour a stop request immediately.** If the customer says any variant of *"don't call me with
    this"* / *"ne m'appelez plus"* / *"I don't want to talk to a robot"*, Ana acknowledges, ends the
    call, and the system sets the do-not-call flag. Do not wait 14 days — set it in the same request.
    Keep the entry for at least **3 years and 14 days**.
15. **Offer the human alternative** whenever asked, and proactively if the customer sounds confused
    or distressed. The route is the business line and a callback from Artush.
16. **Never handle an emergency by AI outbound.** Water-damage escalation is a human call.
17. Disconnect within **10 seconds** of the customer hanging up (UTR 4(h)).

### E. Voicemail

18. Answering-machine detection must be handled explicitly. A voicemail left by Ana is a one-way
    synthesized message — the purest form of ADAD call — and **must itself satisfy rule 4(d)**: name,
    purpose, callback number, email, AI disclosure. Do not leave a truncated message.
19. Do not leave sensitive detail on voicemail (no addresses, no scope-of-work descriptions, no
    amounts). "Please call us back about your appointment" is enough.

### F. Consent (strongly recommended, not strictly required for non-solicitation)

20. Add a **separate, unticked** checkbox to the booking and estimator forms:
    *"J'accepte de recevoir des appels automatisés de Renovision AnA à ce numéro pour la gestion de
    mes rendez-vous. / I agree to receive automated calls from Renovision AnA at this number about
    my appointments."*
21. Persist a consent record with: the phone number consented to, the exact wording displayed, the
    timestamp, the channel, and the language. This is the record the CRTC would ask for; it must be
    producible within **30 days** of a request.
22. Store consent withdrawal as its own dated record; never delete the withdrawal.

### G. Privacy and data

23. Set ElevenLabs **audio retention to 0** and transcript retention to no more than the 24 months
    the privacy policy promises — per agent, in Advanced → Data Retention or
    `platform_settings.privacy.retention_days`.
24. **Set `CRON_SECRET`** so `purge_stale_calls()` actually runs. The retention promise is currently
    unkept.
25. Update `PrivacyContent.tsx` to (a) name **ElevenLabs** as the voice/telephony AI provider and
    describe what it processes, (b) correct or remove the Twilio STT claim, (c) describe **outbound**
    calls as a distinct activity with its own purpose, (d) restate that audio is not retained only
    once that is actually configured.
26. Write the **PIA (EFVP)** covering the outside-Quebec transfer and the new system. A few pages:
    what is collected, why, who processes it, where, what protections, what the residual risk is.
27. Execute and file the **ElevenLabs DPA** and Anthropic's terms as the written agreements Law 25
    requires for the transfer.
28. Publish the **privacy officer's** title and contact details (by default: the owner).
29. Write the **governance policy**: retention periods, destruction, who may access transcripts, how
    a complaint or deletion request is handled.
30. Keep the transcript minimisation discipline: no payment details, no health information, no ID
    numbers ever solicited by voice. The existing `redactOwnerPin()` pattern is the right shape for
    any future redaction.

### H. Records and review

31. Log for every outbound call: timestamp, number, local time at recipient, purpose code, consent
    reference, script version, outcome, and whether the identification message played.
32. Keep those records in the ordinary course of business, readily accessible, and be able to produce
    them to the CRTC within **30 days**.
33. Review a sample of transcripts monthly for solicitation drift. Model behaviour changes; a prompt
    that was compliant in August can be chatty in November.
34. Diarise **CRTC 2026-132** — the outcome may add an AI-disclosure requirement and may resolve
    whether AI voices are ADADs. Keep the disclosure line in config so it can be changed in minutes.

---

## 11. Suggested bilingual opening script

Written to satisfy UTR 4(d) identification + purpose + contact, AI disclosure, and the
transcription notice, while still sounding like a person from Laval rather than a legal notice.

### French (default — natural spoken Quebec French)

> **Bonjour, ici Ana, l'assistante virtuelle de Renovision AnA.** Je vous appelle au sujet de votre
> rendez-vous de demain. Je vous le dis tout de suite : **je suis une assistante automatisée, pas une
> personne**, et **l'appel est transcrit** pour qu'on garde une trace de ce qu'on se dit. Vous pouvez
> toujours nous joindre au **579-990-3077** ou à **info@renovisionana.ca**.
> Est-ce que je continue en français, **or would you rather switch to English?**

If the customer's language is already known to be French, drop the last line:

> …Vous pouvez toujours nous joindre au **579-990-3077** ou à **info@renovisionana.ca**.
> Est-ce que c'est un bon moment pour vous?

### English

> **Hello, this is Ana, the virtual assistant at Renovision AnA.** I'm calling about your appointment
> tomorrow. Just so you know up front — **I'm an automated assistant, not a person**, and **this call
> is transcribed** so we have a record of what we agree. You can always reach us at
> **579-990-3077** or **info@renovisionana.ca**.
> Is now a good time?

### Closing identification (use whenever the call runs past 60 seconds)

> *FR:* Merci beaucoup. C'était Ana, pour Renovision AnA — **579-990-3077** si vous avez besoin de
> quoi que ce soit.
>
> *EN:* Thanks very much. That was Ana, for Renovision AnA — **579-990-3077** if you need anything.

### Voicemail (must stand alone as a compliant ADAD message)

> *FR:* Bonjour, ici Ana, l'assistante virtuelle automatisée de Renovision AnA. J'appelle au sujet de
> votre rendez-vous. Rappelez-nous au 579-990-3077, ou écrivez à info@renovisionana.ca. Merci, bonne
> journée.
>
> *EN:* Hello, this is Ana, the automated virtual assistant at Renovision AnA. I'm calling about your
> appointment. Please call us back at 579-990-3077, or email info@renovisionana.ca. Thank you.

### Opt-out acknowledgement

> *FR:* Parfait, je note ça — on ne vous rappellera plus avec l'assistante automatisée. Artush va vous
> parler directement. Bonne journée!
>
> *EN:* Understood — I'll make a note, and we won't call you with the automated assistant again.
> Artush will speak with you directly. Have a good day.

**Note on the name.** `Docs/Voice-ElevenLabs-Setup.md` records that TTS mispronounces the company
name. An outbound call that opens by mangling the business name undermines the identification
requirement in practice even if it satisfies it on paper. Fix the pronunciation before shipping
outbound.

---

## 12. Clearly fine / grey / avoid

### Clearly fine

- Appointment confirmations and reminders for a visit the customer booked.
- "The crew is running late", "we need to reschedule", "the estimator is on the way".
- Asking whether a document arrived, and taking a message.
- Transcribing the call and storing the transcript, **provided** the customer is told at the start,
  the retention limit is real, and the vendors are disclosed.
- Storing and honouring a language preference.
- Calling within the CRTC window, from an owned number, with the rule 4(d) opening.

### Grey — proceed with a specific mitigation

- **Quote follow-ups.** Fine as *"did it arrive, any questions, Artush will call you"*. Not fine as
  *"are you ready to book?"*. Mitigate by capturing express ADAD consent at booking (§4.4) — that
  moves this from grey to fine.
- **Calling a customer whose last job was over 18 months ago.** No EBR, and if any solicitation
  creeps in there is no fallback. Restrict outbound to active/recent jobs.
- **Treating the AI as outside the ADAD definition.** Defensible, untested, currently under review by
  the regulator. Do not rely on it; the cost of compliance is one sentence.
- **Profiling.** Law 25 has a transparency-and-default-off rule for technologies that allow a person
  to be identified, located or profiled. A transcript store is probably not that. A system that
  scores or segments customers from call content probably is. Don't build the second one without
  advice.
- **Sunday and late-evening calls.** Legal within the window; bad for a residential trade.

### Avoid entirely

- **Any selling, upselling, promotion, discount, urgency, or ask-for-the-order by Ana.** This is the
  bright line. Crossing it turns every call into ADAD telemarketing requiring prior express consent,
  and 2014-155 ¶51–52 forecloses the "it was only indirect" defence.
- **Cold calls, prospecting, list-buying, or calling anyone who did not contact the business.**
- **Ana concluding or amending a contract by phone.** Beyond the ADAD problem, it drags in the Quebec
  Consumer Protection Act: soliciting a determined consumer with a view to concluding a contract
  outside the merchant's establishment is itinerant-merchant activity requiring an **OPC permit**
  (the repo's `opcPermit` field is empty), and contracts concluded by phone or at the customer's home
  carry statutory cancellation rights. Ana takes messages; Artush contracts.
- **Ana denying she is an AI, or claiming to be a named employee.** That is where misleading-
  representation law starts to matter.
- **Emergency or distress calls handled by AI outbound.**
- **Leaving detailed job or address information on voicemail.**
- **Shipping outbound before `CRON_SECRET` is set and ElevenLabs audio retention is zeroed.** You
  would be scaling up a retention promise you are not keeping.

---

## 13. Practical risk — what actually happens if you get this wrong

**Who enforces what:**

| Body | Over what | Realistic exposure |
|---|---|---|
| **CRTC** | UTRs / ADAD rules | AMPs under *Telecommunications Act* s. 72.01: **max $1,500 per violation for an individual, $15,000 for a corporation**, and a violation continuing more than one day is a separate violation each day. |
| **CAI** | Law 25 | Administrative monetary penalties up to **$10M or 2% of worldwide turnover**, whichever is greater; penal fines up to **$25M or 4%**. Plus a private right of action with **minimum $1,000 punitive damages** for intentional or grossly negligent infringement. |
| **OQLF** | Charter of the French Language | Penal fines commonly reported at **$3,000–$30,000** for a legal person, doubled/tripled for repeats. |
| **OPC** | PIPEDA (cross-border flows) | No fining power for most breaches; findings, recommendations, and Federal Court referral. Reputational rather than financial. |

**How complaints actually arise.** Not from proactive regulator sweeps. They arise because one
annoyed person files a form. The CRTC has run over 3,500 UTR investigations since 2008; it triages,
does a preliminary assessment, and does not follow up on every complaint. Where it does investigate,
it compels information from the caller and often resolves with a signed undertaking and corrective
measures rather than a maximum penalty. Small first-time operators who cooperate typically land at
the undertaking end.

**Calibration.** The realistic bad day for Renovision AnA is not a $10M CAI penalty. It is:

1. A customer complains to the CRTC after an AI call that tried to sell them something. Investigation,
   correspondence, a few thousand dollars of penalty or an undertaking, and weeks of the owner's
   attention.
2. Carriers label the outbound number "Spam Likely", customers stop answering the business line, and
   the feature quietly destroys the thing it was meant to improve. **This is the most probable
   failure mode and it is not a legal one.**
3. A Law 25 access or deletion request lands and the answer is embarrassing — "we said 24 months but
   the purge never ran; we said no audio but ElevenLabs kept two years of it; we named Twilio but it
   was ElevenLabs." That is the scenario most likely to turn a minor complaint into a real file,
   because it looks like misrepresentation rather than an oversight.

The rank order of what to fix first follows from that: **retention and vendor disclosure (cheap,
currently wrong) > solicitation guardrail (cheap, decisive) > opening script (cheap) > consent
capture (cheap) > everything else.**

---

## 14. Where a lawyer is genuinely needed

Not for the whole thing. Specifically for these:

1. **Whether a conversational AI is an ADAD.** This is a genuine, unresolved question of statutory
   interpretation that the regulator is actively reviewing. If the business ever wants to run
   outbound at volume, or wants to do anything with a commercial edge, get a written opinion from a
   Canadian telecom-regulatory lawyer. If you build to the conservative reading in §10, you do not
   need one to start.
2. **Whether the quote follow-up call is solicitation.** The single highest-value question here.
   Worth an hour of a telecom/marketing lawyer's time, and cheaper than the alternative of guessing.
   (Capturing express consent at booking makes the question moot, which is why it is recommended.)
3. **The Law 25 privacy impact assessment.** A small firm can draft this in-house, but having a
   privacy lawyer review it once — particularly the outside-Quebec transfer conclusion covering
   ElevenLabs and Anthropic — converts it from a document that exists into a document that helps if
   the CAI ever reads it.
4. **Anything involving contracting by phone**, itinerant-merchant permit status, or the RBQ licence
   question that `Docs/Automation-Blockers.md` already flags. That is Quebec consumer/construction
   law and it is not a place to improvise.
5. **Voiceprint identification**, if it is ever proposed. Quebec's biometric regime requires advance
   disclosure to the CAI and is not forgiving.
6. **Before responding to any regulator correspondence.** Not before it arrives.

---

## 15. Sources

**CRTC / telecom**
- CRTC Unsolicited Telecommunications Rules — https://www.crtc.gc.ca/eng/trules-reglest.htm
- Key Unsolicited Telecommunications Rules — https://crtc.gc.ca/eng/phone/telemarketing/tobligations/rules-regles.htm
- Unsolicited Telecommunication Rules: Know Your Obligations — https://crtc.gc.ca/eng/phone/telemarketing/tobligations.htm
- Understand telemarketing rules for compliance — https://crtc.gc.ca/eng/phone/telemarketing/reg.htm
- Compliance and Enforcement Regulatory Policy CRTC 2014-155 (ADAD rules revision; ¶51–53 on indirect solicitation) — https://crtc.gc.ca/eng/archive/2014/2014-155.htm
- Compliance and Enforcement Notice of Consultation CRTC 2026-132 (UTR review; Q2 on AI/synthesized voice, Q10 on disclosing a non-live caller) — https://www.crtc.gc.ca/eng/archive/2026/2026-132.htm
- Compliance and enforcement processes: UTRs — https://crtc.gc.ca/eng/ce/utrpro.htm
- Telecommunications Act — https://laws-lois.justice.gc.ca/eng/acts/t-3.4/
- Telecom Information Bulletin CRTC 2009-283 (existing business relationship, s. 41.7) — https://crtc.gc.ca/eng/archive/2009/2009-283.htm

**Privacy**
- OPC, Recording of Customer Telephone Calls — https://www.priv.gc.ca/en/privacy-topics/surveillance/02_05_d_14/
- Organizations in the Province of Quebec Exemption Order (SOR/2003-374) — https://laws-lois.justice.gc.ca/eng/regulations/SOR-2003-374/page-1.html
- OPC, Provincial laws that may apply instead of PIPEDA — https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/prov-pipeda/
- CAI, Principaux changements apportés par la Loi 25 — https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25
- Joint FPT privacy authorities, Principles for responsible generative AI (Dec 2023) — https://www.priv.gc.ca/fr/nouvelles-du-commissariat/nouvelles-et-annonces/2023/nr-c_231207/

**Quebec consumer / language**
- OPC (Québec), Itinerant sales — check the permit — https://www.opc.gouv.qc.ca/en/consumer/topic/itinerant-sale/tips/check-permit
- OPC (Québec), Commerçants itinérants — lois et règlements — https://www.opc.gouv.qc.ca/commercant/permis-certificat/commercant-itinerant/lois-reglements
- Norton Rose Fulbright, Doing business in Quebec: language legislation — https://www.nortonrosefulbright.com/en/knowledge/publications/38625c3d/doing-business-in-quebec-language-legislation

**Vendors**
- ElevenLabs Agents — Retention — https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention
- ElevenLabs DPA — https://elevenlabs.io/dpa
- Anthropic, API and data retention — https://platform.claude.com/docs/en/manage-claude/api-and-data-retention

---

## 16. Things I could not verify

Stated plainly so nobody builds on them:

- **Exact sub-paragraph lettering of UTR Part IV rule 4.** Consistent across two readings of the
  CRTC page, but the CRTC's own rendering should be checked before external quotation.
- **Section numbers in P-39.1 (Law 25).** The CAI's summary page describes the obligations without
  section numbers, and legisquebec.gouv.qc.ca returned 403 to automated retrieval. The obligations
  described in §8.3 are accurate; **the section numbers are deliberately omitted rather than
  guessed.**
- **Charter of the French Language s. 50.2.** Multiple reputable law-firm summaries attribute the
  consumer's right to be informed and served in French to s. 50.2 as added by Bill 96. Not verified
  against the Charter itself.
- **Quebec Consumer Protection Act ss. 54.1 / 55 / 59** (distance contract, itinerant merchant,
  10-day cancellation). Described from the Office de la protection du consommateur's own guidance
  pages; the statutory text was not retrievable (CanLII and Légis Québec both returned 403).
- **Any Quebec statute imposing calling hours stricter than the CRTC's.** Searched, not found. Absence
  of evidence, not evidence of absence.
- **Reports of a 2026 amendment raising Law 25's administrative penalty cap.** Seen only in a
  low-quality secondary source and not corroborated. The figures in §13 are the well-established
  ones.
- **Whether the CRTC would in fact treat a two-way conversational agent as an ADAD.** No decision
  exists. This is the open question at the centre of the whole analysis.
