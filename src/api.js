import { supabase, isSupabaseConfigured } from './supabase.js';

function checkConfig() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado. Por favor, preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.');
  }
}

// ==========================================
// PESSOAS / VOLUNTÁRIOS
// ==========================================
export async function getPeople() {
  checkConfig();
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data.map(p => ({
    id: p.id,
    name: p.name,
    phone: p.phone || '',
    area: p.area || (p.skills && p.skills.length ? p.skills.join(', ') : ''),
    initials: p.initials || p.name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase(),
    availability: p.availability || 'Disponível',
    birthday: p.birthday || '',
    skills: p.skills || [],
    unavailableFrom: p.unavailable_from || '',
    unavailableTo: p.unavailable_to || '',
    unavailableReason: p.unavailable_reason || ''
  }));
}

export async function createPerson(person) {
  checkConfig();
  const payload = {
    name: person.name,
    phone: person.phone || null,
    area: person.area || null,
    initials: person.initials || person.name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase(),
    availability: person.availability || 'Disponível',
    birthday: person.birthday || null,
    skills: person.skills || [],
    unavailable_from: person.unavailableFrom || null,
    unavailable_to: person.unavailableTo || null,
    unavailable_reason: person.unavailableReason || null
  };

  const { data, error } = await supabase
    .from('people')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePerson(id, person) {
  checkConfig();
  const payload = {
    name: person.name,
    phone: person.phone || null,
    area: person.area || null,
    initials: person.initials || person.name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase(),
    availability: person.availability || 'Disponível',
    birthday: person.birthday || null,
    skills: person.skills || [],
    unavailable_from: person.unavailableFrom || null,
    unavailable_to: person.unavailableTo || null,
    unavailable_reason: person.unavailableReason || null
  };

  const { data, error } = await supabase
    .from('people')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePerson(id) {
  checkConfig();
  const { error } = await supabase
    .from('people')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ==========================================
// ATIVIDADES
// ==========================================
export async function getActivities() {
  checkConfig();
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data.map(a => ({
    id: a.id,
    name: a.name,
    desc: a.description || '',
    icon: a.icon || '✳'
  }));
}

export async function createActivity(activity) {
  checkConfig();
  const payload = {
    name: activity.name,
    description: activity.desc || '',
    icon: activity.icon || '✳'
  };

  const { data, error } = await supabase
    .from('activities')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateActivity(id, activity) {
  checkConfig();
  const payload = {
    name: activity.name,
    description: activity.desc || '',
    icon: activity.icon || '✳'
  };

  const { data, error } = await supabase
    .from('activities')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteActivity(id) {
  checkConfig();
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ==========================================
// ESCALAS E ATRIBUIÇÕES
// ==========================================
export async function getScales() {
  checkConfig();
  const { data, error } = await supabase
    .from('scales')
    .select(`
      id,
      title,
      type,
      place,
      date,
      time,
      assignments:scale_assignments (
        id,
        person_id,
        activity_name,
        confirmed
      )
    `)
    .order('date', { ascending: true });

  if (error) throw error;

  return data.map(s => ({
    id: s.id,
    title: s.title,
    type: s.type,
    place: s.place,
    date: s.date,
    time: s.time,
    assignments: (s.assignments || []).map(a => ({
      id: a.id,
      person: a.person_id,
      activity: a.activity_name,
      confirmed: a.confirmed
    }))
  }));
}

export async function createScale(scale, assignments) {
  checkConfig();
  const { data: newScale, error: scaleError } = await supabase
    .from('scales')
    .insert([{
      title: scale.title,
      type: scale.type || 'Culto',
      place: scale.place || 'Templo principal',
      date: scale.date,
      time: scale.time || '18:30'
    }])
    .select()
    .single();

  if (scaleError) throw scaleError;

  if (assignments && assignments.length > 0) {
    const rows = assignments.map(a => ({
      scale_id: newScale.id,
      person_id: Number(a.person),
      activity_name: a.activity,
      confirmed: false
    }));

    const { error: assignError } = await supabase
      .from('scale_assignments')
      .insert(rows);

    if (assignError) throw assignError;
  }

  return newScale;
}

export async function updateScale(id, scale, assignments) {
  checkConfig();
  const { error: scaleError } = await supabase
    .from('scales')
    .update({
      title: scale.title,
      type: scale.type || 'Culto',
      place: scale.place || 'Templo principal',
      date: scale.date,
      time: scale.time || '18:30'
    })
    .eq('id', id);

  if (scaleError) throw scaleError;

  const { error: deleteError } = await supabase
    .from('scale_assignments')
    .delete()
    .eq('scale_id', id);

  if (deleteError) throw deleteError;

  if (assignments && assignments.length > 0) {
    const rows = assignments.map(a => ({
      scale_id: id,
      person_id: Number(a.person),
      activity_name: a.activity,
      confirmed: Boolean(a.confirmed)
    }));

    const { error: assignError } = await supabase
      .from('scale_assignments')
      .insert(rows);

    if (assignError) throw assignError;
  }
}

export async function deleteScale(id) {
  checkConfig();
  const { error } = await supabase
    .from('scales')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function confirmAssignment(assignmentId) {
  checkConfig();
  const { error } = await supabase
    .from('scale_assignments')
    .update({ confirmed: true })
    .eq('id', assignmentId);

  if (error) throw error;
}

// ==========================================
// NOTIFICAÇÕES (Sem LocalStorage)
// ==========================================
export async function getNotifiedKeys() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('system_notifications')
    .select('notification_key');

  if (error) return [];
  return data.map(row => row.notification_key);
}

export async function saveNotifiedKey(key) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase
    .from('system_notifications')
    .insert([{ notification_key: key }]);
}

// ==========================================
// REALTIME SUBSCRIPTION
// ==========================================
export function subscribeToRealtime(onChange) {
  if (!isSupabaseConfigured || !supabase) return null;

  const channel = supabase
    .channel('servus-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scales' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scale_assignments' }, onChange)
    .subscribe();

  return channel;
}
