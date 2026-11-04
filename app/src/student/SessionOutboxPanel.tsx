import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { BottomSheet, Button } from '../components';
import { useSessionOutbox } from '../api/useSessionOutbox';
import { useTheme } from '../theme/ThemeProvider';

type SessionOutboxPanelProps = {
  ownerId: string | null | undefined;
  consent: boolean;
};

export function SessionOutboxPanel({ ownerId, consent }: SessionOutboxPanelProps) {
  const theme = useTheme();
  const { outbox, snapshot, syncNow } = useSessionOutbox(ownerId);
  const [visible, setVisible] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!ownerId || snapshot.failures.length === 0) return null;

  const retry = async (clientSessionId: string): Promise<void> => {
    if (!outbox || !consent) return;
    setWorkingId(clientSessionId);
    setActionMessage(null);
    try {
      await outbox.retryFailure(clientSessionId);
      await syncNow();
      setActionMessage('Nova tentativa concluída.');
    } catch {
      setActionMessage('A sessão continua salva no aparelho.');
    } finally {
      setWorkingId(null);
    }
  };

  const discard = async (clientSessionId: string): Promise<void> => {
    if (!outbox) return;
    setWorkingId(clientSessionId);
    setActionMessage(null);
    try {
      await outbox.discardFailure(clientSessionId);
      if (snapshot.failures.length <= 1) setVisible(false);
    } catch {
      setActionMessage('Não foi possível descartar a sessão.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <>
      <Pressable
        accessibilityLabel={`${snapshot.failures.length} sessões precisam de atenção`}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={{
          alignItems: 'center',
          backgroundColor: theme.colors.elevated,
          borderColor: theme.colors.warning,
          borderRadius: theme.radius.pill,
          borderWidth: theme.sizes.border,
          flexDirection: 'row',
          gap: theme.spacing.xs,
          minHeight: 40,
          paddingHorizontal: theme.spacing.sm,
        }}
      >
        <AlertTriangle color={theme.colors.warning} size={16} />
        <Text style={{ color: theme.colors.warning, fontSize: theme.typography.fontSize.xs }}>
          {snapshot.failures.length}
        </Text>
      </Pressable>
      <BottomSheet
        accessibilityLabel="Falhas de sincronização de treinos"
        onClose={() => setVisible(false)}
        title="Treinos que precisam de atenção"
        visible={visible}
      >
        {snapshot.failures.map((failure) => (
          <View
            key={failure.clientSessionId}
            style={{
              borderBottomColor: theme.colors.border,
              borderBottomWidth: theme.sizes.border,
              gap: theme.spacing.sm,
              paddingVertical: theme.spacing.md,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontFamily: theme.typography.fontFamily.medium,
                fontSize: theme.typography.fontSize.sm,
              }}
            >
              {failure.reason}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              <Button
                accessibilityLabel="Tentar sincronizar este treino novamente"
                disabled={!consent || workingId === failure.clientSessionId}
                label="Tentar de novo"
                loading={workingId === failure.clientSessionId}
                onPress={() => void retry(failure.clientSessionId)}
                variant="primary"
              />
              <Button
                accessibilityLabel="Descartar este treino pendente"
                disabled={workingId === failure.clientSessionId}
                label="Descartar"
                onPress={() => void discard(failure.clientSessionId)}
                variant="secondary"
              />
            </View>
          </View>
        ))}
        {actionMessage ? (
          <Text accessibilityRole="status" style={{ color: theme.colors.secondary }}>
            {actionMessage}
          </Text>
        ) : null}
      </BottomSheet>
    </>
  );
}
