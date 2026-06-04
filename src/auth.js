export const USERS = [
  { id: 'enrique',      name: 'Enrique Mendez',    email: 'enrique.mendez@noatumlogistics.com',       password: 'EnriqueNL',    initials: 'EM', role: 'commercial' },
  { id: 'oscar',        name: 'Oscar Aguilar',      email: 'oscar.aguilar@noatumlogistics.com',         password: 'OscarNL',      initials: 'OA', role: 'commercial' },
  { id: 'thomas',       name: 'Thomas Gaertner',    email: 'thomas.gaertner@noatumlogistics.com',       password: 'ThomasNL',     initials: 'TG', role: 'commercial' },
  { id: 'vicente',      name: 'Vicente Sanchez',    email: 'vicente.sanchez@noatumlogistics.com',       password: 'VicenteNL',    initials: 'VS', role: 'commercial' },
  { id: 'jacqueline',   name: 'Jacqueline Cruz',    email: 'jacqueline.cruz@noatumlogistics.com',       password: 'JacquelineNL', initials: 'JC', role: 'commercial' },
  { id: 'michell',      name: 'Michell Muñoz',      email: 'michell.munoz@noatumlogistics.com',         password: 'MichellNL',    initials: 'MM', role: 'commercial' },
  { id: 'adolfo',       name: 'Adolfo Romero',      email: 'adolfo.romero@noatumlogistics.com',         password: 'AdolfoNL',     initials: 'AR', role: 'admin' },
  { id: 'hivy',         name: 'Hivy Dominguez',     email: 'hivy.dominguez@noatumlogistics.com',        password: 'HivyNL',       initials: 'HD', role: 'commercial' },
  { id: 'nancy',        name: 'Nancy Jimenez',      email: 'nancy.jimenez@noatumlogistics.com',         password: 'NancyNL',      initials: 'NJ', role: 'commercial' },
  { id: 'judith',       name: 'Judith Arizmendi',   email: 'judith.arizmendi@noatumlogistics.com',      password: 'JudithNL',     initials: 'JA', role: 'commercial' },
  { id: 'fernando',     name: 'Fernando Vera',      email: 'fernando.vera@noatumlogistics.com',         password: 'FernandoNL',   initials: 'FV', role: 'commercial' },
  { id: 'abraham',      name: 'Abraham Vega',       email: 'abraham.vega@noatumlogistics.com',          password: 'AbrahamNL',    initials: 'AV', role: 'commercial' },
  { id: 'karla',        name: 'Karla Lira',         email: 'karla.lira@noatumlogistics.com',            password: 'KarlaNL',      initials: 'KL', role: 'commercial' },
  { id: 'jorge',        name: 'Jorge Perez',        email: 'jorge.perez@noatumlogistics.com',           password: 'JorgeNL',      initials: 'JP', role: 'commercial' },
  { id: 'diana',        name: 'Diana Moreno',       email: 'diana.moreno@noatumlogistics.com',          password: 'DianaNL',      initials: 'DM', role: 'commercial' },
  { id: 'eduardo',      name: 'Eduardo Montiel',    email: 'eduardo.montiel@noatumlogistics.com',       password: 'EduardoNL',    initials: 'EM', role: 'commercial' },
  { id: 'karlaperdomo', name: 'Karla Perdomo',      email: 'pdkarla@hotmail.com',                       password: 'KPerdomo',     initials: 'KP', role: 'commercial' },
  { id: 'dowdin',       name: 'Dowdin Juarez',      email: 'dowdin.juarez@noatumlogistics.com',         password: 'DowdinNL',     initials: 'DJ', role: 'commercial' },
  { id: 'jacquenajera', name: 'Jacqueline Najera',  email: 'jacqueline.najera@noatumlogistics.com',     password: 'JacqueNL',     initials: 'JN', role: 'commercial' },
  { id: 'mario',        name: 'Mario Martinez',     email: 'mario.martinez@noatumlogistics.com',        password: 'MarioNL',      initials: 'MM', role: 'commercial' },
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
