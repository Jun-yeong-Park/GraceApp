import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootTabParamList } from '../types';

import HomeStackNavigator from './HomeStackNavigator';
import BibleStackNavigator from './BibleStackNavigator';
import CommunityTabStackNavigator from './CommunityTabStackNavigator';
import WorshipStackNavigator from './WorshipStackNavigator';
import MoreTabNavigator from './MoreTabNavigator';
import CustomTabBar from '../components/CustomTabBar';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="BibleTab" component={BibleStackNavigator} />
      <Tab.Screen name="CommunityTab" component={CommunityTabStackNavigator} />
      <Tab.Screen name="WorshipTab" component={WorshipStackNavigator} />
      <Tab.Screen name="More" component={MoreTabNavigator} />
    </Tab.Navigator>
  );
}
