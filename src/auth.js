// TEMPORAL — este archivo de auth mock se reemplaza por Supabase Auth
// (ver Seccion 11.5 del business case). No agregar mas usuarios aqui.

export const USERS = [
  { id: 'karlaperdomo', name: 'Karla Perdomo', email: 'pdkarla@hotmail.com', password: 'KPerdomo', initials: 'KP', role: 'commercial' },
  { id: 'adolfopiloto', name: 'Adolfo Romero', email: 'adolforperez@gmail.com', password: 'FriaPiloto26', initials: 'AR', role: 'admin' },
];

export function login(email, password) {
  const user = USERS.find(u => u.email === email && u.password === password);
  if (user) {
    const session = { ...user };
    delete session.password;
    sessionStorage.setItem('fria_session', JSON.stringify(session));
    return session;
  }
  return null;
}

export function logout() {
  sessionStorage.removeItem('fria_session');
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem('fria_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
