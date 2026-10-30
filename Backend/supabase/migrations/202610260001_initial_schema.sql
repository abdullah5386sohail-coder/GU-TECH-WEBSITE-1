-- GUTECH LMS initial schema. Apply with Supabase CLI or SQL editor.
create extension if not exists pgcrypto;

create type public.app_role as enum ('student','teacher','admin');
create type public.assessment_kind as enum ('assignment','quiz');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  department text,
  student_id text,
  avatar_url text,
  role public.app_role not null default 'student',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 100)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text not null default '',
  color text,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  status text not null default 'active' check (status in ('active','completed','withdrawn')),
  assigned_at timestamptz not null default now(),
  unique(course_id,student_id)
);
create index course_assignments_student_idx on public.course_assignments(student_id,status);
create index course_assignments_course_idx on public.course_assignments(course_id,status);

create table public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  title text not null,
  description text not null default '',
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null check(file_size between 1 and 26214400),
  status text not null default 'active' check(status in ('active','archived')),
  created_at timestamptz not null default now()
);
create index course_resources_course_idx on public.course_resources(course_id,status,created_at desc);

create table public.resource_views (
  resource_id uuid not null references public.course_resources(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key(resource_id,student_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  status text not null default 'published' check(status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_course_idx on public.announcements(course_id,status,created_at desc);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  type public.assessment_kind not null,
  title text not null,
  description text not null default '',
  due_at timestamptz,
  max_marks integer not null check(max_marks > 0 and max_marks <= 10000),
  duration_minutes integer not null default 0 check(duration_minutes between 0 and 600),
  attempt_limit integer not null default 1 check(attempt_limit between 1 and 20),
  submission_type text not null default 'text_or_file' check(submission_type in ('text_or_file','text','file')),
  status text not null default 'published' check(status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessments_course_idx on public.assessments(course_id,type,status,due_at);

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  prompt text not null,
  question_type text not null default 'single_choice' check(question_type in ('single_choice','multiple_choice','true_false')),
  options jsonb not null default '[]'::jsonb,
  points integer not null default 1 check(points > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Answer keys live in a separate table so normal quiz retrieval can never expose them.
create table public.assessment_answer_keys (
  question_id uuid primary key references public.assessment_questions(id) on delete cascade,
  correct_answer jsonb not null
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt integer not null check(attempt > 0),
  text text not null default '',
  storage_path text,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check(status in ('submitted','late','graded','returned')),
  marks numeric(8,2),
  feedback text,
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  unique(assessment_id,student_id,attempt),
  constraint submission_marks_valid check(marks is null or marks >= 0)
);
create index submissions_student_idx on public.submissions(student_id,submitted_at desc);
create index submissions_assessment_idx on public.submissions(assessment_id,student_id,attempt desc);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt integer not null check(attempt > 0),
  answers jsonb not null default '{}'::jsonb,
  marks numeric(8,2),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status text not null default 'in_progress' check(status in ('in_progress','submitted','graded')),
  unique(assessment_id,student_id,attempt)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 2000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_messages_course_idx on public.chat_messages(course_id,created_at desc);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  category text not null,
  subject text not null,
  description text not null,
  status text not null default 'submitted' check(status in ('submitted','under review','waiting for student','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index complaints_student_idx on public.complaints(student_id,created_at desc);
create index complaints_handler_idx on public.complaints(assigned_to,status);

create table public.complaint_updates (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  response text,
  status text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger assessments_updated_at before update on public.assessments for each row execute function public.set_updated_at();
create trigger announcements_updated_at before update on public.announcements for each row execute function public.set_updated_at();
create trigger complaints_updated_at before update on public.complaints for each row execute function public.set_updated_at();

-- Definer helpers avoid recursive RLS lookups while keeping policy predicates small.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.is_active)
$$;
create or replace function public.is_course_teacher(target_course uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.courses c join public.profiles p on p.id=c.teacher_id where c.id=target_course and c.teacher_id=auth.uid() and p.is_active)
$$;
create or replace function public.is_course_student(target_course uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.course_assignments a join public.profiles p on p.id=a.student_id where a.course_id=target_course and a.student_id=auth.uid() and a.status='active' and p.is_active)
$$;
create or replace function public.can_access_course(target_course uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.is_admin() or public.is_course_teacher(target_course) or public.is_course_student(target_course)
$$;
create or replace function public.can_view_course_profile(target_profile uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles viewer where viewer.id=auth.uid() and viewer.is_active and (
      viewer.role='admin'
      or exists(select 1 from public.course_assignments target join public.courses c on c.id=target.course_id where target.student_id=target_profile and target.status='active' and c.teacher_id=auth.uid())
      or exists(select 1 from public.course_assignments mine join public.course_assignments target on target.course_id=mine.course_id where mine.student_id=auth.uid() and mine.status='active' and target.student_id=target_profile and target.status='active')
    ))
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_assignments enable row level security;
alter table public.course_resources enable row level security;
alter table public.resource_views enable row level security;
alter table public.announcements enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_answer_keys enable row level security;
alter table public.submissions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.chat_messages enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_updates enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_self_or_staff on public.profiles for select to authenticated using(id=auth.uid() or public.can_view_course_profile(id));
create or replace function public.prevent_profile_privilege_changes() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active) and not public.is_admin() then
    raise exception 'Only an administrator can change account role or status' using errcode='42501';
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles for each row execute function public.prevent_profile_privilege_changes();
create policy profiles_update_self on public.profiles for update to authenticated using(id=auth.uid() and is_active) with check(id=auth.uid() and is_active);
create policy profiles_admin_all on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());

create policy courses_read_assigned on public.courses for select to authenticated using(status='active' and public.can_access_course(id));
create policy courses_admin_manage on public.courses for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy courses_teacher_create on public.courses for insert to authenticated with check(teacher_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.is_active));
create policy courses_teacher_update on public.courses for update to authenticated using(teacher_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.is_active)) with check(teacher_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='teacher' and p.is_active));

create policy assignments_read_related on public.course_assignments for select to authenticated using(student_id=auth.uid() or public.is_course_teacher(course_id) or public.is_admin());
create policy assignments_admin_manage on public.course_assignments for all to authenticated using(public.is_admin()) with check(public.is_admin());

create policy resources_read_members on public.course_resources for select to authenticated using(status='active' and public.can_access_course(course_id));
create policy resources_teacher_manage on public.course_resources for all to authenticated using(public.is_course_teacher(course_id) or public.is_admin()) with check(public.is_course_teacher(course_id) or public.is_admin());
create policy resource_views_read_owner_teacher on public.resource_views for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.course_resources r where r.id=resource_id and (public.is_course_teacher(r.course_id) or public.is_admin())));
create policy resource_views_student_insert on public.resource_views for insert to authenticated with check(student_id=auth.uid() and exists(select 1 from public.course_resources r where r.id=resource_id and public.is_course_student(r.course_id)));
create policy resource_views_student_update on public.resource_views for update to authenticated using(student_id=auth.uid() and exists(select 1 from public.course_resources r where r.id=resource_id and public.is_course_student(r.course_id))) with check(student_id=auth.uid() and exists(select 1 from public.course_resources r where r.id=resource_id and public.is_course_student(r.course_id)));

create policy announcements_read_members on public.announcements for select to authenticated using(status='published' and public.can_access_course(course_id));
create policy announcements_teacher_manage on public.announcements for all to authenticated using(public.is_course_teacher(course_id) or public.is_admin()) with check(public.is_course_teacher(course_id) or public.is_admin());

create policy assessments_read_members on public.assessments for select to authenticated using(public.can_access_course(course_id) and (status='published' or public.is_course_teacher(course_id) or public.is_admin()));
create policy assessments_teacher_manage on public.assessments for all to authenticated using(public.is_course_teacher(course_id) or public.is_admin()) with check(public.is_course_teacher(course_id) or public.is_admin());
create policy questions_read_members on public.assessment_questions for select to authenticated using(exists(select 1 from public.assessments a where a.id=assessment_id and public.is_course_teacher(a.course_id)) or exists(select 1 from public.assessments a where a.id=assessment_id and a.type='quiz' and a.status='published' and public.is_course_student(a.course_id)));
create policy questions_teacher_manage on public.assessment_questions for all to authenticated using(exists(select 1 from public.assessments a where a.id=assessment_id and (public.is_course_teacher(a.course_id) or public.is_admin()))) with check(exists(select 1 from public.assessments a where a.id=assessment_id and (public.is_course_teacher(a.course_id) or public.is_admin())));
create policy answer_keys_teacher_read on public.assessment_answer_keys for select to authenticated using(exists(select 1 from public.assessment_questions q join public.assessments a on a.id=q.assessment_id where q.id=question_id and (public.is_course_teacher(a.course_id) or public.is_admin())));
create policy answer_keys_teacher_manage on public.assessment_answer_keys for all to authenticated using(exists(select 1 from public.assessment_questions q join public.assessments a on a.id=q.assessment_id where q.id=question_id and (public.is_course_teacher(a.course_id) or public.is_admin()))) with check(exists(select 1 from public.assessment_questions q join public.assessments a on a.id=q.assessment_id where q.id=question_id and (public.is_course_teacher(a.course_id) or public.is_admin())));

create policy submissions_student_read on public.submissions for select to authenticated using(student_id=auth.uid() or public.is_admin() or exists(select 1 from public.assessments a where a.id=assessment_id and public.is_course_teacher(a.course_id)));
create policy submissions_student_create on public.submissions for insert to authenticated with check(student_id=auth.uid() and exists(select 1 from public.assessments a where a.id=assessment_id and a.type='assignment' and public.is_course_student(a.course_id)));
create policy submissions_teacher_grade on public.submissions for update to authenticated using(public.is_admin() or exists(select 1 from public.assessments a where a.id=assessment_id and public.is_course_teacher(a.course_id))) with check(public.is_admin() or exists(select 1 from public.assessments a where a.id=assessment_id and public.is_course_teacher(a.course_id)));

create policy attempts_student_read on public.quiz_attempts for select to authenticated using(student_id=auth.uid() or public.is_admin() or exists(select 1 from public.assessments a where a.id=assessment_id and public.is_course_teacher(a.course_id)));
create policy attempts_student_create on public.quiz_attempts for insert to authenticated with check(student_id=auth.uid() and exists(select 1 from public.assessments a where a.id=assessment_id and a.type='quiz' and public.is_course_student(a.course_id)));
create policy attempts_student_update on public.quiz_attempts for update to authenticated using(student_id=auth.uid() and status='in_progress') with check(student_id=auth.uid());

create policy chat_read_members on public.chat_messages for select to authenticated using(public.can_access_course(course_id));
create policy chat_send_members on public.chat_messages for insert to authenticated with check(user_id=auth.uid() and public.can_access_course(course_id));
create policy chat_moderate_teacher on public.chat_messages for update to authenticated using(public.is_course_teacher(course_id) or public.is_admin()) with check(public.is_course_teacher(course_id) or public.is_admin());

create policy complaints_read_parties on public.complaints for select to authenticated using(student_id=auth.uid() or assigned_to=auth.uid() or public.is_admin());
create policy complaints_student_create on public.complaints for insert to authenticated with check(student_id=auth.uid() and assigned_to is null and status='submitted');
create policy complaints_handler_update on public.complaints for update to authenticated using(assigned_to=auth.uid() or public.is_admin()) with check(assigned_to=auth.uid() or public.is_admin());
create policy complaint_updates_read_parties on public.complaint_updates for select to authenticated using(exists(select 1 from public.complaints c where c.id=complaint_id and (c.student_id=auth.uid() or c.assigned_to=auth.uid() or public.is_admin())));
create policy complaint_updates_staff_write on public.complaint_updates for insert to authenticated with check(actor_id=auth.uid() and (public.is_admin() or exists(select 1 from public.complaints c where c.id=complaint_id and c.assigned_to=auth.uid())));

create policy audit_admin_read on public.audit_logs for select to authenticated using(public.is_admin());
create policy audit_server_insert on public.audit_logs for insert to authenticated with check(public.is_admin());

-- Private resources/submissions bucket. Storage paths begin with course UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lms-private','lms-private',false,26214400,array['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy lms_storage_read_members on storage.objects for select to authenticated using(bucket_id='lms-private' and public.can_access_course((storage.foldername(name))[1]::uuid));
create policy lms_storage_course_teacher_upload on storage.objects for insert to authenticated with check(bucket_id='lms-private' and (public.is_course_teacher((storage.foldername(name))[1]::uuid) or public.is_admin() or ((storage.foldername(name))[2]='submissions' and (storage.foldername(name))[4]=auth.uid()::text and public.is_course_student((storage.foldername(name))[1]::uuid))));
create policy lms_storage_course_teacher_update on storage.objects for update to authenticated using(bucket_id='lms-private' and (public.is_course_teacher((storage.foldername(name))[1]::uuid) or public.is_admin())) with check(bucket_id='lms-private' and (public.is_course_teacher((storage.foldername(name))[1]::uuid) or public.is_admin()));

-- Intentionally no auth.users signup trigger: accounts are provisioned by trusted staff.
-- Disable public signups in Supabase Auth settings as a required project-level control.
