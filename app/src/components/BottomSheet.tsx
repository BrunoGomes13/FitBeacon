import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';

type BottomSheetProps = {
  visible: boolean;
  title: string;
  accessibilityLabel: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({
  visible,
  title,
  accessibilityLabel,
  onClose,
  children,
}: BottomSheetProps) {
  const theme = useTheme();

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        style={{
          backgroundColor: theme.colors.overlay,
          flex: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          accessibilityLabel="Fechar painel"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel={accessibilityLabel}
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            borderWidth: theme.sizes.border,
            maxHeight: theme.sizes.sheetMaxHeight,
            padding: theme.spacing['2xl'],
          }}
        >
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: theme.spacing.md,
              justifyContent: 'space-between',
              marginBottom: theme.spacing.lg,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                flex: 1,
                fontFamily: theme.typography.fontFamily.semiBold,
                fontSize: theme.typography.fontSize.xl,
                lineHeight: theme.typography.lineHeight.xl,
              }}
            >
              {title}
            </Text>
            <Button
              accessibilityLabel="Fechar painel"
              label="Fechar"
              onPress={onClose}
              variant="ghost"
            />
          </View>
          <ScrollView
            contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
