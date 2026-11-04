import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { z } from 'zod';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '../src/components';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { StudentTabBar } from '../src/components/StudentTabBar';
import { fetchAllTrainingSessions } from '../src/api/services';
import { useAppStore } from '../src/state/store';
import { useTheme } from '../src/theme/ThemeProvider';
import { getTrainingTitle } from '../src/api/trainingProgress';

export default function HistoryDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const user = useAppStore((state) => state.user);
  const sessionId = z.string().min(1).safeParse(params.sessionId);
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'all'],
    queryFn: fetchAllTrainingSessions,
    enabled: Boolean(user && sessionId.success),
  });
  const session = sessionsQuery.data?.find(
    (item) => item._id === sessionId.data,
  );
  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      <ScreenContainer>
        <Button
          accessibilityLabel="Voltar ao histórico"
          label="Voltar ao histórico"
          onPress={() => router.back()}
          variant="ghost"
        />
        <ScreenHeader
          eyebrow="FITBEACON · DETALHE"
          subtitle="Resumo da sua sessão."
          title={session ? getTrainingTitle(session) : 'Detalhe do treino'}
        />
        {sessionsQuery.isLoading ? <Skeleton lines={3} /> : null}
        {sessionsQuery.isError ? (
          <ErrorState
            accessibilityLabel="Falha ao carregar detalhes do treino"
            description={sessionsQuery.error.message}
            onRetry={() => void sessionsQuery.refetch()}
            retryLabel="Tentar novamente"
            title="Não carregamos esta sessão"
          />
        ) : null}
        {sessionsQuery.isSuccess && !session ? (
          <EmptyState
            accessibilityLabel="Sessão não encontrada"
            description="A sessão pode ter saído da página de histórico carregada."
            title="Treino não encontrado"
          />
        ) : null}
        {session ? (
          <>
            <Card>
              <Text
                style={{
                  color: theme.colors.text,
                  fontFamily: theme.typography.fontFamily.semiBold,
                  fontSize: theme.typography.fontSize.lg,
                  lineHeight: theme.typography.lineHeight.lg,
                }}
              >
                Resumo
              </Text>
              <Text
                style={{
                  color: theme.colors.secondary,
                  fontFamily: theme.typography.fontFamily.regular,
                  fontSize: theme.typography.fontSize.sm,
                  lineHeight: theme.typography.lineHeight.md,
                }}
              >
                Equipamento: {session.equipmentName ??
                  (typeof session.equipmentId === 'string'
                    ? 'Equipamento'
                    : session.equipmentId.name)}
                {session.areaName ? ` · Área: ${session.areaName}` : ''}
              </Text>
              <Text
                style={{
                  color: theme.colors.secondary,
                  fontFamily: theme.typography.fontFamily.regular,
                  fontSize: theme.typography.fontSize.sm,
                  lineHeight: theme.typography.lineHeight.lg,
                }}
              >
                {new Date(session.startedAt).toLocaleString('pt-BR')}
                {'\n'}Duração: {Math.max(1, Math.round(session.durationSec / 60))} min
                {'\n'}Séries: {session.sets.length}
              </Text>
            </Card>
            {session.sets.length ? (
              session.sets.map((set, index) => {
                const exerciseName =
                  set.exerciseName ??
                  (typeof set.exerciseId === 'string' ? 'Exercício' : set.exerciseId.name);

                return (
                  <Card key={set._id ?? `${set.setNumber}-${index}`}>
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontFamily: theme.typography.fontFamily.semiBold,
                        fontSize: theme.typography.fontSize.md,
                        lineHeight: theme.typography.lineHeight.md,
                      }}
                    >
                      {exerciseName} · série {set.setNumber}
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.secondary,
                        fontFamily: theme.typography.fontFamily.regular,
                        fontSize: theme.typography.fontSize.sm,
                        lineHeight: theme.typography.lineHeight.md,
                      }}
                    >
                      {set.load} kg × {set.reps} repetições
                    </Text>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                accessibilityLabel="Sessão sem séries anotadas"
                description="Este treino foi registrado sem séries detalhadas."
                title="Nenhuma série registrada"
              />
            )}
          </>
        ) : null}
      </ScreenContainer>
      <StudentTabBar />
    </View>
  );
}
