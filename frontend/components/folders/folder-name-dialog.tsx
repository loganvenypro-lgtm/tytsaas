"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { FOLDER_NAME_MAX } from "@/lib/saved-folders";

/** Ask for a folder name: used to create and to rename a folder. */
export function FolderNameDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialName = "",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  initialName?: string;
  /** Throw to show the error message and keep the dialog open. */
  onSubmit: (name: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed on open so each opening starts from initialName with no stale error. */}
        <FolderNameForm
          key={String(open)}
          title={title}
          description={description}
          submitLabel={submitLabel}
          initialName={initialName}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (name) => {
            await onSubmit(name);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function FolderNameForm({
  title,
  description,
  submitLabel,
  initialName,
  onCancel,
  onSubmit,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  initialName: string;
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = React.useState(initialName);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.folders.genericError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="grid gap-1.5">
        <Input
          autoFocus
          value={name}
          maxLength={FOLDER_NAME_MAX}
          placeholder={t.folders.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          aria-label={t.folders.nameLabel}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? t.folders.saving : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
