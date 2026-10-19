export interface LidomTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  color: string;
}

export const LIDOM_TEAMS: LidomTeam[] = [
  { id: 'aguilas', name: 'Águilas Cibaeñas', shortName: 'Águilas', logo: '/lidom/aguilas.png', color: '#E8A317' },
  { id: 'licey', name: 'Tigres del Licey', shortName: 'Licey', logo: '/lidom/licey.png', color: '#1D4ED8' },
  { id: 'escogido', name: 'Leones del Escogido', shortName: 'Escogido', logo: '/lidom/escogido.jpg', color: '#DC2626' },
  { id: 'gigantes', name: 'Gigantes del Cibao', shortName: 'Gigantes', logo: '/lidom/gigantes.jpg', color: '#7F1D2D' },
  { id: 'estrellas', name: 'Estrellas Orientales', shortName: 'Estrellas', logo: '/lidom/estrellas.png', color: '#15803D' },
  { id: 'toros', name: 'Toros del Este', shortName: 'Toros', logo: '/lidom/toros.png', color: '#EA580C' },
];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Devuelve el equipo LIDOM cuyo nombre aparece en el texto (ej. nombre de opción), o null. */
export function findLidomTeamByName(optionName: string): LidomTeam | null {
  const n = norm(optionName);
  return LIDOM_TEAMS.find((t) => n.includes(t.id) || n.includes(norm(t.shortName))) ?? null;
}
