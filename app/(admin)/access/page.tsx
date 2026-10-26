import { requireAdmin } from "@/lib/auth";
import {
  createDomain,
  createEmail,
  deleteDomain,
  deleteEmail,
  updateDomain,
  updateEmail,
} from "@/app/config-actions";
import { ActionForm, EditableItem, Field } from "@/components/forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign-up access · Humor Admin" };

type Domain = { id: string; domain: string; created_at: string };
type Email = { id: string; email: string; note: string | null; created_at: string };

function DomainField({ d }: { d?: Domain }) {
  return (
    <Field label="Domain">
      <input name="domain" defaultValue={d?.domain} required maxLength={253} placeholder="columbia.edu" className="field" />
    </Field>
  );
}

function EmailFields({ e }: { e?: Email }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Email address">
        <input name="email" type="email" defaultValue={e?.email} required maxLength={254} placeholder="guest@gmail.com" className="field" />
      </Field>
      <Field label="Note (optional)">
        <input name="note" defaultValue={e?.note ?? ""} maxLength={200} placeholder="Course TA" className="field" />
      </Field>
    </div>
  );
}

// CREATE / READ / UPDATE / DELETE: allowed sign-up domains and whitelisted
// email addresses. The database enforces them when an account is created
// (private.check_signup_allowed in the main repo).
export default async function AccessPage() {
  const { supabase } = await requireAdmin();
  const [{ data: domains, error: domainsError }, { data: emails, error: emailsError }] = await Promise.all([
    supabase.from("allowed_signup_domains").select("id, domain, created_at").order("domain").returns<Domain[]>(),
    supabase.from("whitelisted_emails").select("id, email, note, created_at").order("email").returns<Email[]>(),
  ]);
  if (domainsError) console.error("Loading domains failed", domainsError);
  if (emailsError) console.error("Loading emails failed", emailsError);

  const loaded = !domainsError && !emailsError;
  const open = loaded && !domains?.length && !emails?.length;

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign-up access</h1>
        <p className="text-dim">
          Who can create a new account on The Humor Project. Existing accounts always keep working.
        </p>
      </div>

      {loaded && (
        <p className={`card p-4 text-sm ${open ? "" : "border-accent"}`}>
          {open ? (
            <>
              <span className="font-medium">Sign-ups are open to anyone.</span> Adding a domain or an email address
              below limits new accounts to the list.
            </>
          ) : (
            <>
              <span className="font-medium">Sign-ups are limited.</span> New accounts need an email at one of these
              domains (or a subdomain, like cs.columbia.edu), or a whitelisted address. Remove every entry to open
              sign-ups again.
            </>
          )}
        </p>
      )}
      {!loaded && <p className="text-danger">The lists didn&apos;t load. Please refresh the page.</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Allowed sign-up domains</h2>
        <div className="card p-5">
          <ActionForm action={createDomain} submitLabel="Add domain" className="sm:flex-row sm:items-end">
            <DomainField />
          </ActionForm>
        </div>
        <ul className="card divide-y divide-line">
          {domains?.map((d) => (
            <li key={d.id} className="p-4">
              <EditableItem
                action={updateDomain.bind(null, d.id)}
                deleteAction={deleteDomain.bind(null, d.id)}
                deleteText={`Remove ${d.domain}? If it's the last entry on both lists, anyone can sign up.`}
                view={<p className="font-mono text-sm pt-1.5">@{d.domain}</p>}
              >
                <DomainField d={d} />
              </EditableItem>
            </li>
          ))}
          {domains?.length === 0 && <li className="p-4 text-sm text-dim">No domains.</li>}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Whitelisted email addresses</h2>
        <div className="card p-5">
          <ActionForm action={createEmail} submitLabel="Add email">
            <EmailFields />
          </ActionForm>
        </div>
        <ul className="card divide-y divide-line">
          {emails?.map((e) => (
            <li key={e.id} className="p-4">
              <EditableItem
                action={updateEmail.bind(null, e.id)}
                deleteAction={deleteEmail.bind(null, e.id)}
                deleteText={`Remove ${e.email}? If it's the last entry on both lists, anyone can sign up.`}
                view={
                  <p className="pt-1.5">
                    <span className="font-mono text-sm">{e.email}</span>
                    {e.note && <span className="text-sm text-dim"> · {e.note}</span>}
                  </p>
                }
              >
                <EmailFields e={e} />
              </EditableItem>
            </li>
          ))}
          {emails?.length === 0 && <li className="p-4 text-sm text-dim">No email addresses.</li>}
        </ul>
      </section>
    </main>
  );
}
