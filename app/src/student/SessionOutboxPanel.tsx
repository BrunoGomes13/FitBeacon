import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card } from '../components';
import { useSessionOutbox } from '../api/useSessionOutbox';
import { useTheme } from '../theme/ThemeProvider';

type SessionOutboxPanelProps = {
  ownerId: string | null | undefined;
  consent: boolean;
};

export function SessionOutboxPanel({ ownerId, consent }: SessionOutboxPanelProps) {
  const theme = useTheme();
  const { snapshot, syncNow } = useSessionOutbox(ownerId);
  const [syncing, setSyncing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!ownerId) return null;

  const syncSessions = async (): Promise<void> => {
    setActionMessage(null);
    setSyncing(true);
    try {
      const sent = await syncNow();
      setActionMessage(
        sent > 0
          ? `Sincronização concluída: ${sent} sessão(ões).`
          : snapshot.pendingCount > 0
            ? 'Não foi possível sincronizar agora. Consulte o erro abaixo; suas sessões continuam salvas.'
            : 'Não há sessões pendentes para sincronizar.',
      );
    } catch {
      setActionMessage('Não foi possível sincronizar agora. Consulte o erro abaixo.');
    } finally {
      setSyncing(false);
    }
  };

  const textStyle = {
    color: theme.colors.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.md,
  } as const;

  return (
    <Card>
      <Text
        style={{
          color: theme.colors.text,
          fontFamily: theme.typography.fontFamily.semiBold,
          fontSize: theme.typography.fontSize.lg,
          lineHeight: theme.typography.lineHeight.lg,
        }}
      >
        Sincronização de treinos
      </Text>
      <Text style={textStyle}>
        {snapshot.pendingCount === 1
          ? '1 sessão aguardando sincronização.'
          : `${snapshot.pendingCount} sessões aguardando sincronização.`}
      </Text>
      <Text style={textStyle}>
        {snapshot.failures.length === 1
          ? '1 sessão precisa de atenção.'
          : `${snapshot.failures.length} sessões precisam de atenção.`}
      </Text>
      {snapshot.errorMessage ? (
        <Text accessibilityRole="alert" style={{ ...textStyle, color: theme.colors.error }}>
          Erro de sincronização ou armazenamento: {snapshot.errorMessage}
        </Text>
      ) : null}
      {snapshot.failures.map((failure) => (
        <View key={failure.clientSessionId} style={{ gap: theme.spacing.xs }}>
          <Text style={{ ...textStyle, color: theme.colors.error }}>
            Não foi possível registrar uma sessão: {failure.reason}
          </Text>
        </View>
      ))}
      {actionMessage ? (
        <Text accessibilityRole="status" style={textStyle}>
          {actionMessage}
        </Text>
      ) : null}
      <Button
        accessibilityLabel="Sincronizar sessões pendentes agora"
        disabled={!consent || snapshot.pendingCount === 0}
        label="Sincronizar agora"
        loading={syncing}
        onPress={() => void syncSessions()}
        variant="secondary"
      />
    </Card>
  );
}
