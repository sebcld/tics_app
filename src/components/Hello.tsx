import { Text, View } from '@/components/Themed';

type HelloProps = {
  name?: string;
};

export default function Hello({ name = 'mundo' }: HelloProps) {
  return (
    <View>
      <Text>Bienvenido, {name} 👋</Text>
    </View>
  );
}

