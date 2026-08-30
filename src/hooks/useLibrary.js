import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  MEDIA_TYPES,
  DEFAULT_TYPE_FILTER,
  DB_COLUMNS,
  SEARCHABLE_PEOPLE_FIELDS,
} from '../utils/mediaTypes.js';

// Supabase rows use `type`; the rest of the app uses `_type`
function toItem(row) {
  return { ...row, _type: row.type };
}
// Whitelist against real columns — the edit form carries UI-only keys, and
// anything unrecognised makes Supabase reject the whole write.
function toRow(item) {
  const row = { type: item._type };
  for (const col of DB_COLUMNS) {
    if (col !== 'type' && col in item) row[col] = item[col];
  }
  return row;
}

// Case-insensitive substring match over title plus any people columns present.
function matchesQuery(item, q) {
  if (item.title?.toLowerCase().includes(q)) return true;
  return SEARCHABLE_PEOPLE_FIELDS.some(field =>
    (item[field] || []).some(name => name?.toLowerCase().includes(q))
  );
}

export function useLibrary() {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilterState] = useState(DEFAULT_TYPE_FILTER);
  const [facetFilter, setFacetFilter] = useState(null);

  useEffect(() => {
    supabase
      .from('items')
      .select('*')
      .order('title')
      .then(({ data, error }) => {
        if (error) console.error('Failed to load library:', error);
        setItems((data ?? []).map(toItem));
      });
  }, []);

  // Facets are type-scoped, so a Blu-ray filter left over from the Movies tab
  // would empty the Music tab. Clear it whenever the type changes. Picking a
  // tab also exits search, which otherwise overrides the tab entirely.
  const setTypeFilter = useCallback((next) => {
    setTypeFilterState(next);
    setFacetFilter(null);
    setSearch('');
  }, []);

  const isSearching = search.trim().length > 0;

  const filtered = useMemo(() => {
    let result = items;

    if (isSearching) {
      // Search deliberately ignores the active tab and its facet — it looks
      // across the whole collection.
      const q = search.trim().toLowerCase();
      result = result.filter(i => matchesQuery(i, q));
    } else {
      const type = MEDIA_TYPES[typeFilter];
      if (type) {
        result = result.filter(i => i._type === type.dbValue);
        if (facetFilter) {
          result = result.filter(i => (i[type.facetField] || []).includes(facetFilter));
        }
      }
    }

    return [...result].sort((a, b) => a.title.localeCompare(b.title));
  }, [items, typeFilter, facetFilter, search, isSearching]);

  // Chips for the active tab: the type's static facets, or — for Games —
  // the systems actually present in the library, most common first.
  const facetOptions = useMemo(() => {
    const type = MEDIA_TYPES[typeFilter];
    if (!type) return [];
    if (type.facets) return type.facets;

    const counts = new Map();
    for (const item of items) {
      if (item._type !== type.dbValue) continue;
      for (const value of item[type.facetField] || []) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value]) => value);
  }, [items, typeFilter]);

  async function addItem(item) {
    setSaving(true);
    try {
      const { data, error } = await supabase.from('items').insert(toRow(item)).select().single();
      if (error) throw error;
      setItems(prev => [...prev, toItem(data)]);
    } finally {
      setSaving(false);
    }
  }

  async function editItem(item) {
    setSaving(true);
    try {
      const { data, error } = await supabase.from('items').update(toRow(item)).eq('id', item.id).select().single();
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === item.id ? toItem(data) : i));
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item) {
    setSaving(true);
    try {
      const { error } = await supabase.from('items').delete().eq('id', item.id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== item.id));
    } finally {
      setSaving(false);
    }
  }

  return {
    filtered, search, setSearch, isSearching,
    typeFilter, setTypeFilter,
    facetFilter, setFacetFilter, facetOptions,
    addItem, editItem, removeItem,
    saving,
  };
}
