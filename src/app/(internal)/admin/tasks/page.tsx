import AdminNotice from "@/components/admin/AdminNotice";
import CallTaskList, { type CallTaskView } from "@/components/admin/CallTaskList";
import TaskList from "./TaskList";
import { cancelCallTaskAction, setTaskDoneAction } from "./actions";
import { listRecentCallTasks, type CallTask } from "@/lib/crm/callTasks";
import { db } from "@/lib/crm/db";
import { loadOwnerTasks, type TaskLoadResult } from "@/lib/crm/tasks";
import { clientDisplayName } from "@/lib/crm/types";

/**
 * Two lists, one screen: the calls Ana is about to place, and the notes the
 * owner dictated to her.
 *
 * They share a page because they share a moment — he looks at this between
 * jobs, and "what is the assistant about to do on my behalf" and "what did I
 * tell her to remember" are the same glance. Calls come first: a queued call
 * goes out whether or not he reads this, and a dictated note does not.
 *
 * Neither half can take the other down. Each renders its own failure — the
 * call queue lives in migration 0018, the notes in 0017, and either may not
 * have been run yet — so a missing table costs one section, not the page.
 */

export const dynamic = "force-dynamic";

/** The business runs on Montreal time; the server runs on UTC. */
const TZ = "America/Toronto";

export default async function TasksPage() {
  // Independent reads against two tables; no reason for one to wait on the
  // other, and the slower of the two should not add to the faster.
  const [callResult, noteResult] = await Promise.all([listRecentCallTasks(), loadOwnerTasks()]);

  // Computed on the server so the client renders stable "overdue" and "goes
  // out today" labels without a hydration mismatch, and against Montreal's
  // calendar rather than UTC's — a task due today must not read as overdue at
  // 8pm, and a call due at 19:00 must not read as tomorrow.
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });

  const calls = callResult.ok ? await withContacts(callResult.tasks) : [];

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading
          title="Calls to make"
          blurb="Ana places these herself, and only ever about an appointment the customer already has with us. Dialling is on a schedule — there is no button here to place one early, because the rules about when a number may be called live in the dialer."
        />
        {callResult.ok ? (
          <CallTaskList tasks={calls} now={now.toISOString()} cancel={cancelCallTaskAction} />
        ) : (
          <CallFailure result={callResult} />
        )}
      </section>

      <section>
        <SectionHeading
          title="Notes"
          blurb="Two ways in, one list. Typed into the task bar at the top of any screen, or said out loud to Ana on the phone — he calls, gives his PIN, and tells her the thing he would otherwise forget by the time he is off the roof. Rows that came in by phone are marked."
        />
        <NoteSection result={noteResult} today={today} />
      </section>
    </div>
  );
}

/**
 * Put a name and the live suppression flag on each call row.
 *
 * `call_tasks` denormalizes the number but not the person — deliberately, so
 * the dialer never has to resolve a contact — which leaves this screen the job
 * of turning a client_id into a name. One query for the whole page rather than
 * one per row, and a failure here costs the names, not the list: every row
 * falls back to the phone number it was queued against.
 *
 * `do_not_call` is read live rather than inferred from the outcome code, for
 * the same reason the migration keeps them separate. An `opt_out_requested`
 * row whose client is not actually flagged is the one failure on this screen
 * that has a cost outside the office, and the list says so where it happens.
 */
async function withContacts(tasks: CallTask[]): Promise<CallTaskView[]> {
  const ids = [...new Set(tasks.map((task) => task.client_id).filter(Boolean))] as string[];
  if (ids.length === 0) return tasks;

  const supabase = db();
  if (!supabase) return tasks;

  const { data, error } = await supabase
    .from("clients")
    .select("id, first_name, last_name, company_name, do_not_call")
    .in("id", ids);

  if (error) {
    console.error("[tasks] could not name the call contacts:", error.message);
    return tasks;
  }

  type Row = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    do_not_call: boolean | null;
  };

  const byId = new Map((data ?? []).map((row) => [(row as Row).id, row as Row]));

  return tasks.map((task) => {
    const client = task.client_id ? byId.get(task.client_id) : undefined;
    if (!client) return task;
    return {
      ...task,
      contact_name: clientDisplayName(client),
      do_not_call: Boolean(client.do_not_call),
    };
  });
}

function SectionHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-heading text-lg font-bold text-charcoal">{title}</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-charcoal/50">{blurb}</p>
    </div>
  );
}

/**
 * Why the call queue is not on screen.
 *
 * `migration_pending` is the likely one and the only one the owner can fix
 * himself — migrations here are run by hand — so it names the file and says
 * what is silently not happening until he does.
 */
function CallFailure({ result }: { result: { reason: string; detail?: string } }) {
  if (result.reason === "unconfigured") {
    return (
      <AdminNotice title="No database connected yet">
        Set the Supabase environment variables to turn this on.
      </AdminNotice>
    );
  }
  if (result.reason === "migration_pending") {
    return (
      <AdminNotice title="The call queue table hasn't been created yet">
        Open the Supabase SQL editor and run{" "}
        <code className="font-mono text-brand-blue">
          supabase/migrations/0018_call_tasks.sql
        </code>
        . Until it exists there is nowhere to queue an outbound call, so no confirmation calls go
        out the day before a visit and nobody is told when the crew is on the way — quietly, and
        without anything appearing here.
      </AdminNotice>
    );
  }
  return (
    <AdminNotice title="Could not load the call queue">
      {result.detail ?? "Unknown error"}. Calls may still be going out — this is the screen
      failing, not the dialer. If the project has been idle for over a week it may be paused; open
      the Supabase dashboard to resume it.
    </AdminNotice>
  );
}

function NoteSection({ result, today }: { result: TaskLoadResult; today: string }) {
  if (!result.ok) {
    if (result.reason === "unconfigured") {
      return (
        <AdminNotice title="No database connected yet">
          Set the Supabase environment variables to turn this on.
        </AdminNotice>
      );
    }
    if (result.reason === "migration_pending") {
      return (
        <AdminNotice title="One migration left to run">
          Open the Supabase SQL editor and run{" "}
          <code className="font-mono text-brand-blue">
            supabase/migrations/0017_owner_tasks.sql
          </code>
          . Until that table exists Ana has nowhere to put a note you dictate, so she has to tell
          you to write it down yourself — worth doing before the next call.
        </AdminNotice>
      );
    }
    return (
      <AdminNotice title="Could not reach the database">
        {result.detail ?? "Unknown error"}. If the project has been idle for over a week it may be
        paused — open the Supabase dashboard to resume it.
      </AdminNotice>
    );
  }

  if (result.tasks.length === 0) {
    return (
      <AdminNotice title="Nothing on the list">
        Add one from the task bar at the top of any screen, or call Ana, give her your PIN and tell
        her what you need to remember — &ldquo;order the membrane for Thursday&rdquo;. A dictated
        one arrives here with a link back to the call it came from.
      </AdminNotice>
    );
  }

  return <TaskList tasks={result.tasks} today={today} setDone={setTaskDoneAction} />;
}
