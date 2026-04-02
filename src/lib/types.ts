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
  created: string;
  updated: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  client?: string;
  assigned_to?: string;
  expand?: { client?: Client; assigned_to?: User };
  created: string;
  updated: string;
}

export interface ContentItem {
  id: string;
  title: string;
  platform: string;
  status: 'draft' | 'scheduled' | 'published';
  schedule_date?: string;
  client?: string;
  expand?: { client?: Client };
  created: string;
  updated: string;
}

export interface Asset {
  id: string;
  name: string;
  file: string;
  client?: string;
  expand?: { client?: Client };
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  user?: string;
  client?: string;
  created: string;
}
