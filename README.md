# GUTECH Internal Learning Campus

Responsive internal learning platform built with React + TypeScript, Node.js + Express, and Supabase (Auth, Postgres, RLS, and private Storage).

## Repository layout

- `FrontEnd/` — React/Vite app and browser Supabase client.
- `Backend/` — Node API, request validation, role checks, and user scoped Supabase access.
- `Backend/supabase/migrations/` — database schema, RLS, private bucket, and storage policies.
- `AI_PRODUCT_SPEC.md` — product and AI build specification.

## Configure Supabase

1. Create a Supabase project and apply `Backend/supabase/migrations/202610260001_initial_schema.sql`.
2. In Supabase Auth settings, **disable public sign-ups**. Accounts are invitation only.
3. Configure Auth redirect URLs to include the frontend origin (local: `http://localhost:5173`). Configure email delivery for invitations and password reset.
4. Copy `FrontEnd/.env.example` into `FrontEnd/.env` and set the project URL and public anon/publishable key.
5. Copy `Backend/.env.example` into `Backend/.env` and set the same project URL/public key. Set the **server-only service role key** to enable account invitations, email-based course assignment, and secure quiz scoring.
6. Configure the allowed frontend origin in `Backend/.env`.

Local `.env` files are ignored by Git. Never place `SUPABASE_SERVICE_ROLE_KEY` in `FrontEnd/.env`, a `VITE_*` variable, or browser code. The project URL and publishable key are already set in the local environment files for this workspace; the service role key is not configured.

### Bootstrap the first administrator

There is no public sign-up. Create the first user in Supabase Auth Dashboard, then provision the matching internal profile as an administrator using the SQL editor:

```sql
insert into public.profiles (id, full_name, role, is_active)
select id, coalesce(raw_user_meta_data->>'full_name', email), 'admin', true
from auth.users
where email = 'your-admin@gutech.edu.om'
on conflict (id) do update set role = 'admin', is_active = true;
```

Sign in as this administrator. The internal invite endpoint creates student/teacher accounts. Teachers can create their own courses from **My courses**; administrators can create courses and assign them to provisioned students.

## Run locally

Use two terminals:

```powershell
cd Backend
npm install
npm run dev
```

```powershell
cd FrontEnd
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
API health: `http://localhost:4000/health`

## Implemented workflows

- Internal email/password sign-in, password reset and update; no public registration UI or API.
- Role-aware student, teacher, and admin access.
- Admin user invitations and student-to-course assignment.
- Course dashboard and assigned course list.
- Teacher resource uploads to private storage; student seen status.
- Assignments, file/text submission, instructor grading and published marks.
- Quizzes with objective questions, server side answer keys/scoring, attempts, and time limits.
- Course announcements.
- Course member chat.
- Private complaint submission and role scoped complaint tracking.
- User profile details and institutional account status.

## Operational notes

- Supabase user scoped JWT clients enforce RLS for ordinary reads/writes and authenticate requests using the public project key. The optional service role is used only server side for invitations, email-based course assignment, and secure quiz scoring; the application does not use a database password.
- Keep migrations under version control and apply to a development project before production.
- Configure email templates/SMTP, allowed redirect URLs, storage limits, backups, retention, and monitoring before launch.
- AI provider selection and production AI credentials are not configured. AI features in the product spec remain optional and are not called by this baseline.
