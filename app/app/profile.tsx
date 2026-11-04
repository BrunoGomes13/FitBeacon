import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Camera, ChevronRight, Settings2, UserRound } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Card, ErrorState, Skeleton } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchCurrentUser } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import { getProfileSectionRoute, getSettingsRoute, profileSections } from '../src/student/profilePresentation';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('pt-BR'))
    .join('');
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useAppStore((state) => state.user);
  const profilePhotoUri = useAppStore((state) => state.profilePhotoUri);
  const setProfilePhotoUri = useAppStore((state) => state.setProfilePhotoUri);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const profileQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchCurrentUser,
    enabled: Boolean(user),
  });
  const profile = profileQuery.data ?? user;

  const choosePhoto = async (): Promise<void> => {
    setPhotoError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError('Permita o acesso às fotos nas configurações do aparelho para escolher uma imagem.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;
      const directory = new Directory(Paths.document, 'fitbeacon-private');
      directory.create({ idempotent: true, intermediates: true });
      const extension = asset.mimeType?.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
      const destination = new File(directory, `profile-${Date.now()}.${extension}`);
      await new File(asset.uri).copy(destination);
      setProfilePhotoUri(destination.uri);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Não foi possível salvar a foto do perfil.');
    }
  };

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <ScreenHeader eyebrow="FITBEACON · CONTA" subtitle="Seus dados e preferências." title="Perfil" />
        {profileQuery.isLoading ? <Skeleton lines={3} /> : null}
        {profileQuery.isError ? (
          <Card>
            <ErrorState
              accessibilityLabel="Falha ao carregar o perfil"
              description={profileQuery.error.message}
              onRetry={() => void profileQuery.refetch()}
              retryLabel="Tentar novamente"
              title="Não atualizamos seus dados"
            />
          </Card>
        ) : null}
        <Card>
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.md }}>
            <Pressable
              accessibilityLabel="Escolher foto de perfil"
              accessibilityRole="button"
              onPress={() => void choosePhoto()}
              style={{ alignItems: 'center', backgroundColor: theme.colors.primaryStart, borderRadius: theme.radius.pill, height: 72, justifyContent: 'center', overflow: 'hidden', width: 72 }}
            >
              {profilePhotoUri ? (
                <Image accessibilityLabel="Foto do perfil" source={{ uri: profilePhotoUri }} style={{ height: 72, width: 72 }} />
              ) : (
                <LinearGradient
                  colors={[theme.colors.primaryStart, theme.colors.primaryEnd]}
                  style={{ alignItems: 'center', height: 72, justifyContent: 'center', width: 72 }}
                >
                  <Text style={{ color: theme.colors.onPrimary, fontFamily: theme.typography.fontFamily.bold, fontSize: theme.typography.fontSize.xl }}>
                    {initials(profile?.name ?? 'Aluno')}
                  </Text>
                </LinearGradient>
              )}
              <View style={{ alignItems: 'center', backgroundColor: theme.colors.elevated, borderRadius: theme.radius.pill, bottom: 0, height: 24, justifyContent: 'center', position: 'absolute', right: 0, width: 24 }}>
                <Camera color={theme.colors.primary} size={14} />
              </View>
            </Pressable>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Text style={{ color: theme.colors.text, fontFamily: theme.typography.fontFamily.semiBold, fontSize: theme.typography.fontSize.lg }}>
                {profile?.name ?? 'Aluno'}
              </Text>
              <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>Aluno</Text>
            </View>
          </View>
          {photoError ? (
            <Text accessibilityRole="alert" style={{ color: theme.colors.error, fontSize: theme.typography.fontSize.xs }}>
              {photoError}
            </Text>
          ) : null}
        </Card>
        <Card>
          {profileSections.map((section, index) => {
            const route = getProfileSectionRoute(section.id);
            return (
              <Pressable
                accessibilityLabel={`${section.label}${section.available ? '' : ', em breve'}`}
                accessibilityRole={section.available ? 'button' : undefined}
                accessibilityState={{ disabled: !section.available }}
                disabled={!section.available}
                key={section.id}
                onPress={() => route && router.push(route)}
                style={{
                  alignItems: 'center',
                  borderBottomColor: theme.colors.border,
                  borderBottomWidth: index === profileSections.length - 1 ? 0 : theme.sizes.border,
                  flexDirection: 'row',
                  gap: theme.spacing.md,
                  minHeight: theme.sizes.controlHeight,
                }}
              >
                <UserRound color={section.available ? theme.colors.primary : theme.colors.secondary} size={18} />
                <Text style={{ color: section.available ? theme.colors.text : theme.colors.secondary, flex: 1, fontSize: theme.typography.fontSize.sm }}>
                  {section.label}
                </Text>
                {section.available ? (
                  <ChevronRight color={theme.colors.secondary} size={18} />
                ) : (
                  <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.xs }}>Em breve</Text>
                )}
              </Pressable>
            );
          })}
        </Card>
        <Pressable
          accessibilityLabel="Abrir configurações"
          accessibilityRole="button"
          onPress={() => router.push(getSettingsRoute())}
          style={{ alignItems: 'center', flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center', minHeight: theme.sizes.controlHeight }}
        >
          <Settings2 color={theme.colors.primary} size={18} />
          <Text style={{ color: theme.colors.primary, fontSize: theme.typography.fontSize.sm }}>Configurações</Text>
        </Pressable>
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
