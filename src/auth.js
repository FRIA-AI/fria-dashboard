export const USERS = [
  { id: 'enrique', name: 'Enrique Mendez',    email: 'enrique.mendez@noatumlogistics.com',    password: 'EnriqueNL',    initials: 'EM' },
  { id: 'oscar',   name: 'Oscar Aguilar',      email: 'oscar.aguilar@noatumlogistics.com',      password: 'OscarNL',      initials: 'OA' },
  { id: 'thomas',  name: 'Thomas Gaertner',    email: 'thomas.gaertner@noatumlogistics.com',    password: 'ThomasNL',     initials: 'TG' },
  { id: 'vicente', name: 'Vicente Sanchez',    email: 'vicente.sanchez@noatumlogistics.com',    password: 'VicenteNL',    initials: 'VS' },
  { id: 'jacqueline', name: 'Jacqueline Cruz', email: 'jacqueline.cruz@noatumlogistics.com',    password: 'JacquelineNL', initials: 'JC' },
  { id: 'michell', name: 'Michell Muñoz',      email: 'michell.munoz@noatumlogistics.com',      password: 'MichellNL',    initials: 'MM' },
];

export function login(email, password) {
  const user = USERS.find(u => u.email === email && u.password === password);
  if (user) {
    const session = { ...user };
    delete session.password;
    sessionStorage.setItem('nora_session', JSON.stringify(session));
    return session;
  }
  return null;
}

export function logout() {
  sessionStorage.removeItem('nora_session');
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem('nora_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
