import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppState } from '@/state/app-provider';

const tabs = {
  index: { icon: 'home' as const, label: 'Home' },
  projects: { icon: 'folder' as const, label: 'Projects' },
  gallery: { icon: 'images' as const, label: 'Gallery' },
};

export function ChildTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { child } = useAppState();

  if (!child) return null;

  return (
    <View style={[styles.tabBarShell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => {
          const config = tabs[route.name as keyof typeof tabs];
          if (!config) return null;

          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label = typeof options?.tabBarLabel === 'string' ? options.tabBarLabel : config.label;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              onPress={onPress}
              style={({ pressed }) => [styles.tabItem, focused ? styles.activeTabItem : null, pressed ? styles.pressed : null]}>
              <Ionicons color={focused ? '#9A52FF' : '#C7C3D1'} name={config.icon} size={27} />
              <Text style={focused ? styles.activeTabText : styles.tabText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarShell: {
    position: 'relative',
    zIndex: 20,
    borderTopWidth: 1,
    borderColor: '#FFFFFF18',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#17152F',
  },
  tabBar: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  tabItem: {
    minWidth: 90,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 24,
    paddingHorizontal: 8,
  },
  activeTabItem: {
    minWidth: 108,
    borderRadius: 26,
    backgroundColor: '#292346',
    paddingHorizontal: 12,
  },
  tabText: { color: '#C7C3D1', fontSize: 14, fontWeight: '900' },
  activeTabText: { color: '#A96CFF', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.82 },
});
