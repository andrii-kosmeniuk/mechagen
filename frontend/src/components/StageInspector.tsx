import React, { useState } from 'react';
import type { TransformState } from '../types';

type StageInspectorProps = {
  selectedItem?: string;
  setSelectedItem: (val: string) => void;
  transforms: Record<string, TransformState>;
  onTransformChange: (item: string, type: 'translate' | 'orient' | 'scale', axis: 'x' | 'y' | 'z', val: string) => void;
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Data model for the stage tree                                              */
/* ────────────────────────────────────────────────────────────────────────── */
type StageNode = {
  name: string;
  type: 'Xform' | 'Mesh' | 'Scope' | 'Physics' | 'Joint';
  icon: string;
  children?: StageNode[];
  linkable?: boolean;
};

const STAGE_TREE: StageNode[] = [
  {
    name: 'World', type: 'Xform', icon: '⊞',
    children: [
      {
        name: 'SO101_Robot', type: 'Xform', icon: '⊞',
        children: [
          { name: 'base_plate',      type: 'Mesh',  icon: '⬡', linkable: true },
          { name: 'shoulder_column', type: 'Xform', icon: '⊞', linkable: true },
          { name: 'shoulder_cap',    type: 'Mesh',  icon: '⬡', linkable: true },
          { name: 'lower_arm_link',  type: 'Xform', icon: '⊞', linkable: true,
            children: [
              { name: 'visuals',    type: 'Scope',  icon: '◈' },
              { name: 'collisions', type: 'Physics',icon: '⚡' },
            ]
          },
          { name: 'elbow_joint',     type: 'Joint', icon: '⟳', linkable: true },
          { name: 'wrist_link',      type: 'Xform', icon: '⊞', linkable: true,
            children: [
              { name: 'visuals',    type: 'Scope',  icon: '◈' },
            ]
          },
          { name: 'wrist_joint',     type: 'Joint', icon: '⟳', linkable: true },
          { name: 'gripper_link',    type: 'Xform', icon: '⊞', linkable: true,
            children: [
              { name: 'moving_jaw_link', type: 'Mesh', icon: '⬡', linkable: true },
              { name: 'fixed_jaw_link',  type: 'Mesh', icon: '⬡', linkable: true },
            ]
          },
        ]
      },
      { name: 'PhysicsScene', type: 'Physics', icon: '⚡' },
      { name: 'Looks',        type: 'Scope',   icon: '◈' },
    ]
  }
];

/* ────────────────────────────────────────────────────────────────────────── */
/* Colour maps                                                                */
/* ────────────────────────────────────────────────────────────────────────── */
const TYPE_COLOR: Record<string, string> = {
  Xform:   '#7eb8f7',
  Mesh:    '#b3d9b3',
  Scope:   '#aaaaaa',
  Physics: '#f7c948',
  Joint:   '#f09060',
};

export function StageInspector({ selectedItem, setSelectedItem, transforms, onTransformChange }: StageInspectorProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['World', 'SO101_Robot', 'lower_arm_link', 'gripper_link', 'wrist_link']));
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const activeT = (selectedItem ? transforms[selectedItem] : null) || {
    translate: { x: '0.000', y: '0.000', z: '0.000' },
    orient:    { x: '0.000', y: '0.000', z: '0.000' },
    scale:     { x: '1.000', y: '1.000', z: '1.000' },
  };

  const toggleExpand = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };
  const toggleHide = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHiddenItems(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };

  /* ── Tree row renderer ──────────────────────────────────────────────── */
  const renderNode = (node: StageNode, depth = 0, path = ''): React.ReactNode => {
    const fullPath = path ? `${path}/${node.name}` : node.name;
    const isSelected = selectedItem === node.name;
    const isExpanded = expanded.has(node.name);
    const isHidden   = hiddenItems.has(fullPath);
    const hasChildren = node.children && node.children.length > 0;
    const typeColor = TYPE_COLOR[node.type] || '#aaa';

    if (search && !node.name.toLowerCase().includes(search.toLowerCase())) {
      // still recurse children
      return node.children?.map(c => renderNode(c, depth + 1, fullPath));
    }

    return (
      <React.Fragment key={fullPath}>
        <div
          onClick={() => node.linkable && setSelectedItem(node.name)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '2px 8px 2px 0',
            paddingLeft: 8 + depth * 16,
            background: isSelected ? '#1e2f4a' : 'transparent',
            borderLeft: isSelected ? '2px solid #5b9bd5' : '2px solid transparent',
            cursor: node.linkable ? 'pointer' : 'default',
            userSelect: 'none',
            opacity: isHidden ? 0.35 : 1,
            minHeight: 22,
          }}
          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#1a1a24'; }}
          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {/* Expand arrow */}
          <span
            onClick={hasChildren ? (e) => toggleExpand(node.name, e) : undefined}
            style={{ width: 14, fontSize: 9, color: '#666', flexShrink: 0, cursor: hasChildren ? 'pointer' : 'default', marginRight: 2 }}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
          </span>

          {/* Type icon */}
          <span style={{ fontSize: 11, color: typeColor, marginRight: 5, flexShrink: 0 }}>{node.icon}</span>

          {/* Name */}
          <span style={{ fontSize: 11, color: isSelected ? '#e8e8e8' : '#c8c8c8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>

          {/* Type badge */}
          <span style={{ fontSize: 9, color: typeColor, opacity: 0.7, marginRight: 8, flexShrink: 0 }}>{node.type}</span>

          {/* Eye icon */}
          <span
            onClick={(e) => toggleHide(fullPath, e)}
            title="Toggle Visibility"
            style={{ fontSize: 11, color: isHidden ? '#444' : '#888', cursor: 'pointer', width: 16, textAlign: 'center', flexShrink: 0 }}
          >
            {isHidden ? '🙈' : '👁'}
          </span>
        </div>

        {hasChildren && isExpanded && node.children!.map(c => renderNode(c, depth + 1, fullPath))}
      </React.Fragment>
    );
  };

  /* ── Transform input row ────────────────────────────────────────────── */
  const TransformRow = ({ label, type, values }: {
    label: string;
    type: 'translate' | 'orient' | 'scale';
    values: { x: string; y: string; z: string };
  }) => (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
      <span style={{ width: 58, fontSize: 10, color: '#888', flexShrink: 0 }}>{label}</span>
      {(['x', 'y', 'z'] as const).map((ax) => {
        const axColors = { x: '#e06060', y: '#60c060', z: '#6090e0' };
        return (
          <div key={ax} style={{
            display: 'flex', alignItems: 'center', flex: 1,
            background: '#0d0d12', border: '1px solid #2a2a38',
            borderRadius: 3, padding: '2px 5px', marginRight: ax !== 'z' ? 3 : 0,
          }}>
            <span style={{ fontSize: 9, fontWeight: 'bold', color: axColors[ax], marginRight: 3, letterSpacing: 0 }}>{ax.toUpperCase()}</span>
            <input
              value={values[ax]}
              onChange={e => selectedItem && onTransformChange(selectedItem, type, ax, e.target.value)}
              style={{ background: 'transparent', border: 'none', color: '#d8d8d8', fontSize: 11, width: '100%', outline: 'none', fontFamily: "'IBM Plex Mono', monospace" }}
            />
          </div>
        );
      })}
    </div>
  );

  /* ── Prim path ──────────────────────────────────────────────────────── */
  const primPath = selectedItem ? `/World/SO101_Robot/${selectedItem}` : '/World';

  return (
    <div style={{
      width: 290,
      minWidth: 290,
      height: '100%',
      background: '#121217',
      borderLeft: '1px solid #252530',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      color: '#c8c8c8',
      fontSize: 11,
    }}>

      {/* ── Stage header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', background: '#1a1a22', borderBottom: '1px solid #252530', flexShrink: 0 }}>
        {['Stage', 'Render Settings'].map((tab,i) => (
          <div key={tab} style={{
            padding: '7px 14px', fontSize: 11, cursor: 'pointer',
            borderBottom: i === 0 ? '2px solid #5b9bd5' : '2px solid transparent',
            color: i === 0 ? '#e0e0e0' : '#888',
            fontWeight: i === 0 ? 600 : 400,
          }}>{tab}</div>
        ))}
        <div style={{ flex: 1 }} />
        {/* Filter icon */}
        <div style={{ padding: '7px 10px', color: '#666', cursor: 'pointer', fontSize: 13 }}>⚙</div>
      </div>

      {/* ── Search bar ───────────────────────────────────────────────── */}
      <div style={{ padding: '5px 8px', borderBottom: '1px solid #1e1e28', background: '#14141b', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#0d0d12', border: '1px solid #2a2a38', borderRadius: 4, padding: '3px 8px' }}>
          <span style={{ color: '#555', marginRight: 6, fontSize: 11 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: 11, width: '100%', outline: 'none' }}
          />
        </div>
      </div>

      {/* ── Column headers ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', padding: '4px 8px', background: '#15151c', borderBottom: '1px solid #1e1e28', flexShrink: 0 }}>
        <span style={{ flex: 1, fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</span>
        <span style={{ fontSize: 9, color: '#555', marginRight: 22, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Type</span>
        <span style={{ width: 16, fontSize: 9, color: '#555' }}>👁</span>
      </div>

      {/* ── Stage Tree ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {STAGE_TREE.map(n => renderNode(n))}
      </div>

      {/* ── Property panel header ────────────────────────────────────── */}
      <div style={{ flexShrink: 0, borderTop: '2px solid #1e1e28', background: '#1a1a22' }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #252530', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: '#e0e0e0', fontSize: 11 }}>Property</span>
        </div>

        {/* Search inside property */}
        <div style={{ padding: '4px 8px', borderBottom: '1px solid #1e1e28', background: '#14141b' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: '#0d0d12', border: '1px solid #2a2a38', borderRadius: 4, padding: '2px 7px' }}>
            <span style={{ color: '#555', marginRight: 5, fontSize: 10 }}>🔍</span>
            <input placeholder="Search" style={{ background: 'transparent', border: 'none', color: '#aaa', fontSize: 10, width: '100%', outline: 'none' }} />
          </div>
        </div>

        {/* Prim info */}
        <div style={{ padding: '7px 10px', borderBottom: '1px solid #1e1e28' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ width: 60, color: '#666', fontSize: 10 }}>Name</span>
            <span style={{ color: '#d0d0d0', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{selectedItem || 'SO101_Robot'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ width: 60, color: '#666', fontSize: 10 }}>Prim Path</span>
            <span style={{ color: '#7eb8f7', fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primPath}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 60, color: '#666', fontSize: 10 }}>Instanceable</span>
            <div style={{ width: 13, height: 13, border: '1px solid #3a3a4a', borderRadius: 2, background: '#0d0d12' }} />
          </div>
        </div>

        {/* Transform section */}
        <div style={{ padding: '8px 10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#c0c0c0', fontSize: 11, fontWeight: 700 }}>▼ Transform</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: '#555', cursor: 'pointer', padding: '1px 5px', border: '1px solid #2a2a38', borderRadius: 3 }}>⧉</span>
          </div>
          <TransformRow label="Translate" type="translate" values={activeT.translate} />
          <TransformRow label="Orient" type="orient"    values={activeT.orient} />
          <TransformRow label="Scale ⊞"  type="scale"     values={activeT.scale} />
        </div>
      </div>
    </div>
  );
}
