import AdminNotice from "@/components/admin/AdminNotice";
import TaskList from "./TaskList";
import { setTaskDoneAction } from "./actions";
import { loadOwnerTasks } from "@/lib/crm/tasks";

/**
 * The owner's dictated to-do list.
 *
 * Everything here arrived over the phone: he calls Ana, gives his PIN, and
 * says the thing he would otherwise forget by the time he is off the roof.
 * There is deliberately no "add task" field — a screen he has to be sitting at
 * is the exact situation this table exists to avoid — so the only interaction
 * is ticking things off.
 */

export const dynamic = "force-dynamic";

/** The business runs on Montreal time; the server runs on UTC. */
const TZ = "America/Toronto";

export default async function TasksPage() {
  const result = await loadOwnerTasks();

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
        This list is dictated, not typed. Call Ana, give her your PIN, and tell her what you need
        to remember — &ldquo;order the membrane for Thursday&rdquo; — and it will be waiting here,
        with a link back to the call it came from.
      </AdminNotice>
    );
  }

  // Computed on the server so the client renders a stable "overdue" without a
  // hydration mismatch, and against Montreal's calendar rather than UTC's —
  // a task due today must not read as overdue at 8pm.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  return <TaskList tasks={result.tasks} today={today} setDone={setTaskDoneAction} />;
}
