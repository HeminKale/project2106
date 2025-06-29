import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

interface TabSetting {
  id: string;
  name: string;
  api_name: string;
  is_visible: boolean;
}

export default function TabSettingsPage() {
  const [tabs, setTabs] = useState<TabSetting[]>([]);
  const [originalTabs, setOriginalTabs] = useState<TabSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchTabs();
  }, []);

  const fetchTabs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tabs')
      .select('id, name, api_name, is_visible')
      .order('display_order');
    if (!error && data) {
      setTabs(data);
      setOriginalTabs(data);
    }
    setLoading(false);
  };

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setTabs(tabs =>
      tabs.map(tab =>
        tab.id === id ? { ...tab, is_visible: checked } : tab
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    // Find only changed tabs
    const changedTabs = tabs.filter((tab, i) => tab.is_visible !== originalTabs[i]?.is_visible);

    try {
      for (const tab of changedTabs) {
        const { error } = await supabase
          .from('tabs')
          .update({ is_visible: tab.is_visible })
          .eq('id', tab.id);
        if (error) throw error;
      }
      setMessage('✅ Tab visibility updated successfully!');
      setOriginalTabs([...tabs]);
      await fetchTabs(); // Re-fetch to update navigation bar
    } catch (err: any) {
      setMessage('❌ Failed to update tab visibility.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Tab Settings</h2>
      <div className="grid grid-cols-2 gap-4">
        {tabs.map(tab => (
          <div key={tab.api_name} className="flex items-center justify-between border p-4 rounded">
            <span>{tab.name}</span>
            <input
              type="checkbox"
              checked={tab.is_visible}
              onChange={e => handleCheckboxChange(tab.id, e.target.checked)}
            />
          </div>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
      {message && (
        <div className={`mt-2 p-2 rounded ${message.startsWith('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}
    </div>
  );
} 