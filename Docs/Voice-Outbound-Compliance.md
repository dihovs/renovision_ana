# Outbound AI Voice Calls — Legal & Compliance Analysis (Quebec)

**Scope:** Ana (ElevenLabs voice + Claude) placing *outbound* calls to Renovision AnA's existing
customers for operational reasons: confirming a booked visit, following up on a quote already sent,
warning that a crew is running late.

**Status:** Research, 2026-08-02. Not legal advice — neither the author nor the owner is a lawyer.
This is "what the rules say and what to do about it". Section 14 lists the points where a real
lawyer is worth the money, and section 16 lists everything I could not verify.

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

Two further points that are settled and often assumed to be open:

- **Saying "I'm an AI" is already contractually mandatory.** ElevenLabs' Agents terms require
  customers to tell end users they are interacting with AI rather than a human, and that
  conversations are recorded and may be shared with ElevenLabs and its LLM providers, "immediately
  prior to any interaction". Canadian law does not require this yet; **our platform contract does**,
  and it already applies to the inbound agent today.
- **A link to the privacy policy does not authorise recording an outbound call.** The OPC held
  exactly that in PIPEDA Case #2007-384. The notice has to be spoken, at the start, every time.

**Recommended posture:** build it as a non-solicitation caller *and* capture express ADAD consent at
booking anyway. Consent costs one sentence on the booking form, removes the hardest risk
(the "was that follow-up call solicitation?" argument) entirely, and lets the spoken opening drop
from ~15 seconds to ~7. The CRTC itself points businesses to this route.

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

**No binding Canadian law requires it today — but ElevenLabs' own terms do, which settles the
question for this project.** See §7.3.

On the law:

- **CRTC:** no current requirement. The strongest proof is that the Commission is *asking* whether
  there should be one. CRTC 2026-132 **Question 10**: *"Should the identification requirements be
  expanded to require telemarketers to tell consumers that the call is using this sort of technology
  (i.e., it is not a live person making the call and speaking with the consumer at the start of the
  call)?"* Open, no answer yet.
  Note the shape of the existing rules: Canada already requires **who** and **why** at the start of
  an ADAD call. It does not yet require **what** — human or machine.
- **Federal AI legislation:** AIDA (Part 3 of Bill C-27) **died on the Order Paper when Parliament
  was prorogued in January 2025 and has not been reintroduced.** Even on its own terms it never
  contained a general "announce you are an AI on a call" duty. Discount any claim that a federal AI
  statute imposes disclosure duties today.
- **But two federal proceedings are open right now.** Besides CRTC 2026-132, ISED launched a
  **public consultation on AI transparency running 23 July – 23 September 2026**, centred among
  other things on "helping individuals know when they are interacting with an AI system". Canada has
  two live processes asking exactly this question. A rule is plausible within a year or two.
- **Law 25, s. 12.1:** requires notice where a decision is made *exclusively* by automated
  processing. Confirming an appointment is not a decision about the person. And note what s. 12.1
  would require even if it applied: disclosure that **the decision** was automated, not that **the
  voice** is synthetic. Sources citing s. 12.1 as an "AI chatbot disclosure rule" are overreading
  it. (See §8.5 for where the boundary actually flips.)
- **Misleading-representation law** is the real backstop. *Competition Act* s. 52 (criminal) and
  s. 74.01(1)(a) (civil reviewable conduct), judged on the **general impression** test. Failing to
  volunteer that you are a machine on an appointment-confirmation call is very unlikely to be
  actionable. **Affirmatively claiming to be a human when asked is a materially different and much
  riskier posture.** Quebec's CPA has general false-representation prohibitions but no AI-specific
  provision.

### 7.2 What best practice and comparative law say

Canada's federal, provincial and territorial privacy authorities — **the CAI among them** — endorsed
joint *Principles for responsible, trustworthy and privacy-protective generative AI technologies*
(7 December 2023), which include transparency about AI use and, as a good practice, labelling
AI-generated content.

Comparative, and worth getting right because these are widely miscited:

- **EU AI Act, Article 50(1)** requires that people be "informed that they are interacting with an AI
  system, **unless this is obvious** from the point of view of a reasonably well-informed, observant
  and circumspect person". Art. 50(5) requires the disclosure "at the latest at the time of the
  first interaction". **Applicable from 2 August 2026** — live now in the EU. Two features worth
  copying: disclosure at first interaction, and an "unless obvious" proportionality valve.
- **US FCC, Declaratory Ruling of 8 February 2024** held that AI-generated voices are "artificial or
  prerecorded voice" under the TCPA, which makes such calls **consent-gated**. **It did not create an
  "I am an AI" disclosure duty** — that was only *proposed* in a later NPRM which has not been
  finalized. This is frequently misreported.
- **California's bot law (SB 1001) does NOT apply to phone calls.** It is expressly limited to
  communications "online", defined as appearing on a public-facing website or application. It is
  routinely miscited as covering AI voice calls. It does not.
- **Utah's AI Policy Act**, as narrowed in 2025, requires proactive outset disclosure only for
  "high-risk" interactions (health, financial, biometric data, or financial/legal/healthcare
  advice). A renovation appointment call would not qualify — useful calibration for what a
  proportionate rule looks like.

### 7.3 The decisive point: ElevenLabs already requires it contractually

This is not a judgment call. ElevenLabs' Agents disclosure requirement states that customers are
**required** to give clear notice to end users that:

> "They are interacting with AI rather than a human [and] their conversations are being recorded and
> may be shared with ElevenLabs and its third-party large language model providers."

and that the disclosure "**must be presented immediately prior to any interaction**", with "a verbal
or pre-recorded disclosure at the start of a voice call" listed as an accepted method. ElevenLabs
publishes a sample script along these lines:

> "Hi, I'm an AI assistant. This call may be recorded and shared with service providers for quality
> assurance and service improvement purposes. For more information, please refer to our privacy
> policy available at: [link]."

**Ana runs on ElevenLabs Agents. The AI disclosure is therefore already a contractual obligation,
independent of Canadian law, and it already applies to the inbound agent today.**

Note the useful overlap: the "shared with ElevenLabs and its third-party LLM providers" element that
ElevenLabs requires is close to what Law 25 s. 8 requires anyway (third parties + possibility of
communication outside Québec). One sentence discharges both.

### 7.4 Recommendation

**Disclose, unprompted, in the first turn, in plain language, and say it the way a person would.**
It is contractually required, it is what the inbound agent already gestures at, it will probably be
legally required within a year or two, and it costs about four seconds.

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

### 8.5 Automated decisions — s. 12.1, and where the boundary actually is

s. 12.1 applies to "a decision based **exclusively** on an automated processing" of personal
information. Confirming a time slot the customer already agreed to is executing a decision, not
rendering one. **Outbound appointment calls almost certainly do not trigger it.**

But the margin is thinner than people assume, because — unlike GDPR art. 22 — **s. 12.1 has no
adverse-effect threshold in its text.** The only filters are "decision" and "exclusively". It would
flip if:

- Ana **declines, reschedules or reprioritizes** a customer based on their data (past cancellations,
  payment history, postal code);
- Ana **scores or triages** a lead and that score determines whether a human ever calls back;
- Ana **quotes or refuses a price** algorithmically.

A human "review" that is a rubber stamp does not defeat "exclusively"; meaningful human judgment
does. Today's design — a person reviews every call — is on the right side of the line, and the
prompt rule "never quote a price by voice" is doing double duty here.

**Relevant beyond outbound:** if the website estimator ever communicates a range to a customer with
no human in the loop, treat s. 12.1 as engaged and build the notice plus the "submit observations to
a person who can review it" path. `PrivacyContent.tsx` currently asserts "no decision that affects
you is made automatically" — that claim has to stay true, or the s. 12.1 machinery has to be built.

### 8.6 Biometrics — not engaged as designed, but know where the line is

Quebec's biometric regime lives in the *Act to establish a legal framework for information
technology* (CQLR c. C-1.1):

- **s. 44** — identity may not be verified or confirmed by a process using biometric characteristics
  except where **previously disclosed to the CAI** and with the **express consent** of the person.
- **s. 45** — "The creation of a database of biometric characteristics and measurements must be
  disclosed to the Commission d'accès à l'information promptly and **not later than 60 days before
  it is brought into service**." The CAI may suspend, prohibit, or order destruction.

The CAI defines biometrics purposively — techniques analysing unique characteristics "**afin de
déterminer ou de prouver son identité**" — and its guide expressly notes that using such
characteristics for purposes *other than* verifying identity is not covered by the biometrics
principles (though P-39.1 still applies in full).

**Conclusion: recording audio, synthesizing a voice and transcribing speech does not engage s. 44 or
s. 45.** The CAI does list *l'empreinte de la voix* — a voice**print** — under behavioural
biometrics, but a voiceprint is an extracted, stored template used to match a person. We create
none. **No CAI declaration is required as designed.**

**Where it flips — the line to hold:**

- Enabling **speaker verification / voice ID / "recognize the returning caller by voice"** → s. 44:
  prior disclosure to the CAI, express consent, and a non-biometric fallback for anyone who refuses.
- **Storing voice embeddings or templates across calls** so the same speaker can be re-matched →
  s. 45: a *banque de caractéristiques biométriques*, with the **60-day pre-service declaration**.
- **Emotion or sentiment analysis from voice** is outside the biometrics guide, but the CAI names it
  as something it is watching. P-39.1 applies in full.

Related: P-39.1 **s. 12** treats information as **sensitive** where its nature (medical, biometric,
otherwise intimate) *or* **the context of its use** entails a high reasonable expectation of privacy.
An appointment confirmation is not sensitive. A transcript in which a customer discusses their
finances, their family situation, or flood damage to their home can become sensitive through the
context limb — and sensitive information requires **express** consent under ss. 12 and 13. Another
argument for short retention and for keeping Ana off topics she has no business on.

---

## 9. French language (Charter of the French Language / Bill 96)

### 9.1 There is no telephone rule — and the duty still applies

**The Charter contains no phone-specific provision.** A full-text scan of the official consolidated
Charter (C-11) for "oral", "verbal", "telephone" and "spoken" returns hits only in the chapters on
the civil administration and on associations of workers. **Chapter VII of Title I — "The language of
commerce and business", ss. 50.1–71 — contains none.** That chapter is about product inscriptions,
catalogues, websites, contracts, invoices, order forms and signage.

Commentary that says "Bill 96 requires you to answer the phone in French" reaches the right outcome
by the wrong route. The duty comes from the **general, medium-neutral rights in Chapter II**:

- **s. 2:** "Every person has a right to have … **all enterprises doing business in Québec
  communicate with him in French**."
- **s. 5:** "Consumers of goods and services have a right to be informed and served in French."
- **s. 50.2** (added by Bill 96, in force 1 June 2022): "An enterprise that offers goods or services
  to consumers **must respect their right to be informed and served in French.** An enterprise that
  offers goods or services to a public other than consumers must inform and serve it in French."

An outbound call is squarely "communicating with" the person under s. 2 and "informing" a consumer
under s. 5/50.2. Nothing conditions the duty on the consumer having called first. The OQLF's own
consumer-facing guidance extends the right to customer service by phone and to **accessing a voice
messaging system in French**.

### 9.2 Practical consequences for outbound

- **Open in French. Always.** French is the default, not one of two equal options. Do not open
  English-first, and do not treat the language choice as a coin flip.
- **Switch to English once the customer signals that preference.** There is **no express provision**
  in the Charter authorising a private enterprise to serve a consumer in another language on
  request — a real drafting gap, made conspicuous by the fact that s. 49 grants exactly that
  permission to associations of workers. It is nonetheless lawful in practice, on three structural
  grounds: ss. 2 and 5 create a **right held by the person**, not a duty of exclusivity (contrast
  s. 50.2 ¶1's "must respect *their right*" with ¶2's unconditional "must inform and serve it in
  French" for non-consumers); s. 204.17 gives the remedy to the *victim* of a violation, and a
  customer who asked for English is not one; and s. 55 itself contemplates the adhering party
  expressly choosing another language.
- **A stored language preference is fine and is better service.** `callerLocale()` already does
  this. Still open in French on the first outbound call to a customer whose preference is unknown.
- **Size does not save you.** Francization registration begins at **25 employees for six months**
  (s. 139, lowered from 50 by Bill 96 effective 1 June 2025). Renovision AnA is far below that, so
  none of the registration/committee/certificate machinery applies. **ss. 2, 5, 50.2 and 55 apply at
  any size, including one employee.**
  There is a small-business carve-out — **s. 204.17 ¶2** removes the cessation remedy for a
  violation of **s. 5** by an enterprise with **fewer than five persons**. Read it carefully: it
  covers s. 5 only. It does **not** cover **s. 2**, which is the provision most naturally engaged by
  a call the business initiates. The carve-out is narrower than it looks.
- **If a call ever leads to a contract, s. 55 engages.** Contracts "pre-determined by one party and
  the related documents must be drawn up in French"; the parties may be bound by another-language
  version only "**after its French version has been remitted to the adhering party**". A renovation
  quote or contract on a standard template is almost certainly a contract of adhesion. Note you
  cannot cure this afterwards — the French version must come first. **s. 204.21** lets the adhering
  party seek nullity **without proving injury**. A phone call in English that ends "I'll send you
  the contract" is not a s. 55 problem; sending an English-only standard contract is.

### 9.3 Enforcement — and a correction most commentary gets wrong

**Contravening s. 50.2 or s. 55 is not, by itself, a penal offence.** s. 205 — the fine provision —
is a **closed list**: it applies to contraventions of ss. 78.1–78.3 and 176, or of **an order issued
by the Office under s. 177**. Neither s. 50.2 nor s. 55 is on that list.

The actual path is: **complaint → inspection (s. 166) → the OQLF orders compliance (s. 177) →
disobeying that order is the offence.** So the first consequence of a French-service complaint
against a good-faith small business is a corrective order, not a fine. That materially lowers the
realistic risk here.

Where fines do apply (s. 205): **$700–$7,000 for a natural person, $3,000–$30,000 in all other
cases.** Doubled for a second offence and tripled for subsequent ones (s. 207); doubled again for a
**director or officer** (s. 208); each day of continuance is a separate offence (s. 208.0.1); and
directors are **presumed** to have committed an offence committed by the legal person unless they
establish due diligence (s. 208.4.2).

**The sleeper risk for a licensed trade — s. 204.28.** The Minister may, on the OQLF's opinion,
**suspend or revoke a permit or other authorization of the same nature** where an enterprise
"repeatedly contravenes" the Act despite a s. 177 order. For a renovation contractor that reaches an
**RBQ licence**. Repeat-offender territory only, but it is the highest-stakes sanction in the Act
for this business, and it is worth knowing it exists.

**Private remedies created by Bill 96:** cessation (s. 204.17), nullity of an injurious provision
(s. 204.18), reduction of the obligation instead of nullity (s. 204.20), and a saving clause
preserving ordinary Civil Code recourse (s. 204.16). **Bill 96 did not create a damages or punitive-
damages right of action under the Charter** — a claim repeated in several law-firm and vendor
summaries. Damages would have to be pleaded under CCQ art. 1457.

**Calibration.** An OQLF complaint against a small contractor over a phone greeting is unlikely. But
it is free to file, and "the robot called me in English" is an easy complaint for a customer who is
already annoyed about something else. Opening in French costs nothing and removes the lever.

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
   d. the statement that the caller is an **automated assistant, not a person** — contractually
      required by ElevenLabs' Agents terms, not merely advisable;
   e. the statement that the call is **transcribed**, and why;
   f. **where consent was not captured in writing at booking**: that processing involves service
      providers **some of which are outside Québec** (Law 25 s. 8 ¶2), and that the customer may
      **stop at any time** (s. 8(4)).
10. Nothing substantive may be collected before that disclosure completes. A link to the privacy
    policy is **not** a substitute — PIPEDA Case #2007-384 held a published policy insufficient for
    outbound recording consent.
11. If the call runs over **60 seconds**, repeat the identification (name + callback number) at the
    end (UTR 4(d)).
12. Open in **French** by default. Never open English-first. Offer English in the same breath on a
    first call; use the stored preference on subsequent calls but never make the customer ask.
13. Version the script. Log which version played on each call, so a later complaint can be answered
    with what was actually said.

### D. In-call behaviour

14. **Hard prohibition on solicitation.** The system prompt must forbid: quoting or discussing price;
    proposing additional services; mentioning discounts, promotions, or deadlines; asking for a
    decision or a signature; any variation of "would you like to go ahead". Ana confirms, informs,
    and takes messages. Nothing else.
15. Implement this as a **guardrail, not a hope**: (a) prompt instruction, (b) a deny-list check on
    generated text before TTS for price/promo tokens, (c) a post-call review flag on any transcript
    containing them. The existing inbound rule "never quote a price by voice" is the same rule and
    should share the implementation.
16. **Never claim to be human.** If asked "am I talking to a person?", the answer is always no. This
    is the one place where a wrong answer moves the exposure from telecom regulation to
    misleading-representation law (*Competition Act* ss. 52 / 74.01(1)(a)).
17. **Honour a stop request immediately.** If the customer says any variant of *"don't call me with
    this"* / *"ne m'appelez plus"* / *"I don't want to talk to a robot"*, Ana acknowledges, ends the
    call, and the system sets the do-not-call flag. Do not wait 14 days — set it in the same request.
    Keep the entry for at least **3 years and 14 days**. Under Law 25 s. 14 (*libre*), stopping must
    be **as easy as agreeing** — one plain sentence, no menu, no verification step.
18. **Offer the human alternative** whenever asked, and proactively if the customer sounds confused
    or distressed. The route is the business line and a callback from Artush. The OPC guidance
    requires an alternative channel for customers who object to recording; this is it.
19. **Never handle an emergency by AI outbound.** Water-damage escalation is a human call.
20. Disconnect within **10 seconds** of the customer hanging up (UTR 4(h)).

### E. Voicemail

21. Answering-machine detection must be handled explicitly. A voicemail left by Ana is a one-way
    synthesized message — the purest form of ADAD call — and **must itself satisfy rule 4(d)**: name,
    purpose, callback number, email, AI disclosure. Do not leave a truncated message.
22. The voicemail greeting path must work **in French** (OQLF guidance extends the right to French
    service to voice messaging systems).
23. Do not leave sensitive detail on voicemail (no addresses, no scope-of-work descriptions, no
    amounts). "Please call us back about your appointment" is enough.

### F. Consent (strongly recommended, not strictly required for non-solicitation)

24. Add a **separate, unticked** checkbox to the booking and estimator forms. Law 25 s. 14 requires
    per-purpose granularity, so this is **not** one blanket line — separate the automated call from
    the recording/transcription from any secondary use:
    *"J'accepte de recevoir des appels automatisés de Renovision AnA à ce numéro pour la gestion de
    mes rendez-vous. / I agree to receive automated calls from Renovision AnA at this number about
    my appointments."*
25. Alongside the checkbox, present the **s. 8** information in writing: purposes, that the means is
    an automated voice system, access/rectification rights, the right to withdraw, the third parties
    involved, and that information may be processed outside Québec. Doing it here is what unlocks
    the short Tier 2 call opening.
26. Persist a consent record with: the phone number consented to, the exact wording displayed, the
    timestamp, the channel, and the language. This is the record the CRTC would ask for; it must be
    producible within **30 days** of a request. The CAI guidelines likewise expect organizations to
    document the consent and the elements supporting its validity.
27. Store consent withdrawal as its own dated record; never delete the withdrawal.

### G. Privacy and data

28. Set ElevenLabs **audio retention to 0** and transcript retention to no more than the 24 months
    the privacy policy promises — per agent, in Advanced → Data Retention or
    `platform_settings.privacy.retention_days`. Default is **2 years for both audio and
    transcripts**; deleting audio after transcription is the single cheapest compliance win
    available.
29. **Set `CRON_SECRET`** so `purge_stale_calls()` actually runs. The retention promise is currently
    unkept, and s. 23 makes failure to destroy an enumerated AMP ground.
30. Update `PrivacyContent.tsx` to (a) name **ElevenLabs** as the voice/telephony AI provider and
    describe what it processes, (b) correct or remove the Twilio STT claim, (c) describe **outbound**
    calls as a distinct activity with its own purpose, (d) restate that audio is not retained only
    once that is actually configured.
31. Write the **ÉFVP** covering both triggers — s. 3.3 (new information system) and s. 17
    (communication/entrustment outside Québec). One document can cover both. A few pages: what is
    collected, why, who processes it, where, what contractual protections apply, what the residual
    risk is, and the explicit conclusion that protection is adequate. **There is no mandatory form
    and no obligation to file it with the CAI** — but you must be able to produce it.
32. Execute and file the **ElevenLabs DPA** and Anthropic's terms. Check each against the **s. 18.3**
    clause list: written mandate; confidentiality measures; **use only for carrying out the
    mandate** (this is where "no training on our data" lives); **no retention after the contract
    ends**; **breach notification without delay** to the named person in charge; and a
    **verification right**. Confirm the zero-retention / no-training options are actually switched
    on rather than assumed.
33. **Minimise what crosses the border.** Audio must go to the voice vendor; the transcript need not
    go anywhere else unredacted. Stripping names, addresses and phone numbers before sending text to
    an LLM materially strengthens the s. 17 adequacy analysis, because s. 17(1)–(2) weigh sensitivity
    and purpose.
34. Publish the **person in charge**'s title and contact details (s. 3.1 — by default the owner,
    automatically, unless delegated in writing).
35. Publish **two separate things**: the s. 8.2 confidentiality policy and the s. 3.2 governance
    policies summary (retention and destruction rules, personnel roles across the information life
    cycle, complaints process). They are commonly conflated; they are distinct obligations.
36. Start a **confidentiality incident register** (s. 3.8) from day one, covering *all* incidents,
    not just notifiable ones. Retain it **at least 5 years**. Write a one-page runbook for the
    "risk of serious injury" notification threshold in ss. 3.5–3.7.
37. Keep the transcript minimisation discipline: no payment details, no health information, no ID
    numbers ever solicited by voice. The existing `redactOwnerPin()` pattern is the right shape for
    any future redaction.
38. **Do not enable voice ID or speaker templates** without a CAI declaration filed **60 days**
    ahead, express consent, and a non-biometric fallback (C-1.1 ss. 44–45).

### H. Records and review

39. Log for every outbound call: timestamp, number, local time at recipient, purpose code, consent
    reference, script version, outcome, and whether the identification message played.
40. Keep those records in the ordinary course of business, readily accessible, and be able to produce
    them to the CRTC within **30 days**.
41. Review a sample of transcripts monthly for solicitation drift. Model behaviour changes; a prompt
    that was compliant in August can be chatty in November.
42. Diarise **CRTC 2026-132** (replies closed 11 August 2026) and the **ISED AI-transparency
    consultation** (closed 23 September 2026). Either may add an AI-disclosure requirement; CRTC
    2026-132 may resolve whether AI voices are ADADs. Keep the disclosure line in config so it can
    be changed in minutes.

---

## 11. Suggested bilingual opening script

Five separate obligations converge on the first ten seconds of the call:

| Element | Required by |
|---|---|
| Business name | UTR 4(d) |
| Brief purpose of the call | UTR 4(d) |
| Callback number **and** an email or postal address | UTR 4(d), 4(j) |
| "I'm an AI, not a person" | ElevenLabs Agents terms (contractual) |
| Call is recorded/transcribed, and why | PIPEDA (OPC guidance + Case #2007-384), Law 25 s. 8(1)–(2) |
| Third parties / possibility of processing outside Québec | Law 25 s. 8 ¶2; ElevenLabs terms |
| Right to withdraw / stop | Law 25 s. 8(4) |
| French first | Charter ss. 2, 5, 50.2 |

That is a lot for a "your guy comes at nine" call. **Two tiers solve it**, and this is the strongest
practical argument for capturing consent at booking:

- **Tier 1 — first outbound call, or no consent on file.** Full disclosure, below. About 15 seconds.
- **Tier 2 — consent captured at booking**, where the s. 8 information was given in writing on the
  form. Short version: identification, purpose, AI, transcription, callback. About 7 seconds.

### Tier 1 — French (default; natural spoken Quebec French)

> **Bonjour, ici Ana, l'assistante virtuelle de Renovision AnA.** Je vous appelle au sujet de votre
> rendez-vous de demain matin. Je vous le dis tout de suite : **je suis une assistante automatisée,
> pas une vraie personne.** **L'appel est transcrit** pour qu'on garde une trace de ce qu'on se dit,
> et la transcription passe par nos fournisseurs, **dont certains sont à l'extérieur du Québec**.
> **Vous pouvez me dire d'arrêter n'importe quand**, et tous les détails sont sur
> renovisionana.ca. Pour nous joindre : **579-990-3077**, ou **info@renovisionana.ca**.
> Je continue en français, **or would you rather switch to English?**

### Tier 1 — English

> **Hello, this is Ana, the virtual assistant at Renovision AnA.** I'm calling about your appointment
> tomorrow morning. Just so you know up front — **I'm an automated assistant, not a real person.**
> **This call is transcribed** so we have a record of what we agree, and the transcription goes
> through our service providers, **some of them outside Quebec**. **You can tell me to stop at any
> time**, and the full details are on renovisionana.ca. To reach us: **579-990-3077**, or
> **info@renovisionana.ca**.
> Is now a good time?

### Tier 2 — short version (consent already captured at booking)

> *FR:* **Bonjour, ici Ana, l'assistante automatisée de Renovision AnA.** Je vous appelle pour
> confirmer votre rendez-vous de demain. **L'appel est transcrit**, comme convenu. Si vous avez
> besoin de nous : **579-990-3077**. Est-ce que ça tient toujours pour demain?
>
> *EN:* **Hello, this is Ana, the automated assistant at Renovision AnA.** I'm calling to confirm
> your appointment tomorrow. **This call is transcribed**, as agreed. If you need us:
> **579-990-3077**. Is tomorrow still good for you?

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
| **CRTC** | UTRs / ADAD rules | AMPs under *Telecommunications Act* s. 72.01: **max $1,500 per violation for an individual, $15,000 for a corporation**, and a violation continuing more than one day is a separate violation each day. (The $10M figure people quote is s. 72.001, which covers other contraventions of the Act — not the UTRs.) |
| **CAI** | Law 25 (P-39.1) | Administrative monetary penalty, s. 90.12: **$50,000** for a natural person; otherwise **$10,000,000 or 2% of worldwide turnover, whichever is greater**. Penal fine, s. 91: **$5,000–$100,000** / **$15,000–$25,000,000 or 4% of worldwide turnover, whichever is greater**; doubled for a subsequent offence (s. 92.1); 5-year limitation (s. 92.2). AMP grounds in s. 90.1 that map onto this project include failure to inform under ss. 7–8, unlawful collection/keeping/**destruction**, failure to report an incident, failure to take s. 10 security measures, and breach of s. 12.1. An **undertaking** with the CAI bars an AMP for the covered acts. |
| **Civil courts** | Law 25, s. 93.1 | Where an infringement is **intentional or results from a gross fault**, the court **shall** award punitive damages of **not less than $1,000** — per person, on top of compensatory damages. This minimum is the engine of class actions, and for a small business it is the realistic exposure, not the $10M ceiling. |
| **OQLF** | Charter of the French Language | **Not a direct fine.** s. 205 is a closed list; breaching s. 50.2 or s. 55 is not itself an offence. Path is complaint → inspection → **s. 177 order** → disobeying the order is the offence, at **$3,000–$30,000** for a legal person, doubled/tripled for repeats, doubled again for a director (s. 208), each day separate (s. 208.0.1). Repeat contraventions can support **suspension or revocation of a permit — including an RBQ licence — under s. 204.28**. |
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
- OPC, PIPEDA Case Summary #2007-384 (privacy policy insufficient for outbound call recording) — https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2007/pipeda-2007-384/
- Organizations in the Province of Quebec Exemption Order (SOR/2003-374) — https://laws-lois.justice.gc.ca/eng/regulations/SOR-2003-374/page-1.html
- OPC, Provincial laws that may apply instead of PIPEDA — https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/prov-pipeda/
- Act respecting the protection of personal information in the private sector (P-39.1), official consolidation — https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1
- CAI, Principaux changements apportés par la Loi 25 — https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25
- CAI, Lignes directrices 2023-1 — Consentement : critères de validité — https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_Criteres_Validite_Consentement.pdf
- CAI, Guide — Réaliser une évaluation des facteurs relatifs à la vie privée (ÉFVP) — https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_GU_EFVP.pdf
- CAI, Biométrie : principes à respecter et obligations légales des organisations — https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_GU_Biometrie_Organisations.pdf
- Règlement sur les incidents de confidentialité (CQLR c A-2.1, r. 3.1) — https://www.legisquebec.gouv.qc.ca/fr/document/rc/A-2.1,%20r.%203.1
- Act to establish a legal framework for information technology (C-1.1), ss. 44–45 — https://www.legisquebec.gouv.qc.ca/en/document/cs/C-1.1
- Criminal Code s. 184 — https://laws-lois.justice.gc.ca/eng/acts/c-46/section-184.html
- Civil Code of Québec, arts. 35–37 — https://www.legisquebec.gouv.qc.ca/en/document/cs/CCQ-1991
- Joint FPT privacy authorities, Principles for responsible generative AI (Dec 2023) — https://www.priv.gc.ca/fr/nouvelles-du-commissariat/nouvelles-et-annonces/2023/nr-c_231207/

**Quebec consumer / language**
- Charter of the French Language (C-11), official consolidation — https://www.legisquebec.gouv.qc.ca/en/document/cs/C-11
- OQLF, Langue du commerce et des affaires — droits des consommateurs — https://www.oqlf.gouv.qc.ca/francisation/droits_linguistiques/droits/langue-du-commerce-et-des-affaires.html
- OQLF, Traitement des plaintes et dénonciations — https://www.oqlf.gouv.qc.ca/francisation/respect/traitement-des-plaintes-et-denonciations.html
- OPC (Québec), Itinerant sales — check the permit — https://www.opc.gouv.qc.ca/en/consumer/topic/itinerant-sale/tips/check-permit
- OPC (Québec), Commerçants itinérants — lois et règlements — https://www.opc.gouv.qc.ca/commercant/permis-certificat/commercant-itinerant/lois-reglements
- Norton Rose Fulbright, Doing business in Quebec: language legislation — https://www.nortonrosefulbright.com/en/knowledge/publications/38625c3d/doing-business-in-quebec-language-legislation

**AI disclosure**
- ISED, Public consultation on AI transparency (23 July – 23 Sept 2026) — https://www.canada.ca/en/innovation-science-economic-development/news/2026/07/government-of-canada-launches-public-consultation-on-ai-transparency.html
- ISED, AI for All — Canada's National AI Strategy (4 June 2026) — https://ised-isde.canada.ca/site/ised/en/canadas-national-artificial-intelligence-strategy-ai-all
- EU AI Act, Article 50 — https://artificialintelligenceact.eu/article/50/
- FCC Declaratory Ruling FCC 24-17 (8 Feb 2024), AI voices under the TCPA — https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf
- California SB 1001 (B.O.T. Act — "online" only, not phone calls) — https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=201720180SB1001
- Competition Act s. 52 — https://laws-lois.justice.gc.ca/eng/acts/C-34/section-52.html

**Vendors**
- **ElevenLabs Agents — Disclosure requirement (contractually binding on us)** — https://elevenlabs.io/docs/eleven-agents/legal/disclosure-requirement
- ElevenLabs Agents — Retention — https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention
- ElevenLabs DPA — https://elevenlabs.io/dpa
- Anthropic, API and data retention — https://platform.claude.com/docs/en/manage-claude/api-and-data-retention

---

## 16. Things I could not verify

Stated plainly so nobody builds on them.

**Verified against official consolidated statutory text** (LégisQuébec, "à jour au 1er avril 2026",
marked *Ce document a valeur officielle*; laws-lois.justice.gc.ca for federal): every P-39.1 section
number in §8.3–8.6, every Charter of the French Language section number in §9, *Criminal Code*
s. 184 and s. 193, CCQ arts. 35–37, and C-1.1 ss. 44–45. Those are safe to rely on.

**Not verified:**

- **Exact sub-paragraph lettering of UTR Part IV rule 4.** Consistent across multiple readings of
  the CRTC page, but check the CRTC's own rendering before quoting it externally.
- **Whether the CRTC would treat a two-way conversational agent as an ADAD.** No decision exists.
  This is the open question at the centre of the whole analysis, and it is Question 2 in CRTC
  2026-132.
- **Quebec Consumer Protection Act ss. 54.1 / 55 / 59** (distance contract, itinerant merchant,
  10-day cancellation). Described from the Office de la protection du consommateur's own guidance
  pages; the statutory text was not retrievable (CanLII and LégisQuébec both 403 automated fetches
  of the CPA).
- **Any Quebec statute imposing calling hours stricter than the CRTC's.** Searched, not found.
  Absence of evidence, not evidence of absence.
- **Reports of a 2026 amendment raising Law 25's administrative penalty cap.** Seen only in a
  low-quality secondary source and not corroborated. The figures in §13 come from the official
  text of ss. 90.12 and 91.
- **The claim that a business "must have at least one employee at all times capable of providing
  service in French".** Widely repeated in secondary summaries (including CFIB's). **No such wording
  was found in the Charter.** Treat it as a paraphrase of the s. 50.2 duty, not a distinct rule.
- **A general OQLF power to seek Superior Court injunctions.** Asserted by at least one major firm's
  guide; the victim's cessation right (s. 204.17) and the Government's contract-resiliation power
  (s. 204.19) were located, but no general OQLF injunction power was confirmed.
- **Any OQLF directive prescribing a specific telephone greeting script** or banning "Bonjour-Hi"
  for private businesses. Not found. The s. 5 / s. 50.2 duty is verified and is sufficient on its
  own; do not cite a greeting rule that may not exist.
- **The current text of ElevenLabs' and Anthropic's DPAs against the s. 18.3 clause list.** The
  ElevenLabs disclosure requirement and retention documentation were read directly; the DPAs
  themselves were not clause-checked. Do that before relying on them for the s. 17 adequacy
  conclusion.
- **Colorado's SB 26-189** (referenced in comparative material). Secondary-sourced only; not read.
- **Any CAI guidance specifically on call recording.** Searched; none found. The CAI has issued
  guidelines on consent, biometrics and ÉFVP but nothing call-recording-specific. The OPC's 2018
  document is the only regulator guidance directly on point, and while PIPEDA-based it maps cleanly
  onto P-39.1.
- **Any CAI decision applying Law 25 to an AI voice agent.** None found. This is untested territory
  in Quebec.

---

## 17. Addendum, 2026-08-03 — introductory calls to businesses

Added when the introductory-call feature was built. The original document scoped itself to calls to
**existing customers** for operational reasons, and said so in its first paragraph. An introduction
to a contractor, property manager or insurer is neither of those things, so nothing above answers
it directly. This section does.

### 17.1 The question

Does business-to-business change the analysis? A partner is not a consumer at home; the number is a
switchboard, not a kitchen phone. It is a reasonable thing to hope.

### 17.2 The answer: no, and only one of the three rule-sets falls away

The CRTC's own guidance page for businesses is explicit on both halves:

> "Business to Business calls are exempt from Part II: the National DNCL Rules under the UTRs."

and, immediately:

> "calls to business numbers are only regulated under Part III and Part IV of the UTRs, namely the
> Telemarketing Rules and the ADAD Rules."

Part IV is the ADAD rules. Part IV rule 2 is the one that requires express consent for a
telemarketing ADAD call, and §4.3 above establishes that an introduction is solicitation — 2014-155
¶51–53 declined to draw a line between calls that are mostly promotional and calls that are only a
bit promotional, and invited businesses to go and ask for consent instead.

**So the B2B exemption removes the DNCL scrub and leaves the consent requirement exactly where it
was.** It is the cheapest of the three obligations to lose.

Two further points from the same page:

- **Registration is still required.** "Even if you only make exempt calls or send exempt faxes, you
  must still register." Registration with the National DNCL operator is separate from buying a
  subscription; if every call is exempt the subscription is not needed, the registration is.
  **This is not done, and it is an owner action — see Owner-Decisions-Needed.md.**
- **A business can put its own number on the National DNCL.** So "it is a business number" is not
  even a reliable proxy for "not on the list".

### 17.3 What was built

- `supabase/migrations/0021_outbound_consent.sql` — `outbound_consents`, number-scoped, storing the
  verbatim wording agreed to, the channel, the evidence, who recorded it, and withdrawal. Also
  `do_not_call_list`, number-keyed, which is the internal list §5 requires and which the
  `clients.do_not_call` boolean could never hold, because a partner who asks us to stop is usually
  not a client row at all. Also widens the `call_tasks.kind` constraint to admit `business_intro`,
  with a unique index limiting it to one introduction per number ever.
- `src/lib/crm/adadConsent.ts` — the rule, pure and tested. `requiresExpressConsent(kind)` is the
  single place that says which kinds are solicitation.
- `src/lib/crm/consentStore.ts` — the reads and writes. **This module fails closed**: if the consent
  tables are missing or the database does not answer, the verdict is a refusal, not a pass. Every
  other module in this codebase degrades the other way, and the asymmetry is deliberate — elsewhere
  the cost of a missing table is a feature that does not work, here it is an unlawful call.
- The gate is applied three times, at three different moments, because consent can change between
  any two of them: when the screen offers the button, inside `queueCallTask`, and again by the
  dialer immediately before it dials. The dialer **cancels** rather than defers — unlike the hours
  or the daily cap, a missing consent does not come good by waiting.
- `outboundSystemPrompt` gains a `business_intro` branch. The "you are not selling anything"
  paragraph is the one line whose meaning changes with the kind: for a notification the call is
  lawful *because* it solicits nothing, and for an introduction it is lawful *because consent was
  given*, so the boundary moves rather than disappearing. Ana may say what we do; she may not
  price it, close it, press it, qualify them, or ask for a meeting. The ceiling on the call is
  permission to email plus a callback from a person.
- `/admin/outreach` records consent and is the only place an introduction can be queued from. There
  is no field on it for a bare number, and no override.

### 17.4 What is still open

- **National DNCL registration.** Required, not done. Owner action.
- **Whether an introduction should be automated at all.** The build makes it lawful. It does not
  make it wise, and a first impression delivered by a synthesised voice is a choice about how the
  company wants to be seen, which is not a question this document can answer. The one-per-number
  index is there because the second automated introduction is where this goes wrong.
- **CRTC 2026-132** is mid-review of these exact rules; replies closed 11 August 2026. If it
  resolves that an AI voice is not an ADAD, most of this section relaxes. Do not assume it will.
