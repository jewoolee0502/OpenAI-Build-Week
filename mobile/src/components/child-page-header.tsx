import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ChildPageHeader({ childId }: { childId: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Text style={styles.brandSpark}>✦</Text>
        <Text style={styles.brandText}>Imagine<Text style={styles.brandLab}>Lab</Text></Text>
      </View>
      <Pressable
        accessibilityHint="Copies this Child ID so a parent can connect"
        accessibilityLabel={`Child ID ${childId}`}
        onPress={() => void Clipboard.setStringAsync(childId)}
        style={({ pressed }) => [styles.childChip, pressed ? styles.pressed : null]}>
        <View style={styles.childAvatar}><Text style={styles.childAvatarText}>🧑🏽</Text></View>
        <Text numberOfLines={1} style={styles.childChipText}>{childId}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  brand: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandSpark: {
    color: '#FFE36C',
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: '#FF9C61',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  brandText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.9 },
  brandLab: { color: '#A463FF' },
  childChip: {
    maxWidth: 184,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#FFFFFF35',
    borderRadius: 999,
    backgroundColor: '#25203DCC',
    paddingHorizontal: 8,
    paddingRight: 13,
  },
  childAvatar: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#6A4B86' },
  childAvatarText: { fontSize: 21 },
  childChipText: { flexShrink: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.2 },
  pressed: { opacity: 0.82 },
});
