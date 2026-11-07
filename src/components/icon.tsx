import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  /** SF Symbol name (iOS). */
  ios: SFSymbol;
  /** Material Symbol name (Android + web). */
  md: AndroidSymbol;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ ios, md, size = 22, color, style }: Props) {
  return (
    <SymbolView
      name={{ ios, android: md, web: md }}
      size={size}
      tintColor={color}
      style={style}
    />
  );
}
