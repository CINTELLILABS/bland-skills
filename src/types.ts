// API response wrapper
export interface ApiResponse<T = unknown> {
  status?: number;
  data: T | null;
  errors: ApiError[] | null;
}

export interface ApiError {
  error: string;
  message: string;
}

// Calls
export interface Call {
  call_id: string;
  created_at: string;
  call_length: number;
  to: string;
  from: string;
  completed: boolean;
  queue_status: string;
  error_message: string | null;
  answered_by: string | null;
  batch_id: string | null;
  inbound: boolean;
  pathway_id?: string;
}

export interface CallDetail extends Call {
  transcripts: TranscriptEntry[];
  summary: string | null;
  variables: Record<string, unknown>;
  analysis: Record<string, unknown> | null;
  recording_url: string | null;
  concatenated_transcript: string;
  status: string;
  pathway_logs: unknown[] | null;
}

export interface TranscriptEntry {
  id: number;
  created_at: string;
  text: string;
  user: "user" | "assistant";
}

export interface CallListResponse {
  total_count: number;
  count: number;
  calls: Call[];
}

// Pathways
export interface Pathway {
  id: string;
  name: string;
  description?: string;
  nodes: unknown[];
  edges: unknown[];
}

// Personas
export interface Persona {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  current_production_version: PersonaVersion | null;
  current_draft_version: PersonaVersion | null;
  inbound_numbers: { phone_number: string }[];
}

export interface PersonaVersion {
  id: string;
  version_type: "PRODUCTION" | "DRAFT";
  pathway_id?: string;
  prompt?: string;
  voice?: string;
  model?: string;
  first_sentence?: string;
  tools?: unknown[];
}

// Phone Numbers
export interface PhoneNumber {
  phone_number: string;
  area_code: string;
  country_code: string;
  pathway_id?: string;
  persona_id?: string;
}

// Voices
export interface Voice {
  id?: string;
  voice_id?: string;
  name?: string;
  voice_name?: string;
}

// Tools
export interface Tool {
  tool_id: string;
  name: string;
  description: string;
}

// Knowledge Bases
export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED" | "DELETED";
  type: string;
}
