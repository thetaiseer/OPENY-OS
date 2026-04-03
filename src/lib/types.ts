export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  website?: string;
  industry?: string;
  status: 'active' | 'inactive' | 'prospect';
  logo?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  task_date?: string;
  client_id?: string;
  assigned_to?: string;
  created_by?: string;
  mentions?: string[];
  tags?: string[];
  client?: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface ContentItem {
  id: string;
  title: string;
  platform: string;
  status: 'draft' | 'scheduled' | 'published';
  schedule_date?: string;
  client_id?: string;
  client?: Client;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  name: string;
  file_path: string | null;
  file_url: string;
  view_url?: string | null;
  download_url?: string | null;
  file_type?: string;
  file_size?: number;
  bucket_name: string | null;
  storage_provider?: string | null;
  drive_file_id?: string | null;
  drive_folder_id?: string | null;
  client_folder_name?: string | null;
  content_type?: string | null;
  month_key?: string | null;
  client_id?: string;
  client_name?: string | null;
  client_folder_name?: string | null;
  content_type?: string | null;
  month_key?: string | null;
  uploaded_by?: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  user_id?: string;
  client_id?: string;
  created_at: string;
}
