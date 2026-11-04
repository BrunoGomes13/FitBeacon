export const profileSections = [
  { id: 'personal', label: 'Dados pessoais', available: true },
  { id: 'gym', label: 'Minha academia', available: true },
  { id: 'notifications', label: 'Notificações', available: false },
  { id: 'privacy', label: 'Privacidade', available: true },
  { id: 'support', label: 'Ajuda e suporte', available: true },
  { id: 'about', label: 'Sobre o FitBeacon', available: true },
] as const;

export type ProfileSectionId = (typeof profileSections)[number]['id'];

export function getProfileSectionRoute(section: ProfileSectionId): string | null {
  const definition = profileSections.find((item) => item.id === section);
  return definition?.available ? `/profile-info?section=${section}` : null;
}

export function getSettingsRoute(): string {
  return '/settings';
}

export function getNextThemePreference(isCurrentlyDark: boolean): 'dark' | 'light' {
  return isCurrentlyDark ? 'light' : 'dark';
}
