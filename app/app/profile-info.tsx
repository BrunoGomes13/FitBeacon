import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchAreas, updateTrackingConsent } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import { profileSections, type ProfileSectionId } from '../src/student/profilePresentation';

export default function ProfileInfoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const user = useAppStore((state) => state.user);
  const consent = useAppStore((state) => state.trackingConsent);
  const setTrackingConsent = useAppStore((state) => state.setTrackingConsent);
  const [actionError, setActionError] = useState<string | null>(null);
  const section = profileSections.find((item) => item.id === params.section && item.available);
  const areasQuery = useQuery({
    queryKey: ['student', 'areas'],
    queryFn: fetchAreas,
    enabled: Boolean(user && section?.id === 'gym'),
  });
  const consentMutation = useMutation({
    mutationFn: updateTrackingConsent,
    onSuccess: (updatedUser) => {
      setTrackingConsent(updatedUser.consentTracking, updatedUser);
      setActionError(null);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar o consentimento.');
    },
  });

  const titleBySection: Record<ProfileSectionId, string> = {
    personal: 'Dados pessoais',
    gym: 'Minha academia',
    notifications: 'Notificações',
    privacy: 'Privacidade',
    support: 'Ajuda e suporte',
    about: 'Sobre o FitBeacon',
  } as const;
  const sectionId = section?.id;
  const title = section ? titleBySection[section.id] : 'Perfil';

  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <Button accessibilityLabel="Voltar ao perfil" label="Voltar ao perfil" onPress={() => router.back()} variant="ghost" />
        <ScreenHeader eyebrow="FITBEACON · PERFIL" subtitle="Informações e controles da sua conta." title={title} />
        {!section ? (
          <Card>
            <EmptyState accessibilityLabel="Seção não encontrada" description="Volte ao perfil e escolha uma opção disponível." title="Página não encontrada" />
          </Card>
        ) : null}
        {sectionId === 'personal' ? (
          <Card>
            <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.lg, fontFamily: theme.typography.fontFamily.semiBold }}>
              {user?.name ?? 'Aluno'}
            </Text>
            <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>Aluno</Text>
            {user?.email ? <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.sm }}>E-mail: {user.email}</Text> : null}
            {user?.cpfMasked ? <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.sm }}>CPF: {user.cpfMasked}</Text> : null}
          </Card>
        ) : null}
        {sectionId === 'gym' ? (
          <>
            {areasQuery.isLoading ? <Skeleton lines={3} /> : null}
            {areasQuery.isError ? (
              <ErrorState accessibilityLabel="Falha ao carregar as áreas da academia" description={areasQuery.error.message} onRetry={() => void areasQuery.refetch()} retryLabel="Tentar novamente" title="Não carregamos os dados da academia" />
            ) : null}
            {areasQuery.isSuccess ? (
              <Card>
                <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.md, fontFamily: theme.typography.fontFamily.semiBold }}>
                  Unidade vinculada
                </Text>
                <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>
                  A API não disponibiliza o nome e os dados de contato da unidade para o app.
                </Text>
                {areasQuery.data.length ? (
                  <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.sm }}>
                    Áreas disponíveis: {areasQuery.data.map((area) => area.name).join(', ')}
                  </Text>
                ) : null}
              </Card>
            ) : null}
          </>
        ) : null}
        {sectionId === 'privacy' ? (
          <>
            <Card>
              <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.md, fontFamily: theme.typography.fontFamily.semiBold }}>Consentimento de atividade</Text>
              <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>
                {consent ? 'A detecção de beacons e o registro de sessões estão autorizados.' : 'A detecção e o registro de atividade estão pausados.'}
              </Text>
              <Button
                accessibilityLabel={consent ? 'Revogar consentimento LGPD' : 'Ativar consentimento LGPD'}
                label={consent ? 'Revogar consentimento' : 'Ativar consentimento'}
                loading={consentMutation.isPending}
                onPress={() => consentMutation.mutate(!consent)}
                variant={consent ? 'secondary' : 'primary'}
              />
            </Card>
            <Card>
              <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.md, fontFamily: theme.typography.fontFamily.semiBold }}>Seus dados</Text>
              <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>
                A API atual ainda não oferece exportação nem exclusão automatizada dos dados da conta. Para solicitar acesso ou exclusão, fale com a administração da academia.
              </Text>
            </Card>
          </>
        ) : null}
        {sectionId === 'support' ? (
          <Card>
            <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.md, fontFamily: theme.typography.fontFamily.semiBold }}>Precisa de ajuda?</Text>
            <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>
              Para suporte, procure a administração da sua academia. Ela pode ajudar com acesso, cadastro e equipamentos.
            </Text>
          </Card>
        ) : null}
        {sectionId === 'about' ? (
          <Card>
            <Text style={{ color: theme.colors.text, fontSize: theme.typography.fontSize.md, fontFamily: theme.typography.fontFamily.semiBold }}>FitBeacon</Text>
            <Text style={{ color: theme.colors.secondary, fontSize: theme.typography.fontSize.sm }}>
              Acompanhe seus treinos e use os equipamentos da academia com orientação.
            </Text>
          </Card>
        ) : null}
        {actionError ? (
          <Card>
            <ErrorState accessibilityLabel="Falha ao salvar privacidade" description={actionError} onRetry={() => setActionError(null)} retryLabel="Entendi" title="Não foi possível atualizar" />
          </Card>
        ) : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
