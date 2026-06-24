export interface UserProfile {
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
}

export interface WorkspaceItem {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface ProjectItem {
  id: number;
  name: string;
  description: string | null;
  workspace_id: number;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  filename: string;
  upload_date: string;
  summary?: string;
  suggestions?: string;
  google_doc_id?: string;
  project_id?: number;
  isDeleted?: boolean;
}
