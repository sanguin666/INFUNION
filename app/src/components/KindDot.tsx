import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { kindColor, kindSymbol } from '../theme/placeKinds';
import type { PoiType } from '../api/types';

/** The round badge of a kind of place: its colour, its white symbol. */
export function KindDot({ type, size = 40 }: { type: PoiType; size?: number }) {
  return (
    // Decoration: the kind is always said in words next to it.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={12} fill={kindColor(type)} />
        <G transform="translate(4.8 4.8) scale(0.6)">
          {kindSymbol(type).map((path) =>
            path.stroke ? (
              <Path key={path.d} d={path.d} fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
            ) : (
              <Path key={path.d} d={path.d} fill="#fff" />
            ),
          )}
        </G>
      </Svg>
    </View>
  );
}
