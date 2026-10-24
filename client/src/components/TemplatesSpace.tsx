import { useState } from 'react';
import {
  useTemplates, useTemplate, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
} from '@/hooks';
import { Plus, Trash2, FileText, X } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import type { Template } from '@/types';

export function TemplatesSpace() {
  const { data: templates, isLoading } = useTemplates();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Template list */}
      <div className="w-72 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Templates</h1>
          <button
            onClick={() => { setCreating(true); setSelectedId(null); }}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="New template"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {isLoading && <div className="text-sm text-muted-foreground px-2 py-4">Loading…</div>}
          {templates?.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedId(t.id); setCreating(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                selectedId === t.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              }`}
            >
              <FileText className="h-3.5 w-3.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{t.name}</div>
                {t.is_default === 1 && (
                  <span className="text-[10px] text-muted-foreground">Default</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Template detail / create */}
      <div className="flex-1 overflow-hidden">
        {creating ? (
          <TemplateEditor
            template={null}
            onClose={() => setCreating(false)}
            onCreated={(id) => { setSelectedId(id); setCreating(false); }}
          />
        ) : selectedId ? (
          <TemplateEditor
            key={selectedId}
            templateId={selectedId}
            template={null}
            onClose={() => setSelectedId(null)}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a template or create a new one
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateEditor({
  templateId,
  template: _template,
  onClose,
  onCreated,
  onDeleted,
}: {
  templateId?: number;
  template: Template | null;
  onClose: () => void;
  onCreated?: (id: number) => void;
  onDeleted?: () => void;
}) {
  const { data: loadedTemplate } = useTemplate(templateId ?? null);
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const isNew = !templateId;
  const tpl = loadedTemplate;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [detailsContent, setDetailsContent] = useState('');
  const [subtasksText, setSubtasksText] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize form when template loads
  if (tpl && !initialized) {
    setName(tpl.name);
    setDescription(tpl.description || '');
    setDetailsContent(tpl.details_content || '');
    const subtasks = JSON.parse(tpl.subtasks_json || '[]') as string[];
    setSubtasksText(subtasks.join('\n'));
    setInitialized(true);
  }

  if (!isNew && !tpl) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading…</div>;
  }

  function handleSave() {
    const subtasksArr = subtasksText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const data = {
      name,
      description,
      details_content: detailsContent,
      subtasks_json: JSON.stringify(subtasksArr),
    };

    if (isNew) {
      createTemplate.mutate(data, {
        onSuccess: (created) => onCreated?.(created.id),
      });
    } else {
      updateTemplate.mutate({ id: templateId!, data });
    }
  }

  function handleDelete() {
    if (!templateId) return;
    if (!confirm('Delete this template?')) return;
    deleteTemplate.mutate(templateId, {
      onSuccess: () => onDeleted?.(),
    });
  }

  const isDefault = tpl?.is_default === 1;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-semibold text-foreground">
          {isNew ? 'New Template' : 'Edit Template'}
        </h2>
        <div className="flex items-center gap-2">
          {!isNew && !isDefault && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete template"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-secondary rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            placeholder="Template name"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-secondary rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
            placeholder="Brief description"
          />
        </div>

        {/* Details Content (Markdown) */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Details Template (Markdown)</label>
          <div data-color-mode="dark">
            <MDEditor
              value={detailsContent}
              onChange={(val) => setDetailsContent(val || '')}
              height={250}
              preview="edit"
            />
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">
            Subtask Templates <span className="text-muted-foreground">(one per line)</span>
          </label>
          <textarea
            value={subtasksText}
            onChange={(e) => setSubtasksText(e.target.value)}
            rows={5}
            className="w-full bg-secondary rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary resize-y font-mono"
            placeholder="Subtask 1&#10;Subtask 2&#10;Subtask 3"
          />
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNew ? 'Create Template' : 'Save Changes'}
          </button>
          {isDefault && (
            <span className="text-xs text-muted-foreground">This is a default template and cannot be deleted</span>
          )}
        </div>
      </div>
    </div>
  );
}
