import FloorPlan from "./FloorPlan";
import { squareMetersToSquareFeet, metersToFeet, type ScanGeometry } from "@/lib/roomScan";
import { MEASURE_DEFINITIONS } from "@/lib/crm/measureDefinitions";
import { areaColor, DAMAGE_LABEL, type AffectedArea, type DamageType } from "@/lib/crm/areaShapes";
import { unitDays, type EquipmentPlacement, type MoistureReading } from "@/lib/crm/dryingLog";
import type { CompanySetting, CustomFieldDef } from "@/lib/crm/settings";
import { isFieldVisible } from "@/lib/crm/settings";

/**
 * The restoration report, as a printable document.
 *
 * Built to the layout measured off the client's own magicplan export — US
 * Letter, a running header, a rule, page numbers — because that page skeleton
 * is what makes a report read as professional, and it costs nothing to match.
 *
 * What it does NOT copy is the content. That report carries one table in
 * twenty pages, no claim number, no insured, no adjuster, no moisture reading
 * and no equipment. It is a geometry brochure handed to somebody whose job is
 * to reduce the invoice. This one leads with the claim identity on every
 * page, and ends with the drying record.
 *
 * Rendered as ordinary HTML and printed to PDF by the browser. No PDF library:
 * their own report is Chromium output, so the approach is proven, and an HTML
 * document is one that can be read on a phone as well as printed.
 */

export type ReportRoom = {
  id: string;
  name: string;
  level: string;
  floorAreaSqm: number;
  wallLengthM: number;
  ceilingHeightM: number;
  stairCount: number;
  notes: string | null;
  geometry: ScanGeometry;
  areas: AffectedArea[];
  readings: MoistureReading[];
  photos: { id: string; url: string | null; note: string | null }[];
};

export type ReportData = {
  company: CompanySetting;
  project: { name: string; description: string | null; started_on: string | null };
  client: { name: string; email?: string | null; phone?: string | null } | null;
  property: string | null;
  claimFields: CustomFieldDef[];
  claim: Record<string, string>;
  levels: string[];
  rooms: ReportRoom[];
  equipment: EquipmentPlacement[];
  generatedAt: string;
  /** Draw only the dimensions somebody set by hand (geometry.lockedEdges),
      each padlocked — for the adjuster who wants measured-by-hand figures
      and nothing inferred. Off by default: the full drawing is the report. */
  onlyLockedDimensions?: boolean;
};

const sqft = (sqm: number) => Math.round(squareMetersToSquareFeet(sqm)).toLocaleString("en-CA");
const ft = (m: number) => Math.round(metersToFeet(m)).toLocaleString("en-CA");

function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return new Date(bare ? `${iso}T12:00:00` : iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(bare ? {} : { timeZone: "America/Toronto" }),
  });
}

export default function ReportDocument({ data }: { data: ReportData }) {
  const {
    company,
    project,
    client,
    property,
    claimFields,
    claim,
    levels,
    rooms,
    equipment,
    generatedAt,
    onlyLockedDimensions = false,
  } = data;

  const floorAreaSqm = rooms.reduce((sum, room) => sum + room.floorAreaSqm, 0);
  const wallAreaSqm = rooms.reduce(
    (sum, room) => sum + room.wallLengthM * room.ceilingHeightM,
    0,
  );

  // By cause, never one grand total: causes do not share a trade or a rate,
  // and areas may overlap, so a single sum would double-count the square
  // footage that is both wet and smoke-stained.
  //
  // And by surface, for the same reason one step out. Floor square footage
  // and wall square footage are different trades at different rates; added
  // together they price neither. An adjuster reading one merged figure
  // cannot check it against anything.
  const damage = new Map<DamageType, number>();
  const wallDamage = new Map<DamageType, number>();
  for (const room of rooms) {
    for (const area of room.areas) {
      const into = area.surface === "wall" ? wallDamage : damage;
      into.set(area.damage_type, (into.get(area.damage_type) ?? 0) + Number(area.area_sqm));
    }
  }

  const now = new Date(generatedAt);
  const shownClaim = claimFields.filter(
    (field) => isFieldVisible(field, claim) && claim[field.id]?.trim(),
  );

  // The strip that identifies the file on every single page. An adjuster
  // reviewing a thirty-page PDF flips pages out of order; a page that cannot
  // say which claim it belongs to is a page that gets set aside.
  const identity = [
    claim.claim_number && `CLAIM ${claim.claim_number}`,
    client?.name,
    claim.loss_date && `LOSS ${date(claim.loss_date)}`,
    claim.water_category,
    claim.water_class,
  ]
    .filter(Boolean)
    .join("  •  ");

  return (
    <article className="report">
      {/* ---------------------------------------------------- cover */}
      <section className="page cover">
        <header className="cover-head">
          <div>
            <h1>{project.name}</h1>
            {property && <p className="addr">{property}</p>}
          </div>
          <div className="brand">
            <strong>{company.tradeName || company.legalName}</strong>
            {company.rbqLicence && <span>RBQ {company.rbqLicence}</span>}
          </div>
        </header>

        <div className="cover-grid">
          <dl>
            <dt>Insured</dt>
            <dd>{client?.name ?? "—"}</dd>
            <dt>Property</dt>
            <dd>{property ?? "—"}</dd>
            <dt>Work started</dt>
            <dd>{date(project.started_on)}</dd>
            <dt>Report prepared</dt>
            <dd>{date(generatedAt)}</dd>
          </dl>

          <dl>
            {shownClaim.length === 0 ? (
              <>
                <dt>Claim details</dt>
                <dd className="muted">Not recorded</dd>
              </>
            ) : (
              shownClaim.map((field) => (
                <span key={field.id} style={{ display: "contents" }}>
                  <dt>{field.label}</dt>
                  <dd>{claim[field.id]}</dd>
                </span>
              ))
            )}
          </dl>
        </div>

        <table className="stats">
          <thead>
            <tr>
              <th>Floor area</th>
              {/* Named gross so the definitions appendix maps onto it. */}
              <th>Wall area (gross)</th>
              <th>Floors</th>
              <th>Rooms</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{sqft(floorAreaSqm)} sq ft</td>
              <td>{sqft(wallAreaSqm)} sq ft</td>
              <td>{levels.length}</td>
              {/* Counted from the rooms present, not from a type enum that
                  nobody set — the bug their own cover page ships with. */}
              <td>{rooms.length}</td>
            </tr>
          </tbody>
        </table>

        {damage.size > 0 && (
          <table className="stats damage">
            <thead>
              <tr>
                {/* Named as floor area, not just "affected area". The wall
                    table below is also affected area, and an adjuster must be
                    able to tell which surface a figure priced. */}
                <th colSpan={2}>Affected floor area by cause</th>
              </tr>
            </thead>
            <tbody>
              {[...damage.entries()].map(([type, sqm]) => (
                <tr key={type}>
                  <td>
                    <span className="swatch" style={{ background: areaColor({ color: null, damage_type: type }) }} />
                    {DAMAGE_LABEL[type]}
                  </td>
                  <td className="num">{sqft(sqm)} sq ft</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {wallDamage.size > 0 && (
          <table className="stats damage">
            <thead>
              <tr>
                <th colSpan={2}>Affected wall area by cause</th>
              </tr>
            </thead>
            <tbody>
              {[...wallDamage.entries()].map(([type, sqm]) => (
                <tr key={type}>
                  <td>
                    <span className="swatch" style={{ background: areaColor({ color: null, damage_type: type }) }} />
                    {DAMAGE_LABEL[type]}
                  </td>
                  <td className="num">{sqft(sqm)} sq ft</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {project.description && <p className="desc">{project.description}</p>}

        <footer className="cover-foot">
          <span>
            <strong>{company.tradeName || company.legalName}</strong>
            {company.email && <> · {company.email}</>}
          </span>
          <span>
            {[company.street1, company.city, company.province, company.postalCode]
              .filter(Boolean)
              .join(", ")}
          </span>
          <span>{company.phone}</span>
        </footer>
      </section>

      {/* ------------------------------------------- one page per floor */}
      {levels.map((level) => {
        const onLevel = rooms.filter((room) => room.level === level);
        if (onLevel.length === 0) return null;
        const levelArea = onLevel.reduce((sum, room) => sum + room.floorAreaSqm, 0);

        return (
          <section className="page" key={level}>
            <Running identity={identity} title={`${level} — floor plan`} company={company} />
            <p className="totals">
              {sqft(levelArea)} sq ft · {onLevel.length} room{onLevel.length === 1 ? "" : "s"}
            </p>
            <div className="plan-grid">
              {onLevel.map((room) => (
                <figure key={room.id}>
                  <div className="plan">
                    <FloorPlan result={room.geometry} name={room.name} variant="thumb" />
                  </div>
                  <figcaption>
                    <strong>{room.name}</strong>
                    <span>{sqft(room.floorAreaSqm)} sq ft</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}

      {/* --------------------------------------------- one page per room */}
      {rooms.map((room) => (
        <section className="page" key={room.id}>
          <Running identity={identity} title={`${room.name} — ${room.level}`} company={company} />

          <div className="room-body">
            {/* Wrapped so the plan and its note share one grid cell. */}
            <div>
              <div className="plan large">
                <FloorPlan
                  result={room.geometry}
                  name={room.name}
                  dimensions={onlyLockedDimensions ? "locked" : "all"}
                />
              </div>
              {/* The printed page must say what it is showing — a plan with
                  dimensions missing and no explanation reads as an error. */}
              {onlyLockedDimensions && (
                <p className="fineprint">
                  Only dimensions that were set by hand are shown on this plan.
                  A room with none shows no dimensions.
                </p>
              )}
            </div>

            <table className="measure">
              <tbody>
                <tr>
                  <th>Floor</th>
                  <td className="num">{sqft(room.floorAreaSqm)} sq ft</td>
                </tr>
                <tr>
                  <th>Wall area (gross)</th>
                  <td className="num">{sqft(room.wallLengthM * room.ceilingHeightM)} sq ft</td>
                </tr>
                <tr>
                  <th>Perimeter</th>
                  <td className="num">{ft(room.wallLengthM)} ft</td>
                </tr>
                <tr>
                  <th>Ceiling height</th>
                  <td className="num">{metersToFeet(room.ceilingHeightM).toFixed(1)} ft</td>
                </tr>
                {room.stairCount > 0 && (
                  <tr>
                    <th>Staircase</th>
                    <td className="num">
                      {room.stairCount} — priced separately, not in the floor area
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {room.areas.length > 0 && (
            <table className="listing">
              <thead>
                <tr>
                  <th>Affected area</th>
                  <th>Cause</th>
                  <th className="num">Measured</th>
                </tr>
              </thead>
              <tbody>
                {room.areas.map((area) => (
                  <tr key={area.id}>
                    <td>
                      <span className="swatch" style={{ background: areaColor(area) }} />
                      {area.name}
                    </td>
                    <td>{DAMAGE_LABEL[area.damage_type]}</td>
                    <td className="num">{sqft(Number(area.area_sqm))} sq ft</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {room.readings.length > 0 && (
            <table className="listing">
              <thead>
                <tr>
                  <th>Reading</th>
                  <th>Location</th>
                  <th>Material</th>
                  <th className="num">MC</th>
                  <th className="num">RH</th>
                  <th className="num">Temp</th>
                </tr>
              </thead>
              <tbody>
                {room.readings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{date(reading.taken_at)}</td>
                    <td>{reading.location || "—"}</td>
                    <td>{reading.material ?? "—"}</td>
                    <td className="num">
                      {reading.material_percent === null ? "—" : `${reading.material_percent}%`}
                    </td>
                    <td className="num">
                      {reading.relative_humidity === null ? "—" : `${reading.relative_humidity}%`}
                    </td>
                    <td className="num">
                      {reading.temperature_c === null ? "—" : `${reading.temperature_c}°C`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {room.notes && <p className="notes">{room.notes}</p>}

          {room.photos.length > 0 && (
            <div className="photos">
              {room.photos.map((photo) =>
                photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={photo.id} src={photo.url} alt={photo.note ?? room.name} />
                ) : null,
              )}
            </div>
          )}
        </section>
      ))}

      {/* ------------------------------------------------ drying record */}
      {equipment.length > 0 && (
        <section className="page">
          <Running identity={identity} title="Equipment on site" company={company} />
          <table className="listing">
            <thead>
              <tr>
                <th>Equipment</th>
                <th className="num">Qty</th>
                <th>In service</th>
                <th>Out of service</th>
                <th className="num">Unit-days</th>
              </tr>
            </thead>
            <tbody>
              {equipment.map((item) => (
                <tr key={item.id}>
                  <td>{item.kind}</td>
                  <td className="num">{item.quantity}</td>
                  <td>{date(item.in_service_at)}</td>
                  <td>{item.out_of_service_at ? date(item.out_of_service_at) : "Still on site"}</td>
                  <td className="num">{unitDays(item, now)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={4}>Total</td>
                <td className="num">
                  {equipment.reduce((sum, item) => sum + unitDays(item, now), 0)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="fineprint">
            Equipment is billed per unit per day on site. The day of delivery
            and the day of collection are both counted. Units shown as still on
            site are counted to {date(generatedAt)}.
          </p>
        </section>
      )}

      {/* --------------------------------------- measurement definitions */}
      {/* An adjuster-facing document must state its definitions: when their
          figure differs from ours, the definition is the whole argument.
          These are the same definitions the app shows beside each figure —
          MEASURE_DEFINITIONS is one list, so the report cannot drift from
          the screens. */}
      {rooms.length > 0 && (
        <section className="page">
          <Running
            identity={identity}
            title="How these figures are measured"
            company={company}
          />
          <table className="measure definitions">
            <tbody>
              {Object.values(MEASURE_DEFINITIONS).map((meaning) => (
                <tr key={meaning.id}>
                  <th>{meaning.title}</th>
                  <td>{meaning.definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="fineprint">
            All measurements are taken in metres and converted for display.
            Figures in this report are rounded to the foot and the square foot.
          </p>
        </section>
      )}
    </article>
  );
}

/** The band that identifies the claim on every page after the cover. */
function Running({
  identity,
  title,
  company,
}: {
  identity: string;
  title: string;
  company: CompanySetting;
}) {
  return (
    <header className="running">
      <div>
        <h2>{title}</h2>
        <p>{identity || company.tradeName}</p>
      </div>
      <span className="mark">{company.tradeName || company.legalName}</span>
    </header>
  );
}
