import { supabase } from './supabase'

const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase!.auth.getSession()
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || 'Something went wrong. Please try again.')
  return payload as T
}

export type Profile = { id: string; full_name: string; email: string; role: 'student'|'teacher'|'admin'; avatar_url?: string|null; department?: string|null; student_id?: string|null }
export type Course = { id: string; name: string; code: string; teacher_name: string; color?: string; student_count?: number }
export type Resource = { id: string; course_id: string; title: string; description?: string; file_name?: string; file_size?: number; created_at: string; seen_at?: string|null; course_name?: string; file_url?: string }
export type Assignment = { id: string; course_id: string; title: string; description?: string; due_at?: string|null; max_marks: number; submission_type: string; course_name?: string; status?: string; marks?: number|null }
export type Quiz = { id: string; course_id: string; title: string; description?: string; due_at?: string|null; duration_minutes: number; max_marks: number; course_name?: string; status?: string; marks?: number|null }
export type Announcement = { id: string; course_id: string; title: string; body: string; created_at: string; course_name?: string; author_name?: string }
export type Grade = { id: string; title: string; course_name: string; assessment_type: 'assignment'|'quiz'; marks: number; max_marks: number; graded_at: string }
export type ChatMessage = { id: string; course_id: string; user_id: string; author_name: string; body: string; created_at: string }
export type Complaint = { id: string; reference_code: string; subject: string; category: string; description: string; status: string; created_at: string; response?: string }

