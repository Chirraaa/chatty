import { Text, Pressable } from 'react-native';

export function Button({ children, onPress, variant = 'default' }) {
  const baseClasses = "px-6 py-3 rounded-lg items-center justify-center";
  
  const variants = {
    default: "bg-slate-900 active:bg-slate-800",
    outline: "border-2 border-slate-300 active:bg-slate-100",
    ghost: "active:bg-slate-100"
  };

  const textVariants = {
    default: "text-white text-base font-semibold",
    outline: "text-slate-900 text-base font-semibold",
    ghost: "text-slate-900 text-base font-semibold"
  };

  return (
    <Pressable 
      onPress={onPress}
      className={`${baseClasses} ${variants[variant]}`}
    >
      <Text className={textVariants[variant]}>
        {children}
      </Text>
    </Pressable>
  );
}