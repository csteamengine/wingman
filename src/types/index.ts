export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ThemeType = 'dark' | 'light' | 'high-contrast' | 'solarized-dark' | 'solarized-light' | 'dracula' | 'nord';

export type PrimaryAction = 'clipboard' | 'save_file';

export interface AppSettings {
  hotkey: string;
  theme: ThemeType;
  font_family: string;
  font_size: number;
  opacity: number;
  tab_size: number;
  line_wrap: boolean;
  line_numbers: boolean;
  show_status_bar: boolean;
  max_history_entries: number;
  auto_save_drafts: boolean;
  launch_at_login: boolean;
  default_language: string;
  window_position: WindowPosition;
  sticky_mode: boolean;
  show_diff_preview: boolean;
  primary_action: PrimaryAction;
  show_dev_tier_selector: boolean;
}

export interface HistoryEntry {
  id: number;
  content: string;
  created_at: string;
  character_count: number;
  word_count: number;
  line_count: number;
  language: string | null;
  tags: string | null;
  images: string | null; // JSON array of EditorImage objects
}

export interface HistoryStats {
  total_entries: number;
  total_characters: number;
  total_words: number;
}

export interface Snippet {
  id: string;
  name: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SnippetsData {
  snippets: Snippet[];
}

export interface CustomAIPrompt {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomAIPromptsData {
  prompts: CustomAIPrompt[];
}

export interface TextStats {
  character_count: number;
  word_count: number;
  line_count: number;
  paragraph_count: number;
}

export type TextTransform =
  | 'uppercase'
  | 'lowercase'
  | 'titlecase'
  | 'sentencecase'
  | 'trim'
  | 'sort'
  | 'deduplicate'
  | 'reverse';

export type PanelType = 'editor' | 'settings' | 'history' | 'snippets' | 'customTransformations' | 'chains' | 'customAIPrompts';

// License types
export type LicenseTier = 'free' | 'pro' | 'premium';

export type LicenseStatus = 'valid' | 'grace_period' | 'expired' | 'invalid' | 'not_activated';

export type ProFeature =
  | 'history'
  | 'syntax_highlighting'
  | 'snippets'
  | 'custom_themes'
  | 'stats_display'
  | 'export_history'
  | 'json_xml_formatting'
  | 'encode_decode'
  | 'image_attachments'
  | 'obsidian_integration'
  | 'font_customization'
  | 'opacity_control'
  | 'sticky_mode'
  | 'diff_preview'
  | 'custom_transformations'
  | 'transformation_chains';

export type PremiumFeature =
  | 'prompt_optimizer'
  | 'ai_features'
  | 'custom_ai_prompts';

export interface LicenseStatusInfo {
  tier: LicenseTier;
  status: LicenseStatus;
  email: string | null;
  days_until_expiry: number | null;
  needs_revalidation: boolean;
  is_dev: boolean;
}

// Premium subscription types
export interface SubscriptionStatus {
  tier: string;
  is_active: boolean;
  expires_at: string | null;
  tokens_used: number;
  tokens_remaining: number;
}

export interface UsageStats {
  tokens_used: number;
  tokens_remaining: number;
  request_count: number;
  resets_at: string;
}

export interface AIResponse {
  result: string;
  tokens_used_this_request: number;
  tokens_remaining: number;
}

// Obsidian types
export type ObsidianLocation = 'daily_note' | 'specific_note' | 'new_note';

export interface ObsidianConfig {
  vault_path: string;
  default_location: ObsidianLocation;
  specific_note_path: string | null;
  new_note_folder: string | null;
  template: string | null;
}

export interface ObsidianResult {
  note_name: string;
  vault_name: string;
  open_uri: string;
}

export interface AIConfig {
  system_instructions: string;
}

// AI Preset types
export type AIPresetId =
  | 'ask_ai'
  | 'email'
  | 'slack'
  | 'claude_code'
  | 'git_commit'
  | 'jira_ticket'
  | 'general_refinement'
  | 'code_review'
  | 'documentation'
  | 'pr_description'
  | 'tldr'
  | 'code_explainer';

export interface AIPreset {
  id: AIPresetId;
  name: string;
  description: string;
  systemPrompt: string;
  enabled: boolean;
}

export interface AIPresetsConfig {
  presets: AIPreset[];
}

// Clipboard tracker types
export interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
  preview: string; // First 100 chars for display
}

// Custom text transformation types
export interface CustomTransformation {
  id: string;
  name: string;
  description: string;
  code: string; // JavaScript/TypeScript function body
  language: 'javascript' | 'typescript';
  created_at: string;
  updated_at: string;
  enabled: boolean;
}

export interface CustomTransformationsData {
  transformations: CustomTransformation[];
}

// Transformation chain types
export interface ChainStep {
  id: string;
  type: 'builtin' | 'custom';
  transformId: string;  // e.g., 'uppercase' or custom UUID
  name: string;         // Display name
}

export interface TransformationChain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  created_at: string;
  updated_at: string;
  enabled: boolean;
}

export interface TransformationChainsData {
  chains: TransformationChain[];
}
