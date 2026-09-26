import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { NBBadge, NBButton, NBInput, NBLabel, NBPanel } from "@/components/nb";
import { api } from "@/convex/_generated/api";
import {
  AI_PROVIDER_IDS,
  AI_PROVIDER_INFO,
  type AIProvider,
} from "@/convex/lib/aiProviders";

const ERROR_MESSAGES: Record<string, string> = {
  UNSUPPORTED_PROVIDER: "That provider isn't supported.",
  MODEL_TOO_LONG: "Model name is too long.",
  UNAUTHENTICATED: "Please sign in again.",
};

export default function SettingsPage() {
  const keyStatus = useQuery(api.aiKeys.status, {});
  const saveKey = useMutation(api.aiKeys.save);
  const removeKey = useMutation(api.aiKeys.remove);

  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const info = AI_PROVIDER_INFO[provider];

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await saveKey({
        provider,
        key: key.trim(),
        model: model.trim() || undefined,
      });
      setKey("");
      setModel("");
      setSaved(true);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "KEY_FORMAT_WARNING") {
        setError(
          `That doesn't look like a typical ${info.label} key (${info.keyHint}). Check it and try again.`,
        );
      } else {
        setError(ERROR_MESSAGES[code] ?? "Could not save the key. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await removeKey();
    } catch {
      setError("Could not remove the key. Try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">AI settings</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Bring your own AI key to power repository analysis. The key is
            stored server-side, used only for your analyses, and never shown
            again after saving.
          </p>
        </div>

        {/* Current status */}
        {keyStatus ? (
          <NBPanel className="mb-6 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center border-2 border-edge bg-primary">
                  <KeyRound className="size-5 text-accent-ink" />
                </span>
                <div>
                  <p className="text-sm font-bold">
                    {keyStatus.hasKey
                      ? (AI_PROVIDER_INFO[keyStatus.provider as AIProvider]
                          ?.label ?? keyStatus.provider)
                      : "No AI key saved"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {keyStatus.hasKey
                      ? `Key ${keyStatus.keyPreview}${keyStatus.model ? ` · model ${keyStatus.model}` : ""}`
                      : "Analyses run on the built-in fallback engine until you add one."}
                  </p>
                </div>
              </div>
              {keyStatus.hasKey && (
                <NBButton
                  variant="danger"
                  size="sm"
                  onClick={handleRemove}
                  disabled={removing}
                >
                  {removing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Remove
                </NBButton>
              )}
            </div>
          </NBPanel>
        ) : null}

        {/* Save form */}
        <NBPanel>
          <div className="border-b-2 border-edge bg-primary px-5 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent-ink">
              Save your key
            </h2>
          </div>
          <form onSubmit={handleSave}>
            <div className="space-y-5 px-5 py-5">
              <div>
                <NBLabel htmlFor="provider">Provider</NBLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AI_PROVIDER_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setProvider(id)}
                      className={`flex items-center justify-between border-2 px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                        provider === id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-edge bg-card text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {AI_PROVIDER_INFO[id].label}
                      {provider === id && (
                        <Check className="size-4 text-primary" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <NBLabel htmlFor="api-key">API key</NBLabel>
                <NBInput
                  id="api-key"
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={info.keyHint}
                  required
                />
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  Get one at{" "}
                  <a
                    href={info.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-semibold text-primary underline underline-offset-2"
                  >
                    {info.docsUrl.replace(/^https:\/\//, "")}
                    <ExternalLink className="size-3" />
                  </a>
                </p>
              </div>

              <div>
                <NBLabel htmlFor="model-override">
                  Model (optional — defaults to{" "}
                  {info.defaultModel})
                </NBLabel>
                <NBInput
                  id="model-override"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={info.defaultModel}
                  maxLength={120}
                />
              </div>

              {error && (
                <p className="border-2 border-edge bg-nb-red px-3 py-2 text-xs font-semibold text-accent-ink">
                  {error}
                </p>
              )}
              {saved && (
                <p className="flex items-center gap-2 border-2 border-edge bg-nb-green px-3 py-2 text-xs font-semibold text-accent-ink">
                  <ShieldCheck className="size-4" />
                  Key saved. Your next analysis will run on {info.label}.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <NBButton type="submit" variant="ink" disabled={saving || key.trim().length < 20}>
                  {saving ? "Saving…" : "Save key"}
                </NBButton>
                <span className="text-xs text-muted-foreground">
                  Stored securely server-side · never displayed again
                </span>
              </div>
            </div>
          </form>
        </NBPanel>

        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <NBBadge tone="lime">Tip</NBBadge>
          OpenRouter is a good choice if you want one key that reaches many
          models, including free tiers.
        </p>
      </main>
    </div>
  );
}
