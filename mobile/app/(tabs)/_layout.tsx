import { Tabs } from 'expo-router';

import { ChildTabBar } from '@/components/child-tab-bar';

export default function ChildTabsLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#0D0C26' },
      }}
      tabBar={(props) => <ChildTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ tabBarLabel: 'Home', title: 'Home' }} />
      <Tabs.Screen name="projects" options={{ tabBarLabel: 'Projects', title: 'Projects' }} />
      <Tabs.Screen name="gallery" options={{ tabBarLabel: 'Gallery', title: 'Gallery' }} />
    </Tabs>
  );
}
