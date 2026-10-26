# Humor Admin

The admin area for [The Humor Project](https://github.com/jasmineztruong8/thehumorproject). It's a separate
Next.js app on the **same Supabase database**, so everything here is live data from the main site.

Live: https://humor-admin-eight.vercel.app (superadmins only)

| Page | What you can do |
|---|---|
| **Stats** (`/`) | Totals, captions and votes per day, activity by hour, hall of fame, most divisive captions, funniest people, whether steering the AI helps, model breakdown |
| **Users** (`/users`) | READ every profile with images, captions, caption score and voting habits. Search and sort |
| **Media** (`/media`) | CREATE an image (Gemini describes it and writes a caption), READ all images and captions, UPDATE titles, descriptions and caption text, DELETE images and captions, and generate more AI captions |
| **Votes** (`/votes`) | READ every upvote and downvote, filterable |
| **Requests** (`/requests`) | READ every AI request from both apps (describe a photo, suggest a caption), with success rate, timing and a daily chart. Open one to see the prompt and every model it tried |
| **Responses** (`/responses`) | READ every LLM call, filterable by model and result, plus per-model health (answer rate, quota errors, median time) |
| **Chains** (`/chains`) | READ the prompt chains and their steps; READ/UPDATE the mix (what share of captions each chain writes) |
| **Models** (`/models`) | CREATE/READ/UPDATE/DELETE LLM models. Active Google models are what the caption AI tries, lowest priority first |
| **Providers** (`/providers`) | CREATE/READ/UPDATE/DELETE LLM providers |
| **Examples** (`/examples`) | CREATE/READ/UPDATE/DELETE few-shot caption examples used by the "with examples" chain |
| **Terms** (`/terms`) | CREATE/READ/UPDATE/DELETE campus terms used by the "with examples" chain |
| **Sign-up access** (`/access`) | CREATE/READ/UPDATE/DELETE allowed sign-up domains and whitelisted emails. Empty lists mean anyone can sign up; existing accounts are never locked out |

The AI settings and the request log live in the main repo's
`supabase/migrations/20261025000000_ai_observability.sql`. The caption site reads the settings (cached for a
minute, falling back to built-in defaults if anything goes wrong) and logs each request after its response is
sent, so neither can slow down or break captioning.

## Who can get in

Every route is behind Google sign-in **and** `profiles.is_superadmin = true`, checked in three places:

1. `proxy.ts` runs before every request (pages and server actions). Signed-out visitors go to `/login`,
   signed-in non-admins go to `/denied`.
2. `requireAdmin()` (`lib/auth.ts`) runs again at the top of every page and server action.
3. Row level security in the database (`private.is_superadmin()`, see the main repo's
   `supabase/migrations`) is what actually protects the data. This app has **no service-role key**: every
   query runs as the signed-in admin, so even a bug in 1 or 2 can't read or change what RLS forbids.

### "Won't I be locked out?"

`is_superadmin` defaults to `false`, and RLS doesn't let anyone change their own flag (there's a test for
that), so nobody can make themselves an admin through either app. The first admin is set **outside the app**,
by the project owner, in the Supabase dashboard (SQL editor or table editor), which isn't limited by RLS:

```sql
update public.profiles set is_superadmin = true
where id = (select id from auth.users where email = 'you@example.com');
```

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3001
npm test
```

In Supabase → Authentication → URL Configuration, add `http://localhost:3001/auth/callback` and
`https://<your-vercel-domain>/auth/callback` to the Redirect URLs.
