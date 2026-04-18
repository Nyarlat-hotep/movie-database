import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';

// Supabase rows use `type`; the rest of the app uses `_type`
function toItem(row) {
  return { ...row, _type: row.type };
}
function toRow(item) {
  const { _type, ...rest } = item;
  return { ...rest, type: _type };
}

export function useLibrary() {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState(null);

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

  const filtered = useMemo(() => {
    let result = items;
    if (typeFilter === 'movies') result = result.filter(i => i._type === 'movie');
    if (typeFilter === 'shows')  result = result.filter(i => i._type === 'show');
    if (formatFilter)            result = result.filter(i => i.formats?.includes(formatFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => a.title.localeCompare(b.title));
  }, [items, typeFilter, formatFilter, search]);

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
    filtered, search, setSearch,
    typeFilter, setTypeFilter,
    formatFilter, setFormatFilter,
    addItem, editItem, removeItem,
    saving,
  };
}
