import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BulletinStackParamList } from '../types';
import BulletinScreen from '../screens/BulletinScreen';
import BulletinDetailScreen from '../screens/BulletinDetailScreen';

const Stack = createNativeStackNavigator<BulletinStackParamList>();

export default function BulletinStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BulletinList" component={BulletinScreen} />
      <Stack.Screen name="BulletinDetail" component={BulletinDetailScreen} />
    </Stack.Navigator>
  );
}
