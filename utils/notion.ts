// Minimal Notion API types used by our sync
// Keep narrow to avoid heavy dependencies and to satisfy lint rules

export type NotionRichText = {
  plain_text?: string;
};

export type NotionUrlProperty = {
  type: 'url';
  url?: string | null;
};

export type NotionRichTextProperty = {
  type: 'rich_text';
  rich_text?: NotionRichText[];
};

export type NotionTitleProperty = {
  type: 'title';
  title?: NotionRichText[];
};

export type NotionCheckboxProperty = {
  type: 'checkbox';
  checkbox?: boolean;
};

export type NotionSelectProperty = {
  type: 'select';
  select?: { name?: string | null } | null;
};

export type NotionFilesFile = {
  name?: string;
  type: 'file';
  file?: { url?: string; expiry_time?: string };
};

export type NotionFilesExternal = {
  name?: string;
  type: 'external';
  external?: { url?: string };
};

export type NotionFilesProperty = {
  type: 'files';
  files?: Array<NotionFilesFile | NotionFilesExternal>;
};

export type NotionProperty =
  | NotionUrlProperty
  | NotionRichTextProperty
  | NotionTitleProperty
  | NotionCheckboxProperty
  | NotionSelectProperty
  | NotionFilesProperty
  | undefined;

export type NotionPage = {
  id: string;
  icon?: { emoji?: string } | null;
  cover?: { external?: { url?: string } } | null;
  properties?: Record<string, NotionProperty>;
};

export type NotionQueryResponse = {
  results: NotionPage[];
};

export function getPlainText(rt?: NotionRichText[] | null): string | undefined {
  return rt && rt.length > 0 ? rt[0]?.plain_text ?? undefined : undefined;
}

export function getSelectName(p?: NotionSelectProperty): string | undefined {
  return p?.select?.name ?? undefined;
}

export function getCheckbox(p?: NotionCheckboxProperty): boolean | undefined {
  return p?.checkbox ?? undefined;
}

export type FileKind = 'image' | 'video' | 'other';

export function inferKind(nameOrUrl: string): { kind: FileKind; ext?: string } {
  const m = /\.([a-z0-9]+)(?:$|\?|#)/i.exec(nameOrUrl);
  const ext = m ? m[1].toLowerCase() : undefined;
  const img = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'];
  const vid = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];
  if (ext && img.includes(ext)) return { kind: 'image', ext };
  if (ext && vid.includes(ext)) return { kind: 'video', ext };
  return { kind: 'other', ext };
}
