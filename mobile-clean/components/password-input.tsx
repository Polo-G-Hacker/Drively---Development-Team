import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  containerStyle?: StyleProp<ViewStyle>;
  iconColor?: string;
  inputStyle?: StyleProp<TextStyle>;
};

export function PasswordInput({
  containerStyle,
  iconColor = '#6B7280',
  inputStyle,
  ...inputProps
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        {...inputProps}
        secureTextEntry={!isVisible}
        style={[inputStyle, styles.inputWithToggle]}
      />
      <TouchableOpacity
        accessibilityLabel={isVisible ? 'Hide password' : 'Show password'}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setIsVisible((current) => !current)}
        style={styles.toggleButton}
      >
        <Ionicons name={isVisible ? 'eye-off-outline' : 'eye-outline'} size={20} color={iconColor} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    position: 'relative',
  },
  inputWithToggle: {
    paddingRight: 48,
  },
  toggleButton: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 0,
    width: 28,
  },
});
