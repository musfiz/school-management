"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Save,
  Loader2,
} from "lucide-react";
import { mainNav, type NavItem } from "@/lib/navigation";
import { confirmDialog, toast } from "@/lib/swal";
import AdminPageLoader from "@/components/dashboard/AdminPageLoader";

interface MenuNode {
  id: string;
  labelEn: string;
  labelBn: string;
  href: string;
  isVisible: boolean;
  children: MenuNode[];
}

let tmpCounter = 0;
const tmpId = () => `tmp-${++tmpCounter}`;

interface ApiNode {
  id?: number;
  labelEn: string;
  labelBn?: string | null;
  href: string;
  isVisible?: boolean;
  children?: ApiNode[];
}

function fromApi(nodes: ApiNode[]): MenuNode[] {
  return nodes.map((n) => ({
    id: n.id ? String(n.id) : tmpId(),
    labelEn: n.labelEn,
    labelBn: n.labelBn ?? "",
    href: n.href,
    isVisible: n.isVisible ?? true,
    children: n.children?.length ? fromApi(n.children) : [],
  }));
}

function fromNavItems(items: NavItem[]): MenuNode[] {
  return items.map((item) => ({
    id: tmpId(),
    labelEn: item.label,
    labelBn: "",
    href: item.href,
    isVisible: true,
    children: item.children?.length ? fromNavItems(item.children) : [],
  }));
}

function toApi(nodes: MenuNode[]): ApiNode[] {
  return nodes.map((n) => ({
    labelEn: n.labelEn,
    labelBn: n.labelBn || undefined,
    href: n.href,
    isVisible: n.isVisible,
    children: n.children.length ? toApi(n.children) : undefined,
  }));
}

function update(nodes: MenuNode[], id: string, patch: Partial<MenuNode>): MenuNode[] {
  return nodes.map((n) =>
    n.id === id ? { ...n, ...patch } : { ...n, children: update(n.children, id, patch) },
  );
}

function remove(nodes: MenuNode[], id: string): MenuNode[] {
  return nodes.filter((n) => n.id !== id).map((n) => ({ ...n, children: remove(n.children, id) }));
}

function addChild(nodes: MenuNode[], parentId: string): MenuNode[] {
  return nodes.map((n) =>
    n.id === parentId
      ? {
          ...n,
          children: [
            ...n.children,
            {
              id: tmpId(),
              labelEn: "New item",
              labelBn: "",
              href: "/",
              isVisible: true,
              children: [],
            },
          ],
        }
      : { ...n, children: addChild(n.children, parentId) },
  );
}

function move(nodes: MenuNode[], id: string, dir: -1 | 1): MenuNode[] {
  const i = nodes.findIndex((n) => n.id === id);
  if (i !== -1) {
    const j = i + dir;
    if (j < 0 || j >= nodes.length) return nodes;
    const copy = [...nodes];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  }
  return nodes.map((n) => ({ ...n, children: move(n.children, id, dir) }));
}

/** Row for a single menu item — English label, Bangla label, link, and actions. */
function MenuRow({
  node,
  index,
  total,
  depth,
  onChange,
  collapsed,
  onToggleCollapse,
}: {
  node: MenuNode;
  index: number;
  total: number;
  depth: number;
  onChange: (fn: (tree: MenuNode[]) => MenuNode[]) => void;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
}) {
  async function handleDelete() {
    const confirmed = await confirmDialog({
      title: "Delete this menu item?",
      text: node.children.length
        ? `"${node.labelEn}" and its ${node.children.length} sub-item(s) will be removed.`
        : `"${node.labelEn}" will be removed.`,
      confirmText: "Yes, delete",
      danger: true,
    });
    if (confirmed) onChange((t) => remove(t, node.id));
  }

  const hasChildren = node.children.length > 0;
  const isOpen = !collapsed.has(node.id);

  return (
    <li
      className={`rounded-md border border-ink-200 bg-white p-2.5 ${node.isVisible ? "" : "opacity-50"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.id)}
            className="rounded p-1.5 text-ink-500 hover:bg-ink-50"
            aria-label={isOpen ? "Collapse sub-items" : "Expand sub-items"}
            aria-expanded={isOpen}
          >
            {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        ) : (
          depth === 0 && <span className="w-7 shrink-0" />
        )}
        <input
          value={node.labelEn}
          onChange={(e) => onChange((t) => update(t, node.id, { labelEn: e.target.value }))}
          placeholder="Label (English)"
          className="w-36 rounded border border-ink-200 px-2 py-1.5 text-sm font-semibold outline-none focus:border-brand-400"
        />
        <input
          value={node.labelBn}
          onChange={(e) => onChange((t) => update(t, node.id, { labelBn: e.target.value }))}
          placeholder="লেবেল (বাংলা)"
          className="w-36 rounded border border-ink-200 px-2 py-1.5 text-sm outline-none focus:border-brand-400"
        />
        <input
          value={node.href}
          onChange={(e) => onChange((t) => update(t, node.id, { href: e.target.value }))}
          placeholder="/href"
          className="w-40 flex-1 rounded border border-ink-200 px-2 py-1.5 text-sm text-ink-600 outline-none focus:border-brand-400"
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onChange((t) => move(t, node.id, -1))}
            className="rounded p-1.5 text-ink-500 disabled:opacity-30 hover:bg-ink-50"
            aria-label="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onChange((t) => move(t, node.id, 1))}
            className="rounded p-1.5 text-ink-500 disabled:opacity-30 hover:bg-ink-50"
            aria-label="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {depth === 0 && (
            <button
              type="button"
              onClick={() => onChange((t) => addChild(t, node.id))}
              className="rounded p-1.5 text-brand-600 hover:bg-brand-50"
              aria-label="Add sub-item"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange((t) => update(t, node.id, { isVisible: !node.isVisible }))}
            className={`rounded p-1.5 hover:bg-ink-50 ${node.isVisible ? "text-emerald-600" : "text-ink-400"}`}
            aria-label={node.isVisible ? "Active — click to hide" : "Inactive — click to show"}
            title={node.isVisible ? "Active (visible on site)" : "Inactive (hidden from site)"}
          >
            {node.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded p-1.5 text-red-600 hover:bg-red-50"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {hasChildren && isOpen && (
        <ul
          className="mt-2 space-y-2 border-l-2 border-ink-200 pl-6"
          style={{ marginLeft: "2rem" }}
        >
          {node.children.map((child, i) => (
            <MenuRow
              key={child.id}
              node={child}
              index={i}
              total={node.children.length}
              depth={depth + 1}
              onChange={onChange}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function NavigationMenuPage() {
  const [tree, setTree] = useState<MenuNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/menus/header");
        const data = (await res.json()) as ApiNode[];
        setTree(Array.isArray(data) ? fromApi(data) : []);
      } catch {
        setError("Could not load the menu from the server.");
        toast("Could not load the menu from the server.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function updateTree(fn: (tree: MenuNode[]) => MenuNode[]) {
    setTree((prev) => fn(prev));
  }

  function importFromSite() {
    tmpCounter = 0;
    setTree(fromNavItems(mainNav));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/menus/header", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toApi(tree) }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as ApiNode[];
      setTree(fromApi(data));
      setSavedAt(new Date().toLocaleTimeString());
      toast("Menu saved successfully.");
    } catch {
      setError("Save failed. Please try again.");
      toast("Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Navigation Menu</h1>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs text-ink-500">Saved at {savedAt}</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand-700"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <AdminPageLoader />
      ) : tree.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink-300 p-6 text-center">
          <p className="mb-3 text-sm text-ink-500">No menu saved yet for this location.</p>
          <button
            type="button"
            onClick={importFromSite}
            className="rounded-md border border-ink-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Import current site menu
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {tree.map((node, i) => (
            <MenuRow
              key={node.id}
              node={node}
              index={i}
              total={tree.length}
              depth={0}
              onChange={updateTree}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() =>
          updateTree((t) => [
            ...t,
            {
              id: tmpId(),
              labelEn: "New item",
              labelBn: "",
              href: "/",
              isVisible: true,
              children: [],
            },
          ])
        }
        className="mt-4 flex items-center gap-1.5 rounded-md border border-dashed border-ink-300 px-3 py-2 text-sm font-semibold text-ink-600 hover:border-brand-400 hover:text-brand-600"
      >
        <Plus className="h-4 w-4" /> Add top-level item
      </button>
    </section>
  );
}
